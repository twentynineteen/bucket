/**
 * ModelFactory Service Tests
 * Feature: 006-i-wish-to
 * Purpose: Test provider-agnostic model creation and validation
 */

import {
  createOllamaModel,
  createOpenAIModel,
  ModelFactory
} from '@/services/ai/modelFactory'
import { providerRegistry } from '@/services/ai/providerConfig'
import type { ConnectionValidationResult, ProviderAdapter } from '@/services/ai/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the provider registry
vi.mock('@/services/ai/providerConfig', () => ({
  providerRegistry: {
    get: vi.fn(),
    list: vi.fn(),
    register: vi.fn()
  }
}))

describe('ModelFactory', () => {
  // Mock provider adapter
  const mockOllamaAdapter: ProviderAdapter = {
    id: 'ollama',
    type: 'ollama' as const,
    displayName: 'Ollama',
    createModel: vi.fn(),
    validateConnection: vi.fn(),
    listModels: vi.fn()
  }

  const mockOpenAIAdapter: ProviderAdapter = {
    id: 'openai',
    type: 'openai' as const,
    displayName: 'OpenAI',
    createModel: vi.fn(),
    validateConnection: vi.fn(),
    listModels: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // createModel() Tests
  // ============================================================================

  describe('createModel', () => {
    it('should create a model when provider is registered and configured', () => {
      const mockModel = { id: 'llama3.1' } as any
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.createModel).mockReturnValue(mockModel)

      const result = ModelFactory.createModel({
        providerId: 'ollama',
        modelId: 'llama3.1',
        configuration: {
          serviceUrl: 'http://localhost:11434',
          connectionStatus: 'configured'
        }
      })

      expect(providerRegistry.get).toHaveBeenCalledWith('ollama')
      expect(mockOllamaAdapter.createModel).toHaveBeenCalledWith('llama3.1', {
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })
      expect(result).toBe(mockModel)
    })

    it('should throw error when provider is not found', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(undefined)
      vi.mocked(providerRegistry.list).mockReturnValue([mockOllamaAdapter])

      expect(() =>
        ModelFactory.createModel({
          providerId: 'nonexistent',
          modelId: 'test-model',
          configuration: {
            serviceUrl: 'http://localhost:11434',
            connectionStatus: 'configured'
          }
        })
      ).toThrow('Provider "nonexistent" not found. Available providers: ollama')
    })

    it('should throw error when service URL is not configured', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)

      expect(() =>
        ModelFactory.createModel({
          providerId: 'ollama',
          modelId: 'llama3.1',
          configuration: { connectionStatus: 'unconfigured' } as any
        })
      ).toThrow('Service URL not configured for provider "ollama"')
    })

    it('should wrap adapter errors with detailed error message', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.createModel).mockImplementation(() => {
        throw new Error('Network timeout')
      })

      expect(() =>
        ModelFactory.createModel({
          providerId: 'ollama',
          modelId: 'llama3.1',
          configuration: {
            serviceUrl: 'http://localhost:11434',
            connectionStatus: 'configured'
          }
        })
      ).toThrow(
        'Failed to create model "llama3.1" for provider "ollama": Network timeout'
      )
    })

    it('should handle non-Error exceptions from adapter', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.createModel).mockImplementation(() => {
        throw 'String error'
      })

      expect(() =>
        ModelFactory.createModel({
          providerId: 'ollama',
          modelId: 'llama3.1',
          configuration: {
            serviceUrl: 'http://localhost:11434',
            connectionStatus: 'configured'
          }
        })
      ).toThrow('Failed to create model "llama3.1" for provider "ollama": Unknown error')
    })

    it('should pass configuration with optional fields to adapter', () => {
      const mockModel = { id: 'gpt-4' } as any
      vi.mocked(providerRegistry.get).mockReturnValue(mockOpenAIAdapter)
      vi.mocked(mockOpenAIAdapter.createModel).mockReturnValue(mockModel)

      ModelFactory.createModel({
        providerId: 'openai',
        modelId: 'gpt-4',
        configuration: {
          serviceUrl: 'https://api.openai.com',
          apiKey: 'sk-test-key',
          connectionStatus: 'configured'
        }
      })

      expect(mockOpenAIAdapter.createModel).toHaveBeenCalledWith('gpt-4', {
        serviceUrl: 'https://api.openai.com',
        apiKey: 'sk-test-key',
        connectionStatus: 'configured'
      })
    })
  })

  // ============================================================================
  // validateProvider() Tests
  // ============================================================================

  describe('validateProvider', () => {
    it('should return true when provider validation succeeds', async () => {
      const mockValidationResult: ConnectionValidationResult = {
        success: true,
        modelsFound: 5,
        latencyMs: 120
      }

      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.validateConnection).mockResolvedValue(
        mockValidationResult
      )

      const result = await ModelFactory.validateProvider('ollama', {
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })

      expect(result).toBe(true)
      expect(mockOllamaAdapter.validateConnection).toHaveBeenCalledWith({
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })
    })

    it('should return false when provider validation fails', async () => {
      const mockValidationResult: ConnectionValidationResult = {
        success: false,
        errorMessage: 'Connection refused',
        modelsFound: 0,
        latencyMs: 0
      }

      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.validateConnection).mockResolvedValue(
        mockValidationResult
      )

      const result = await ModelFactory.validateProvider('ollama', {
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })

      expect(result).toBe(false)
    })

    it('should return false when provider is not found', async () => {
      vi.mocked(providerRegistry.get).mockReturnValue(undefined)

      const result = await ModelFactory.validateProvider('nonexistent', {})

      expect(result).toBe(false)
    })

    it('should return false when validation throws an error', async () => {
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.validateConnection).mockRejectedValue(
        new Error('Network error')
      )

      const result = await ModelFactory.validateProvider('ollama', {
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // listProviders() Tests
  // ============================================================================

  describe('listProviders', () => {
    it('should return list of all registered providers', () => {
      const mockProviders = [mockOllamaAdapter, mockOpenAIAdapter]
      vi.mocked(providerRegistry.list).mockReturnValue(mockProviders)

      const result = ModelFactory.listProviders()

      expect(result).toEqual(mockProviders)
      expect(providerRegistry.list).toHaveBeenCalled()
    })

    it('should return empty array when no providers are registered', () => {
      vi.mocked(providerRegistry.list).mockReturnValue([])

      const result = ModelFactory.listProviders()

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // getProvider() Tests
  // ============================================================================

  describe('getProvider', () => {
    it('should return provider adapter when found', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)

      const result = ModelFactory.getProvider('ollama')

      expect(result).toBe(mockOllamaAdapter)
      expect(providerRegistry.get).toHaveBeenCalledWith('ollama')
    })

    it('should return undefined when provider not found', () => {
      vi.mocked(providerRegistry.get).mockReturnValue(undefined)

      const result = ModelFactory.getProvider('nonexistent')

      expect(result).toBeUndefined()
    })
  })

  // ============================================================================
  // Convenience Functions Tests
  // ============================================================================

  describe('createOllamaModel', () => {
    it('should create Ollama model with default service URL', () => {
      const mockModel = { id: 'llama3.1' } as any
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.createModel).mockReturnValue(mockModel)

      const result = createOllamaModel('llama3.1')

      expect(mockOllamaAdapter.createModel).toHaveBeenCalledWith('llama3.1', {
        serviceUrl: 'http://localhost:11434',
        connectionStatus: 'configured'
      })
      expect(result).toBe(mockModel)
    })

    it('should create Ollama model with custom service URL', () => {
      const mockModel = { id: 'llama3.1' } as any
      vi.mocked(providerRegistry.get).mockReturnValue(mockOllamaAdapter)
      vi.mocked(mockOllamaAdapter.createModel).mockReturnValue(mockModel)

      const result = createOllamaModel('llama3.1', 'http://192.168.1.100:11434')

      expect(mockOllamaAdapter.createModel).toHaveBeenCalledWith('llama3.1', {
        serviceUrl: 'http://192.168.1.100:11434',
        connectionStatus: 'configured'
      })
      expect(result).toBe(mockModel)
    })
  })

  describe('createOpenAIModel', () => {
    it('should create OpenAI model with API key', () => {
      const mockModel = { id: 'gpt-4' } as any
      vi.mocked(providerRegistry.get).mockReturnValue(mockOpenAIAdapter)
      vi.mocked(mockOpenAIAdapter.createModel).mockReturnValue(mockModel)

      const result = createOpenAIModel('gpt-4', 'sk-test-api-key')

      expect(mockOpenAIAdapter.createModel).toHaveBeenCalledWith('gpt-4', {
        serviceUrl: 'https://api.openai.com',
        apiKey: 'sk-test-api-key',
        connectionStatus: 'configured'
      })
      expect(result).toBe(mockModel)
    })
  })
})
