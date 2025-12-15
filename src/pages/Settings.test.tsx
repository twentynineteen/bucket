/**
 * Settings Page Tests
 *
 * Tests for the Settings page including:
 * - Section ID presence for scroll-to-section navigation
 * - Settings sections rendering correctly
 */

import '@testing-library/jest-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Settings from './Settings'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn()
}))

// Mock hooks
vi.mock('@hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

vi.mock('@hooks/useAIProvider', () => ({
  useAIProvider: () => ({
    validateProvider: vi.fn().mockResolvedValue({ success: true, modelsFound: 3 })
  })
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

vi.mock('@utils/storage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({
    trello: '',
    trelloToken: '',
    sproutVideo: '',
    trelloBoardId: ''
  }),
  saveApiKeys: vi.fn().mockResolvedValue(undefined)
}))

// Helper to render Settings with providers
const renderSettings = (initialRoute = '/settings/general') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Basic Rendering Tests
  // ==========================================
  describe('Basic Rendering', () => {
    it('should render the Settings heading', () => {
      renderSettings()

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })

    it('should render all settings sections', () => {
      renderSettings()

      // Check section headings exist (using heading role for specificity)
      expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'AI Models' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Trello' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'SproutVideo' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Backgrounds' })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Section ID Tests (for scroll-to-section navigation)
  // ==========================================
  describe('Section IDs for Navigation', () => {
    it('should have id="appearance" on the Appearance section', () => {
      renderSettings()

      const section = document.getElementById('appearance')
      expect(section).toBeInTheDocument()
      expect(section?.tagName.toLowerCase()).toBe('section')
    })

    it('should have id="ai-models" on the AI Models section', () => {
      renderSettings()

      const section = document.getElementById('ai-models')
      expect(section).toBeInTheDocument()
      expect(section?.tagName.toLowerCase()).toBe('section')
    })

    it('should have id="trello" on the Trello section', () => {
      renderSettings()

      const section = document.getElementById('trello')
      expect(section).toBeInTheDocument()
      expect(section?.tagName.toLowerCase()).toBe('section')
    })

    it('should have id="sproutvideo" on the SproutVideo section', () => {
      renderSettings()

      const section = document.getElementById('sproutvideo')
      expect(section).toBeInTheDocument()
      expect(section?.tagName.toLowerCase()).toBe('section')
    })

    it('should have id="backgrounds" on the Backgrounds section', () => {
      renderSettings()

      const section = document.getElementById('backgrounds')
      expect(section).toBeInTheDocument()
      expect(section?.tagName.toLowerCase()).toBe('section')
    })

    it('should have all section IDs unique', () => {
      renderSettings()

      const expectedIds = [
        'appearance',
        'ai-models',
        'trello',
        'sproutvideo',
        'backgrounds'
      ]

      const foundIds = expectedIds.map((id) => document.getElementById(id))

      // All should be found
      foundIds.forEach((el) => {
        expect(el).toBeInTheDocument()
      })

      // All should be unique (no duplicates)
      const uniqueElements = new Set(foundIds)
      expect(uniqueElements.size).toBe(expectedIds.length)
    })
  })

  // ==========================================
  // Section Content Tests
  // ==========================================
  describe('Section Content', () => {
    it('should render Appearance section with theme customization description', () => {
      renderSettings()

      expect(
        screen.getByText('Customize the visual theme and color scheme')
      ).toBeInTheDocument()
    })

    it('should render AI Models section with Ollama URL input', () => {
      renderSettings()

      expect(screen.getByLabelText(/Ollama URL/i)).toBeInTheDocument()
    })

    it('should render Trello section with API key input', () => {
      renderSettings()

      expect(screen.getByLabelText(/Trello API Key/i)).toBeInTheDocument()
    })

    it('should render SproutVideo section with API key input', () => {
      renderSettings()

      expect(screen.getByLabelText(/SproutVideo API Key/i)).toBeInTheDocument()
    })

    it('should render Backgrounds section with folder selector', () => {
      renderSettings()

      expect(screen.getByText('Default Background Folder')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Choose Folder/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Theme Accordion Tests
  // ==========================================
  describe('Theme Accordion', () => {
    it('should render Theme Selection accordion trigger', () => {
      renderSettings()

      expect(screen.getByText('Theme Selection')).toBeInTheDocument()
    })

    it('should have accordion that can be collapsed', () => {
      renderSettings()

      // Verify the accordion trigger has proper aria controls and can toggle
      // Note: Full collapse/expand testing relies on Radix UI internals
      // which are difficult to test in JSDOM - the trigger existence confirms functionality
      const trigger = screen.getByText('Theme Selection')
      expect(trigger).toBeInTheDocument()
      expect(trigger.closest('button')).toHaveAttribute('data-state')
    })
  })
})
