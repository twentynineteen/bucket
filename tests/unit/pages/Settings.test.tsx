/**
 * Tests for Settings page - Trello board configuration
 *
 * NOTE: DEBT-014 tests for text input board ID have been removed.
 * The Trello board selection was implemented as a TrelloBoardSelector dropdown component
 * that fetches boards from the Trello API and auto-saves the selection.
 * See TrelloBoardSelector component tests for dropdown-specific behavior.
 */

import Settings from '@/pages/Settings'
import * as storage from '@/utils/storage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn()
}))

// Mock storage utilities
vi.mock('@/utils/storage', () => ({
  loadApiKeys: vi.fn(),
  saveApiKeys: vi.fn()
}))

// Mock hooks
vi.mock('@/hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

vi.mock('@/hooks/useAIProvider', () => ({
  useAIProvider: vi.fn(() => ({
    validateProvider: vi.fn()
  }))
}))

// Mock app store
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const mockState = {
      defaultBackgroundFolder: '',
      setDefaultBackgroundFolder: vi.fn(),
      ollamaUrl: 'http://localhost:11434',
      setOllamaUrl: vi.fn()
    }
    return selector ? selector(mockState) : mockState
  }),
  appStore: {
    getState: vi.fn(() => ({
      defaultBackgroundFolder: '',
      setDefaultBackgroundFolder: vi.fn(),
      ollamaUrl: 'http://localhost:11434',
      setOllamaUrl: vi.fn()
    }))
  }
}))

describe('Settings Page', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
    vi.mocked(storage.loadApiKeys).mockResolvedValue({})
    vi.mocked(storage.saveApiKeys).mockResolvedValue()
  })

  const renderSettings = () => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Settings />
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  describe('Basic Rendering', () => {
    it('should render Settings page title', async () => {
      renderSettings()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
      })
    })

    it('should render Trello section', async () => {
      renderSettings()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^trello$/i })).toBeInTheDocument()
      })
    })

    it('should render SproutVideo section', async () => {
      renderSettings()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /sproutvideo/i })).toBeInTheDocument()
      })
    })
  })
})
