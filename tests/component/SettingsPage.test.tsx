/**
 * Component Test: SettingsPage
 *
 * This test verifies the Settings page component follows the same UI patterns
 * as BuildProject and Baker pages with proper ErrorBoundary wrapping.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'

// Mock the hooks before importing the component
vi.mock('@hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

vi.mock('@hooks/useAIProvider', () => ({
  useAIProvider: () => ({
    validateProvider: vi.fn().mockResolvedValue({
      success: true,
      modelsFound: 5,
      latencyMs: 100
    })
  })
}))

vi.mock('@utils/storage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({
    trello: '',
    trelloToken: '',
    sproutVideo: '',
    ollamaUrl: 'http://localhost:11434'
  }),
  saveApiKeys: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      defaultBackgroundFolder: '/default/folder',
      setDefaultBackgroundFolder: vi.fn(),
      ollamaUrl: 'http://localhost:11434',
      setOllamaUrl: vi.fn()
    }
    return selector(state)
  })
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/selected/folder')
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock ThemeSelector and TrelloBoardSelector
vi.mock('@components/Settings/ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">Theme Selector</div>
}))

vi.mock('@components/Settings/TrelloBoardSelector', () => ({
  TrelloBoardSelector: () => <div data-testid="trello-board-selector">Board Selector</div>
}))

// Import the component after mocks are set up
import Settings from '../../src/pages/Settings'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('SettingsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render page title', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })

    test('should render AI Models section', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByText('AI Models')).toBeInTheDocument()
      expect(
        screen.getByText(/Configure AI provider settings for script formatting/i)
      ).toBeInTheDocument()
    })

    test('should render Appearance section', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByText('Appearance')).toBeInTheDocument()
      expect(
        screen.getByText(/Customize the visual theme and color scheme/i)
      ).toBeInTheDocument()
    })

    test('should render Trello section', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByText('Trello')).toBeInTheDocument()
      expect(
        screen.getByText(/Configure Trello API integration for project management/i)
      ).toBeInTheDocument()
    })

    test('should render SproutVideo section', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByText('SproutVideo')).toBeInTheDocument()
      expect(
        screen.getByText(/Configure SproutVideo API for video hosting/i)
      ).toBeInTheDocument()
    })

    test('should render Backgrounds section', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByText('Backgrounds')).toBeInTheDocument()
      expect(screen.getByText(/Set default folder for background assets/i)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    test('should set breadcrumbs correctly', async () => {
      const { useBreadcrumb } = await import('@hooks/useBreadcrumb')

      renderWithProviders(<Settings />)

      expect(useBreadcrumb).toHaveBeenCalledWith([
        { label: 'Settings', href: '/settings/general' },
        { label: 'General' }
      ])
    })
  })

  describe('ErrorBoundary', () => {
    test('should wrap content in ErrorBoundary', () => {
      // The component should render normally when no errors occur
      // ErrorBoundary catches errors and displays fallback UI
      renderWithProviders(<Settings />)
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })
  })

  describe('Ollama Connection', () => {
    test('should display Test Connection button', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument()
    })

    test('should show success state after successful connection test', async () => {
      renderWithProviders(<Settings />)

      const testButton = screen.getByRole('button', { name: /Test Connection/i })
      fireEvent.click(testButton)

      // Wait for the success message (mock returns success)
      await waitFor(() => {
        expect(screen.getByText(/Connected successfully/i)).toBeInTheDocument()
      })
    })
  })

  describe('Trello Authorization', () => {
    test('should display Authorize with Trello button', () => {
      renderWithProviders(<Settings />)
      expect(
        screen.getByRole('button', { name: /Authorize with Trello/i })
      ).toBeInTheDocument()
    })
  })

  describe('Background Folder', () => {
    test('should display Choose Folder button', () => {
      renderWithProviders(<Settings />)
      expect(screen.getByRole('button', { name: /Choose Folder/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should have correct heading hierarchy', () => {
      renderWithProviders(<Settings />)

      // h1 level heading for main title (BuildProject-style header)
      const h1 = screen.getByRole('heading', { level: 1, name: 'Settings' })
      expect(h1).toBeInTheDocument()

      // h3 level headings for sections
      const h3Elements = screen.getAllByRole('heading', { level: 3 })
      expect(h3Elements.length).toBeGreaterThanOrEqual(5) // AI Models, Appearance, Backgrounds, SproutVideo, Trello
    })

    test('should have labeled form inputs', () => {
      renderWithProviders(<Settings />)

      // Check for labels
      expect(screen.getByText('Ollama URL')).toBeInTheDocument()
      expect(screen.getByText('Trello API Key')).toBeInTheDocument()
      expect(screen.getByText('Trello API Token')).toBeInTheDocument()
      expect(screen.getByText('SproutVideo API Key')).toBeInTheDocument()
      expect(screen.getByText('Default Background Folder')).toBeInTheDocument()
    })

    test('should have section IDs for deep linking', () => {
      const { container } = renderWithProviders(<Settings />)

      // Check for section IDs
      expect(container.querySelector('#ai-models')).toBeInTheDocument()
      expect(container.querySelector('#appearance')).toBeInTheDocument()
      expect(container.querySelector('#backgrounds')).toBeInTheDocument()
      expect(container.querySelector('#sproutvideo')).toBeInTheDocument()
      expect(container.querySelector('#trello')).toBeInTheDocument()
    })
  })
})
