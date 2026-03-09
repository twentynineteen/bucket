/**
 * Settings Contract Tests
 *
 * Verifies the shape and behavior of the Settings feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Settings I/O)
vi.mock('../api', () => ({
  openFolderPicker: vi.fn().mockResolvedValue(null),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  loadSettingsApiKeys: vi.fn().mockResolvedValue({}),
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined),
  validateAIConnection: vi
    .fn()
    .mockResolvedValue({ success: true, modelsFound: 3, latencyMs: 50 })
}))

// Mock cross-module dependencies
vi.mock('@features/Trello', () => ({
  TrelloBoardSelector: () => null
}))
vi.mock('@shared/ui/theme/ThemeSelector', () => ({
  ThemeSelector: () => null
}))

// Mock Tauri plugins (transitive dependencies)
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }))

// Mock shared dependencies
vi.mock('@shared/hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

vi.mock('@shared/store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      defaultBackgroundFolder: '/default/folder',
      setDefaultBackgroundFolder: vi.fn(),
      ollamaUrl: 'http://localhost:11434',
      setOllamaUrl: vi.fn()
    }
    return selector(state)
  })
}))

vi.mock('@shared/store', () => ({
  appStore: {
    getState: () => ({
      setSproutVideoApiKey: vi.fn(),
      setTrelloApiKey: vi.fn(),
      setTrelloApiToken: vi.fn(),
      setTrelloBoardId: vi.fn(),
      setOllamaUrl: vi.fn(),
      setDefaultBackgroundFolder: vi.fn()
    })
  },
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      defaultBackgroundFolder: '/default/folder',
      setDefaultBackgroundFolder: vi.fn(),
      ollamaUrl: 'http://localhost:11434',
      setOllamaUrl: vi.fn()
    }
    return selector(state)
  })
}))

vi.mock('@shared/utils/storage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({}),
  saveApiKeys: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  },
  createNamespacedLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('@shared/constants/timing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/constants/timing')>()
  return { ...actual }
})

vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    settings: {
      apiKeys: () => ['settings', 'apiKeys']
    }
  }
}))

vi.mock('@shared/lib/query-utils', () => ({
  createQueryOptions: (
    queryKey: unknown[],
    queryFn: () => Promise<unknown>,
    _profile: string,
    options?: Record<string, unknown>
  ) => ({
    queryKey,
    queryFn,
    ...options
  }),
  createQueryError: (msg: string) => new Error(msg),
  shouldRetry: () => false
}))

vi.mock('@services/ai/providerConfig', () => ({
  providerRegistry: {
    list: () => [
      {
        id: 'ollama',
        displayName: 'Ollama (Local)',
        type: 'ollama',
        validateConnection: vi
          .fn()
          .mockResolvedValue({ success: true, modelsFound: 3, latencyMs: 50 })
      }
    ],
    get: (id: string) => {
      if (id === 'ollama') {
        return {
          id: 'ollama',
          displayName: 'Ollama (Local)',
          type: 'ollama',
          validateConnection: vi
            .fn()
            .mockResolvedValue({ success: true, modelsFound: 3, latencyMs: 50 })
        }
      }
      return undefined
    }
  },
  getDefaultConfig: () => ({
    serviceUrl: 'http://localhost:11434',
    connectionStatus: 'not-configured',
    timeout: 5000
  })
}))

// Mock React Query
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockSetQueryData = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {},
    isLoading: false,
    error: null
  }),
  useMutation: () => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
    error: null
  }),
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: vi.fn()
  })
}))

import * as settingsBarrel from '../index'
import * as api from '../api'

// --- Shape Tests: Barrel ---

describe('Settings Barrel Exports - Shape', () => {
  const expectedExports = ['Settings', 'useAIProvider'].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    const exportNames = Object.keys(settingsBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('Settings is a valid React component', () => {
    expect(typeof settingsBarrel.Settings).toBe('function')
  })

  it('useAIProvider is a function', () => {
    expect(typeof settingsBarrel.useAIProvider).toBe('function')
  })
})

// --- Shape Tests: API Layer ---

describe('Settings API Layer - Shape', () => {
  const expectedFunctions = [
    'openFolderPicker',
    'openExternalUrl',
    'loadSettingsApiKeys',
    'saveSettingsApiKeys',
    'validateAIConnection'
  ]

  it('exports all expected functions', () => {
    expectedFunctions.forEach((name) => {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function')
    })
  })
})

// --- Behavioral Tests: useAIProvider ---

describe('Settings useAIProvider - Behavior', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => settingsBarrel.useAIProvider())

    expect(result.current).toHaveProperty('activeProvider')
    expect(result.current).toHaveProperty('availableProviders')
    expect(result.current).toHaveProperty('switchProvider')
    expect(result.current).toHaveProperty('validateProvider')
    expect(result.current).toHaveProperty('updateProviderConfig')
  })

  it('availableProviders is an array', () => {
    const { result } = renderHook(() => settingsBarrel.useAIProvider())
    expect(Array.isArray(result.current.availableProviders)).toBe(true)
  })

  it('validateProvider is a callable async function', () => {
    const { result } = renderHook(() => settingsBarrel.useAIProvider())

    expect(typeof result.current.validateProvider).toBe('function')
    // validateProvider returns a Promise (async function)
    const returned = result.current.validateProvider('ollama', {
      serviceUrl: 'http://localhost:11434',
      connectionStatus: 'not-configured',
      timeout: 5000
    })
    expect(returned).toBeInstanceOf(Promise)
  })
})

// --- Behavioral Tests: useSettingsScroll ---

describe('Settings useSettingsScroll - Behavior', () => {
  it('hook renders without error', async () => {
    // Dynamic import to avoid hoisting issues with MemoryRouter
    const { MemoryRouter } = await import('react-router-dom')
    const React = await import('react')
    const { useSettingsScroll } = await import('../hooks/useSettingsScroll')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(MemoryRouter, null, children)

    const { result } = renderHook(() => useSettingsScroll(), { wrapper })

    // Hook returns void, just verify it doesn't throw
    expect(result.current).toBeUndefined()
  })
})

// --- Sub-component Render Tests ---

describe('Settings Sub-components - Render', () => {
  const mockApiKeys = {
    sproutVideo: '',
    trello: '',
    trelloToken: '',
    trelloBoardId: '',
    ollamaUrl: 'http://localhost:11434',
    defaultBackgroundFolder: ''
  }

  it('AIModelsSection renders with correct section id', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const { MemoryRouter } = await import('react-router-dom')
    const { default: AIModelsSection } = await import('../components/AIModelsSection')

    const { container } = render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(AIModelsSection, { apiKeys: mockApiKeys })
      )
    )

    const section = container.querySelector('#ai-models')
    expect(section).not.toBeNull()
    expect(section?.tagName.toLowerCase()).toBe('section')
  })

  it('AppearanceSection renders with correct section id', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const { default: AppearanceSection } = await import('../components/AppearanceSection')

    const { container } = render(React.createElement(AppearanceSection))

    const section = container.querySelector('#appearance')
    expect(section).not.toBeNull()
    expect(section?.tagName.toLowerCase()).toBe('section')
  })

  it('BackgroundsSection renders with correct section id', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const { default: BackgroundsSection } = await import(
      '../components/BackgroundsSection'
    )

    const { container } = render(
      React.createElement(BackgroundsSection, { apiKeys: mockApiKeys })
    )

    const section = container.querySelector('#backgrounds')
    expect(section).not.toBeNull()
    expect(section?.tagName.toLowerCase()).toBe('section')
  })

  it('SproutVideoSection renders with correct section id', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const { default: SproutVideoSection } = await import(
      '../components/SproutVideoSection'
    )

    const { container } = render(
      React.createElement(SproutVideoSection, { apiKeys: mockApiKeys })
    )

    const section = container.querySelector('#sproutvideo')
    expect(section).not.toBeNull()
    expect(section?.tagName.toLowerCase()).toBe('section')
  })

  it('TrelloSection renders with correct section id', async () => {
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const { MemoryRouter } = await import('react-router-dom')
    const { default: TrelloSection } = await import('../components/TrelloSection')

    const { container } = render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(TrelloSection, { apiKeys: mockApiKeys })
      )
    )

    const section = container.querySelector('#trello')
    expect(section).not.toBeNull()
    expect(section?.tagName.toLowerCase()).toBe('section')
  })
})
