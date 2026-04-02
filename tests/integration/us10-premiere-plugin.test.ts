/**
 * Integration Test: US-10 — Premiere Pro Plugin Management
 *
 * As a user, when I navigate to /premiere, I can view available Premiere Pro
 * CEP plugins, install them with one click, and receive a success confirmation
 * dialog after installation.
 *
 * Tests the PremierePluginManager component (useQuery + useMutation inline).
 * Mocking strategy: mock the Premiere api.ts module and @shared/hooks; no
 * direct @tauri-apps imports.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be
 * restored in beforeEach.
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PremierePluginManager from '../../src/features/Premiere/components/PremierePluginManager'

// ============================================================================
// Test utility — render component with a fresh QueryClientProvider
// ============================================================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
}

function renderWithProvider(ui: React.ReactElement) {
  const client = makeQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return render(ui, { wrapper: Wrapper })
}

// Mock the Premiere api.ts layer (single I/O boundary for Premiere module)
vi.mock('../../src/features/Premiere/api', () => ({
  getAvailablePlugins: vi.fn().mockResolvedValue([]),
  installPlugin: vi.fn().mockResolvedValue({
    success: true,
    message: 'Plugin installed successfully',
    pluginName: 'autocue-panel',
    installedPath: '/Library/Application Support/Adobe/CEP/extensions/autocue-panel'
  }),
  openCepFolder: vi.fn().mockResolvedValue(undefined),
  showConfirmationDialog: vi.fn().mockResolvedValue(undefined),
  copyPremiereProject: vi.fn().mockResolvedValue('/path/to/project.prproj')
}))

// Mock @shared/hooks — useBreadcrumb is used in the component for nav
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

// Mock sonner toast to prevent rendering issues
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  },
  Toaster: () => null
}))

// ============================================================================
// Shared mock plugin data
// ============================================================================

const MOCK_PLUGINS = [
  {
    name: 'autocue-panel',
    displayName: 'AutoCue Panel',
    version: '1.2.0',
    filename: 'autocue-panel-v1.2.0.zip',
    size: 524288, // 512 KB
    installed: false,
    description: 'Automates cue point management in Premiere Pro',
    features: ['Auto-detect markers', 'Export to EDL', 'Batch processing'],
    icon: '/icons/autocue-panel.png'
  },
  {
    name: 'export-helper',
    displayName: 'Export Helper',
    version: '2.0.1',
    filename: 'export-helper-v2.0.1.zip',
    size: 1048576, // 1 MB
    installed: true,
    description: 'Streamlines export workflows with preset management',
    features: ['Custom presets', 'Batch export', 'Queue management'],
    icon: '/icons/export-helper.png'
  }
]

// ============================================================================
// US-10: Premiere Plugin Manager
// ============================================================================

describe('US-10 — Premiere Pro: Plugin Management', () => {
  beforeEach(async () => {
    // mockReset: true clears mock implementations — restore defaults here
    const api = await import('../../src/features/Premiere/api')
    const { useBreadcrumb } = await import('@shared/hooks')

    vi.mocked(api.getAvailablePlugins).mockResolvedValue(MOCK_PLUGINS as any)
    vi.mocked(api.installPlugin).mockResolvedValue({
      success: true,
      message: 'Plugin installed successfully',
      pluginName: 'autocue-panel',
      installedPath:
        '/Library/Application Support/Adobe/CEP/extensions/autocue-panel'
    })
    vi.mocked(api.openCepFolder).mockResolvedValue(undefined)
    vi.mocked(useBreadcrumb).mockReturnValue(undefined as any)
  })

  it('US-10a — should call getAvailablePlugins on mount', async () => {
    const api = await import('../../src/features/Premiere/api')

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(api.getAvailablePlugins).toHaveBeenCalledTimes(1)
    })
  })

  it('US-10b — should display plugin display names after loading', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText('AutoCue Panel')).toBeDefined()
      expect(screen.getByText('Export Helper')).toBeDefined()
    })
  })

  it('US-10c — should display plugin version information', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText(/v1\.2\.0/)).toBeDefined()
      expect(screen.getByText(/v2\.0\.1/)).toBeDefined()
    })
  })

  it('US-10d — should show Install Plugin button for uninstalled plugins', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      // AutoCue Panel is not installed — should show Install button
      const installButtons = screen.getAllByText('Install Plugin')
      expect(installButtons.length).toBeGreaterThan(0)
    })
  })

  it('US-10e — should show Installed badge for already-installed plugins', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      // Export Helper is installed — should show Installed badge (not Install button)
      // The installed badge text appears in both button and badge; find all
      const installedTexts = screen.getAllByText('Installed')
      expect(installedTexts.length).toBeGreaterThan(0)
    })
  })

  it('US-10f — should show loading indicator before plugins load', async () => {
    const api = await import('../../src/features/Premiere/api')

    // Return a never-resolving promise to keep loading state
    vi.mocked(api.getAvailablePlugins).mockReturnValue(new Promise(() => {}))

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    expect(screen.getByText('Loading plugins...')).toBeDefined()
  })

  it('US-10g — should show error message when getAvailablePlugins rejects', async () => {
    const api = await import('../../src/features/Premiere/api')

    vi.mocked(api.getAvailablePlugins).mockRejectedValue(
      new Error('CEP directory not accessible')
    )

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText(/Error loading plugins/)).toBeDefined()
    })
  })

  it('US-10h — should call installPlugin with correct filename and name when Install is clicked', async () => {
    const api = await import('../../src/features/Premiere/api')
    const user = userEvent.setup()

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText('AutoCue Panel')).toBeDefined()
    })

    // Click the Install Plugin button for the uninstalled plugin
    const installButton = screen.getAllByText('Install Plugin')[0]
    await act(async () => {
      await user.click(installButton)
    })

    await waitFor(() => {
      expect(api.installPlugin).toHaveBeenCalledWith(
        'autocue-panel-v1.2.0.zip',
        'autocue-panel'
      )
    })
  })

  it('US-10i — should render the page header text', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText('Premiere Plugin Manager')).toBeDefined()
    })
  })

  it('US-10j — should render the Open Extensions Folder button', async () => {
    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText('Open Extensions Folder')).toBeDefined()
    })
  })

  it('US-10k — should call openCepFolder when Open Extensions Folder is clicked', async () => {
    const api = await import('../../src/features/Premiere/api')
    const user = userEvent.setup()

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      expect(screen.getByText('Open Extensions Folder')).toBeDefined()
    })

    await act(async () => {
      await user.click(screen.getByText('Open Extensions Folder'))
    })

    expect(api.openCepFolder).toHaveBeenCalledTimes(1)
  })

  it('US-10l — should handle empty plugin list gracefully', async () => {
    const api = await import('../../src/features/Premiere/api')
    vi.mocked(api.getAvailablePlugins).mockResolvedValue([])

    await act(async () => {
      renderWithProvider(React.createElement(PremierePluginManager))
    })

    await waitFor(() => {
      // No plugins shown — page header still present, no install buttons
      expect(screen.getByText('Premiere Plugin Manager')).toBeDefined()
      expect(screen.queryByText('Install Plugin')).toBeNull()
    })
  })
})
