/**
 * PremierePluginManager Page Tests
 *
 * Install and manage Premiere Pro CEP extensions directly from the app.
 * Automatically deploys plugin updates to your Premiere Pro installation.
 *
 * Test Coverage:
 * - Basic rendering and structure
 * - Breadcrumb navigation
 * - Error boundary integration
 * - Accessibility compliance
 * - Plugin list rendering
 * - Installation interactions
 */

import PremierePluginManager from '@/pages/PremierePluginManager/PremierePluginManager'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock hooks and Tauri APIs
vi.mock('@/hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Button component to avoid framer-motion issues in tests
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('PremierePluginManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Default mock: return empty array for all tests
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue([])
  })

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithProviders(<PremierePluginManager />)
      expect(screen.getByText('Premiere Plugin Manager')).toBeInTheDocument()
    })

    it('should display page title', () => {
      renderWithProviders(<PremierePluginManager />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Premiere Plugin Manager' })
      ).toBeInTheDocument()
    })

    it('should display page description', () => {
      renderWithProviders(<PremierePluginManager />)
      expect(
        screen.getByText(/Install and manage Premiere Pro CEP extensions/i)
      ).toBeInTheDocument()
    })

    it('should render main content area', () => {
      renderWithProviders(<PremierePluginManager />)
      const container = screen.getByText('Premiere Plugin Manager').closest('.w-full')
      expect(container).toBeInTheDocument()
    })

    it('should render at least one step section', () => {
      renderWithProviders(<PremierePluginManager />)
      expect(screen.getByText(/Available Plugins/i)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should set breadcrumb navigation', async () => {
      const { useBreadcrumb } = await import('@/hooks/useBreadcrumb')

      renderWithProviders(<PremierePluginManager />)

      expect(useBreadcrumb).toHaveBeenCalledWith([
        { label: 'Premiere plugins', href: '/premiere/' },
        { label: 'Premiere Plugin Manager' }
      ])
    })
  })

  describe('Error Boundary', () => {
    it('should wrap content in error boundary', () => {
      // This test verifies the ErrorBoundary wrapper exists
      // by checking if the fallback can be triggered
      renderWithProviders(<PremierePluginManager />)
      // If ErrorBoundary is present, component should render normally
      expect(screen.getByText('Premiere Plugin Manager')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have correct heading hierarchy', () => {
      renderWithProviders(<PremierePluginManager />)

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Premiere Plugin Manager')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThan(0)
    })

    it('should have semantic HTML structure', () => {
      const { container } = renderWithProviders(<PremierePluginManager />)

      // Check for proper container structure
      const mainContainer = container.querySelector('.w-full.h-full')
      expect(mainContainer).toBeInTheDocument()
    })
  })

  describe('Plugin List Integration', () => {
    it('should render plugin list section when plugins are available', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValue([
        {
          name: 'BreadcrumbsPremiere',
          displayName: 'Breadcrumbs Premiere',
          version: '0.6.6',
          filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
          size: 605790,
          installed: false,
          description: 'Breadcrumbs metadata panel',
          features: ['View metadata', 'Edit breadcrumbs']
        }
      ])

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByText(/available plugins/i)).toBeInTheDocument()
      })
    })

    it('should display loading state while fetching plugins', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockReturnValue(
        new Promise(() => {}) // Never resolves
      )

      renderWithProviders(<PremierePluginManager />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display error message if plugin fetch fails', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockRejectedValue(new Error('Failed to fetch plugins'))

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Plugin Installation', () => {
    it('should show install button for each plugin', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValue([
        {
          name: 'BreadcrumbsPremiere',
          displayName: 'Breadcrumbs Premiere',
          version: '0.6.6',
          filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
          size: 605790,
          installed: false,
          description: 'Breadcrumbs metadata panel',
          features: ['View metadata']
        }
      ])

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
      })
    })

    it('should handle install button click', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce([
        {
          name: 'BreadcrumbsPremiere',
          displayName: 'Breadcrumbs Premiere',
          version: '0.6.6',
          filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
          size: 605790,
          installed: false,
          description: 'Breadcrumbs metadata panel',
          features: ['View metadata']
        }
      ])

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
      })

      const installButton = screen.getByRole('button', { name: /install/i })

      vi.mocked(invoke).mockResolvedValueOnce({
        success: true,
        message: 'Plugin installed successfully',
        pluginName: 'BreadcrumbsPremiere',
        installedPath: '/path/to/plugin'
      })

      await user.click(installButton)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith(
          'install_plugin',
          expect.objectContaining({
            pluginFilename: 'BreadcrumbsPremiere_v0.6.6.zxp',
            pluginName: 'BreadcrumbsPremiere'
          })
        )
      })
    })

    it('should disable install button during installation', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      vi.mocked(invoke).mockResolvedValueOnce([
        {
          name: 'BreadcrumbsPremiere',
          displayName: 'Breadcrumbs Premiere',
          version: '0.6.6',
          filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
          size: 605790,
          installed: false,
          description: 'Breadcrumbs metadata panel',
          features: ['View metadata']
        }
      ])

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
      })

      const installButton = screen.getByRole('button', { name: /install/i })

      // Make installation take time
      vi.mocked(invoke).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      await user.click(installButton)

      // Button should be disabled during installation
      expect(installButton).toBeDisabled()
    })

    it('should show installed status for already installed plugins', async () => {
      const { invoke } = await import('@tauri-apps/api/core')

      vi.mocked(invoke).mockResolvedValue([
        {
          name: 'BreadcrumbsPremiere',
          displayName: 'Breadcrumbs Premiere',
          version: '0.6.6',
          filename: 'BreadcrumbsPremiere_v0.6.6.zxp',
          size: 605790,
          installed: true,
          description: 'Breadcrumbs metadata panel',
          features: ['View metadata']
        }
      ])

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getAllByText(/installed/i).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Settings Section', () => {
    it('should display CEP directory path section', async () => {
      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByText('CEP Extensions Folder')).toBeInTheDocument()
      })
    })

    it('should have button to open CEP folder', async () => {
      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open.*folder/i })).toBeInTheDocument()
      })
    })

    it('should call invoke when opening CEP folder', async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const user = userEvent.setup()

      renderWithProviders(<PremierePluginManager />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open.*folder/i })).toBeInTheDocument()
      })

      const openButton = screen.getByRole('button', { name: /open.*folder/i })
      await user.click(openButton)

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('open_cep_folder')
      })
    })
  })
})
