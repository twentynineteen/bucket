/**
 * Integration Test: US-09 — Settings: API Key Management
 *
 * As a user, when I navigate to /settings/general, I can configure API keys
 * for Trello, Sprout Video, and AI providers, and the app persists them securely.
 *
 * Tests the useAIProvider hook and Settings api.ts layer.
 * Mocking strategy: mock the Settings api.ts module; no direct @tauri-apps imports.
 */

import { useAIProvider } from '../../src/features/Settings/hooks/useAIProvider'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Settings api.ts layer (single I/O boundary for Settings module)
vi.mock('../../src/features/Settings/api', () => ({
  openFolderPicker: vi.fn().mockResolvedValue('/selected/folder'),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  loadSettingsApiKeys: vi.fn().mockResolvedValue({
    trelloApiKey: '',
    trelloApiToken: '',
    sproutApiKey: ''
  }),
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined),
  validateAIConnection: vi.fn().mockResolvedValue({
    success: true,
    latencyMs: 42,
    modelsFound: 3
  })
}))

// Mock the AI provider registry so we control what providers are returned
vi.mock('@shared/services/ai/providerConfig', () => ({
  providerRegistry: {
    list: vi.fn().mockReturnValue([
      {
        id: 'ollama',
        type: 'ollama',
        displayName: 'Ollama (Local)',
        validateConnection: vi.fn().mockResolvedValue({
          success: true,
          latencyMs: 12,
          modelsFound: 2
        })
      },
      {
        id: 'openai',
        type: 'openai',
        displayName: 'OpenAI',
        validateConnection: vi.fn().mockResolvedValue({
          success: true,
          latencyMs: 80,
          modelsFound: 5
        })
      }
    ]),
    get: vi.fn().mockImplementation((id: string) => {
      const providers: Record<string, any> = {
        ollama: {
          id: 'ollama',
          displayName: 'Ollama (Local)',
          validateConnection: vi.fn().mockResolvedValue({
            success: true,
            latencyMs: 12,
            modelsFound: 2
          })
        },
        openai: {
          id: 'openai',
          displayName: 'OpenAI',
          validateConnection: vi.fn().mockResolvedValue({
            success: true,
            latencyMs: 80,
            modelsFound: 5
          })
        }
      }
      return providers[id] || null
    })
  },
  getDefaultConfig: vi.fn().mockImplementation((id: string) => ({
    apiKey: '',
    serviceUrl: id === 'ollama' ? 'http://localhost:11434' : undefined,
    connectionStatus: 'not-configured'
  }))
}))

// Mock the Zustand appStore (useAIProvider reads ollamaUrl from it)
vi.mock('@shared/store', () => ({
  useAppStore: vi.fn().mockImplementation((selector: any) =>
    selector({
      ollamaUrl: null,
      setOllamaUrl: vi.fn()
    })
  )
}))

// Shared mock return values (re-applied in beforeEach due to mockReset: true)
const MOCK_PROVIDERS = [
  {
    id: 'ollama',
    type: 'ollama',
    displayName: 'Ollama (Local)',
    validateConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 12, modelsFound: 2 })
  },
  {
    id: 'openai',
    type: 'openai',
    displayName: 'OpenAI',
    validateConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 80, modelsFound: 5 })
  }
]

// ============================================================================
// US-09: Settings / AI Provider Management
// ============================================================================

describe('US-09 — Settings: AI Provider Management', () => {
  beforeEach(async () => {
    // Clear localStorage between tests
    localStorage.clear()

    // mockReset: true clears implementations between tests — restore them here
    const { providerRegistry, getDefaultConfig } = await import('@shared/services/ai/providerConfig')
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(providerRegistry.list).mockReturnValue(MOCK_PROVIDERS as any)
    vi.mocked(providerRegistry.get).mockImplementation((id: string) =>
      MOCK_PROVIDERS.find((p) => p.id === id) as any ?? null
    )
    vi.mocked(getDefaultConfig).mockImplementation((id: string) => ({
      apiKey: '',
      serviceUrl: id === 'ollama' ? 'http://localhost:11434' : undefined,
      connectionStatus: 'not-configured'
    }))
    vi.mocked(validateAIConnection).mockResolvedValue({
      success: true,
      latencyMs: 42,
      modelsFound: 3
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should initialize with available providers from the registry', () => {
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.availableProviders).toHaveLength(2)
    expect(result.current.availableProviders[0].id).toBe('ollama')
    expect(result.current.availableProviders[1].id).toBe('openai')
  })

  it('should default to the first provider (Ollama) when no saved state', () => {
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.activeProvider).not.toBeNull()
    expect(result.current.activeProvider?.id).toBe('ollama')
  })

  it('US-09a — should return required hook interface properties', () => {
    const { result } = renderHook(() => useAIProvider())

    expect(typeof result.current.switchProvider).toBe('function')
    expect(typeof result.current.validateProvider).toBe('function')
    expect(typeof result.current.updateProviderConfig).toBe('function')
    expect(Array.isArray(result.current.availableProviders)).toBe(true)
  })

  it('US-09b — should switch active provider by ID', () => {
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.activeProvider?.id).toBe('ollama')

    act(() => {
      result.current.switchProvider('openai')
    })

    expect(result.current.activeProvider?.id).toBe('openai')
    expect(result.current.activeProvider?.displayName).toBe('OpenAI')
  })

  it('US-09c — should persist active provider selection to localStorage', () => {
    const { result } = renderHook(() => useAIProvider())

    act(() => {
      result.current.switchProvider('openai')
    })

    // Provider should be persisted in localStorage using the correct storage key
    const savedProvider = localStorage.getItem('autocue:active-provider')
    expect(savedProvider).toBe('openai')
  })

  it('US-09d — should restore active provider from localStorage on init', () => {
    // Pre-seed localStorage with a saved provider using the correct storage key
    localStorage.setItem('autocue:active-provider', 'openai')

    const { result } = renderHook(() => useAIProvider())

    expect(result.current.activeProvider?.id).toBe('openai')
  })

  it('US-09e — should validate provider connection and return success result', async () => {
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(validateAIConnection).mockResolvedValue({
      success: true,
      latencyMs: 45,
      modelsFound: 3
    })

    const { result } = renderHook(() => useAIProvider())

    let validationResult: any

    await act(async () => {
      validationResult = await result.current.validateProvider('ollama', {
        apiKey: '',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    expect(validationResult.success).toBe(true)
    expect(validationResult.latencyMs).toBe(45)
    expect(validationResult.modelsFound).toBe(3)
  })

  it('US-09f — should update provider status to configured on successful validation', async () => {
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(validateAIConnection).mockResolvedValue({
      success: true,
      latencyMs: 20,
      modelsFound: 2
    })

    const { result } = renderHook(() => useAIProvider())

    await act(async () => {
      await result.current.validateProvider('ollama', {
        apiKey: '',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    await waitFor(() => {
      const ollamaProvider = result.current.availableProviders.find((p) => p.id === 'ollama')
      expect(ollamaProvider?.status).toBe('configured')
    })
  })

  it('US-09g — should update provider status to error on failed validation', async () => {
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(validateAIConnection).mockResolvedValue({
      success: false,
      errorMessage: 'Connection refused'
    })

    const { result } = renderHook(() => useAIProvider())

    await act(async () => {
      await result.current.validateProvider('ollama', {
        apiKey: '',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    await waitFor(() => {
      const ollamaProvider = result.current.availableProviders.find((p) => p.id === 'ollama')
      expect(ollamaProvider?.status).toBe('error')
    })
  })

  it('US-09h — should handle unknown provider ID gracefully in validateProvider', async () => {
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(validateAIConnection).mockResolvedValue({
      success: false,
      errorMessage: 'Provider "nonexistent" not found'
    })

    const { result } = renderHook(() => useAIProvider())

    let validationResult: any

    await act(async () => {
      validationResult = await result.current.validateProvider('nonexistent', {
        apiKey: 'some-key',
        connectionStatus: 'not-configured'
      })
    })

    expect(validationResult.success).toBe(false)
    expect(validationResult.errorMessage).toContain('not found')
  })

  it('US-09i — should update provider configuration without switching active provider', () => {
    const { result } = renderHook(() => useAIProvider())

    act(() => {
      result.current.updateProviderConfig('ollama', {
        apiKey: 'new-key',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    const ollamaProvider = result.current.availableProviders.find((p) => p.id === 'ollama')
    expect(ollamaProvider?.configuration.apiKey).toBe('new-key')
    // Active provider should still be ollama (unchanged)
    expect(result.current.activeProvider?.id).toBe('ollama')
  })

  it('US-09j — should persist provider config to localStorage when active provider config is updated', () => {
    const { result } = renderHook(() => useAIProvider())

    // Active provider is ollama by default
    act(() => {
      result.current.updateProviderConfig('ollama', {
        apiKey: 'persisted-key',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    const storedConfig = localStorage.getItem('autocue:provider-config')
    expect(storedConfig).not.toBeNull()
    const parsed = JSON.parse(storedConfig!)
    expect(parsed.apiKey).toBe('persisted-key')
  })

  it('US-09k — should handle validateProvider network error gracefully', async () => {
    const { validateAIConnection } = await import('../../src/features/Settings/api')

    vi.mocked(validateAIConnection).mockRejectedValue(new Error('Network timeout'))

    const { result } = renderHook(() => useAIProvider())

    let validationResult: any

    await act(async () => {
      validationResult = await result.current.validateProvider('ollama', {
        apiKey: '',
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'not-configured'
      })
    })

    // Should return failure rather than throwing
    expect(validationResult.success).toBe(false)
    expect(validationResult.errorMessage).toBe('Network timeout')
  })

  it('US-09l — should list providers with correct display names', () => {
    const { result } = renderHook(() => useAIProvider())

    const ollama = result.current.availableProviders.find((p) => p.id === 'ollama')
    const openai = result.current.availableProviders.find((p) => p.id === 'openai')

    expect(ollama?.displayName).toBe('Ollama (Local)')
    expect(openai?.displayName).toBe('OpenAI')
  })

  it('should not switch to unknown provider ID', () => {
    const { result } = renderHook(() => useAIProvider())

    const initialProvider = result.current.activeProvider

    act(() => {
      result.current.switchProvider('nonexistent-provider')
    })

    // Active provider should remain unchanged
    expect(result.current.activeProvider?.id).toBe(initialProvider?.id)
  })
})
