/**
 * PremierePluginManager tests
 *
 * The single unit test file for this component. `tests/unit/pages/
 * PremierePluginManager.test.tsx` was deleted under issue #237 following the
 * pattern set by #205 (PR #214) and #220 (PR #233).
 *
 * What did not survive: "renders without crashing" with no further assertion,
 * assertions on Tailwind class literals (`.w-full.h-full`, `.w-full`),
 * duplicate copies of tests that appear below, and tests that mocked
 * `@tauri-apps/api/core` directly instead of the feature's api.ts boundary.
 *
 * Error-path tests are present because the error branch is reachable (an IPC
 * failure will trigger it) and the component presents a user-visible message
 * that matters - it must NOT echo the raw backend string, and it must offer a
 * retry. The Rust command `get_available_plugins` itself cannot fail (it
 * builds a hardcoded Vec and swallows its only fallible call with
 * `.unwrap_or(false)`), but the IPC transport can, and the user deserves a
 * good message when it does.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PluginInfo } from '../types'
import PremierePluginManager from './PremierePluginManager'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the Premiere api.ts layer - the single I/O boundary for this feature.
// No direct @tauri-apps imports: the component goes through api.ts, and so do
// the tests.
vi.mock('../api', () => ({
  getAvailablePlugins: vi.fn().mockResolvedValue([]),
  installPlugin: vi.fn().mockResolvedValue({
    success: true,
    message: 'Plugin installed successfully',
    pluginName: 'BreadcrumbsPremiere',
    installedPath: '/Library/Application Support/Adobe/CEP/extensions/BreadcrumbsPremiere'
  }),
  openCepFolder: vi.fn().mockResolvedValue(undefined),
  showConfirmationDialog: vi.fn().mockResolvedValue(undefined),
  copyPremiereProject: vi.fn().mockResolvedValue('/path/to/project.prproj')
}))

vi.mock('@shared/hooks', () => ({
  useBreadcrumb: vi.fn(),
  useApiKeys: vi.fn().mockReturnValue({ data: null, isLoading: false, error: null }),
  useSproutVideoApiKey: vi.fn().mockReturnValue({ apiKey: null }),
  useTrelloApiKeys: vi.fn().mockReturnValue({ apiKey: null, apiToken: null }),
  useFuzzySearch: vi.fn().mockReturnValue({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    results: []
  }),
  useReducedMotion: vi.fn().mockReturnValue(false),
  useUsername: vi.fn().mockReturnValue({ username: null, isLoading: false }),
  useIsMobile: vi.fn().mockReturnValue(false)
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLUGINS: PluginInfo[] = [
  {
    name: 'BreadcrumbsPremiere',
    displayName: 'Breadcrumbs Premiere',
    version: '0.6.6',
    filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
    size: 605790,
    installed: false,
    description: 'Breadcrumbs metadata panel',
    features: ['View metadata', 'Edit breadcrumbs'],
    icon: '/icons/plugins/adobe-Bc-S.svg'
  },
  {
    name: 'Boring',
    displayName: 'Boring',
    version: '0.5.2',
    filename: 'Boring_v0.5.2.zxp',
    size: 67035,
    installed: true,
    description: 'Boring detector for Premiere Pro',
    features: ['Analyze timeline'],
    icon: '/icons/plugins/logo.svg'
  }
]

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * Every render of this component goes through here. The component uses
 * useQuery, useMutation and useQueryClient, so it needs a QueryClientProvider.
 */
function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<PremierePluginManager />, { wrapper: Wrapper })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  const api = await import('../api')
  const { useBreadcrumb } = await import('@shared/hooks')

  vi.mocked(api.getAvailablePlugins).mockResolvedValue(PLUGINS)
  vi.mocked(api.installPlugin).mockResolvedValue({
    success: true,
    message: 'Plugin installed successfully',
    pluginName: 'BreadcrumbsPremiere',
    installedPath: '/Library/Application Support/Adobe/CEP/extensions/BreadcrumbsPremiere'
  })
  vi.mocked(api.openCepFolder).mockResolvedValue(undefined)
  vi.mocked(useBreadcrumb).mockReturnValue({
    breadcrumbData: undefined,
    updateBreadcrumbs: vi.fn()
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PremierePluginManager', () => {
  describe('page structure', () => {
    it('renders the page title as an h1', async () => {
      renderPage()

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Premiere Plugin Manager' })
      ).toBeInTheDocument()
    })

    it('sets the breadcrumb path on mount', async () => {
      const { useBreadcrumb } = await import('@shared/hooks')

      renderPage()

      expect(useBreadcrumb).toHaveBeenCalledWith([
        { label: 'Premiere plugins', href: '/premiere/' },
        { label: 'Premiere Plugin Manager' }
      ])
    })
  })

  describe('plugin list', () => {
    it('shows a loading indicator while the plugin list is being fetched', async () => {
      const api = await import('../api')
      vi.mocked(api.getAvailablePlugins).mockReturnValue(new Promise(() => {}))

      renderPage()

      expect(screen.getByText('Loading plugins...')).toBeInTheDocument()
    })

    it('renders each plugin by display name once loaded', async () => {
      renderPage()

      expect(await screen.findByText('Breadcrumbs Premiere')).toBeInTheDocument()
      expect(screen.getByText('Boring')).toBeInTheDocument()
    })

    it('shows the version for each plugin', async () => {
      renderPage()

      expect(await screen.findByText(/v0\.6\.6/)).toBeInTheDocument()
      expect(screen.getByText(/v0\.5\.2/)).toBeInTheDocument()
    })

    it('shows an Install Plugin button for uninstalled plugins', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })

      // BreadcrumbsPremiere is not installed - should have an Install Plugin button
      const installButtons = screen.getAllByRole('button', { name: /install plugin/i })
      expect(installButtons.length).toBeGreaterThan(0)
    })

    it('shows an Installed badge for already-installed plugins', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Boring')).toBeInTheDocument()
      })

      // Boring is installed - the badge reads "Installed"
      expect(screen.getAllByText('Installed').length).toBeGreaterThan(0)
    })

    it('shows no Install Plugin buttons when the list is empty', async () => {
      const api = await import('../api')
      vi.mocked(api.getAvailablePlugins).mockResolvedValue([])

      renderPage()

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: 'Premiere Plugin Manager' })
        ).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: /install plugin/i })).toBeNull()
    })
  })

  describe('plugin installation', () => {
    it('calls installPlugin with the correct filename and name', async () => {
      const api = await import('../api')
      const user = userEvent.setup()

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /install plugin/i })[0])

      await waitFor(() => {
        expect(api.installPlugin).toHaveBeenCalledWith(
          'BreadcrumbsPremiere_v0.6.6.zxp',
          'BreadcrumbsPremiere'
        )
      })
    })

    it('disables the install button while the installation is in progress', async () => {
      const api = await import('../api')
      const user = userEvent.setup()

      // Make installation hang so isPending stays true
      vi.mocked(api.installPlugin).mockReturnValue(new Promise(() => {}))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /install plugin/i })[0])

      // The button text changes to "Installing..." while the mutation is pending,
      // and the disabled attribute is set.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /installing/i })).toBeDisabled()
      })
    })
  })

  describe('error handling', () => {
    // `get_available_plugins` itself cannot fail (see the Rust source and
    // issue #226), but the IPC transport can. The component must lead with an
    // actionable headline rather than echoing the raw backend string.
    it('headlines a plugin fetch failure without echoing the raw error', async () => {
      const api = await import('../api')
      vi.mocked(api.getAvailablePlugins).mockRejectedValue(
        new Error('Command get_available_plugins not found')
      )

      renderPage()

      const alert = await screen.findByRole('alert')

      expect(within(alert).getByRole('heading')).toHaveTextContent(
        'The bundled plugin list could not be loaded'
      )
      expect(within(alert).getByRole('heading')).not.toHaveTextContent(
        'get_available_plugins'
      )
    })

    it('reassures the user about installed plugins and keeps the raw error in a disclosure', async () => {
      const api = await import('../api')
      vi.mocked(api.getAvailablePlugins).mockRejectedValue(
        new Error('Command get_available_plugins not found')
      )

      renderPage()

      const alert = await screen.findByRole('alert')

      expect(alert).toHaveTextContent(/already installed in Premiere Pro are unaffected/i)
      expect(alert).toHaveTextContent(/restart Bucket/i)
      expect(within(alert).getByText('Technical Details')).toBeInTheDocument()
      expect(alert).toHaveTextContent('Command get_available_plugins not found')
    })

    it('reloads the plugin list when the user clicks Retry', async () => {
      const api = await import('../api')
      const user = userEvent.setup()

      vi.mocked(api.getAvailablePlugins)
        .mockRejectedValueOnce(new Error('IPC failure'))
        .mockResolvedValue(PLUGINS)

      renderPage()

      const alert = await screen.findByRole('alert')
      await user.click(within(alert).getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('shows no alert when the plugin list loads successfully', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('settings section', () => {
    it('renders the CEP Extensions Folder section', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('CEP Extensions Folder')).toBeInTheDocument()
      })
    })

    it('calls openCepFolder when the Open Extensions Folder button is clicked', async () => {
      const api = await import('../api')
      const user = userEvent.setup()

      renderPage()

      // Wait for the full page to settle - the plugin list must resolve before
      // the button click reliably triggers. The settings section is below the
      // plugin list, and rendering it while the query is in flight can swallow
      // the onClick.
      await waitFor(() => {
        expect(screen.getByText('Breadcrumbs Premiere')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /open extensions folder/i }))

      await waitFor(() => {
        expect(api.openCepFolder).toHaveBeenCalledTimes(1)
      })
    })
  })
})
