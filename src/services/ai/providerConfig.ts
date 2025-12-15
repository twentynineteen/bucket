/**
 * AI Provider Configuration
 * Feature: 006-i-wish-to
 * Purpose: Provider registry and configuration management
 * Follows Vercel AI SDK v5 pattern for custom provider integration
 */

// import { createOpenAI } from '@ai-sdk/openai' // Commented out for Phase 1
import { SECONDS, TIMEOUTS } from '@constants/timing'
import type { ProviderConfiguration } from '@types/scriptFormatter'
import { createNamespacedLogger } from '@utils/logger'
import type { LanguageModel } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'

import { logger } from '@/utils/logger'

import type { ModelInfo, ProviderAdapter, ProviderRegistry } from './types'

const logger = createNamespacedLogger('Ollama')

// ============================================================================
// Ollama Provider Adapter
// ============================================================================

const ollamaAdapter: ProviderAdapter = {
  id: 'ollama',
  type: 'ollama',
  displayName: 'Ollama (Local)',

  createModel(modelId: string, config: ProviderConfiguration): LanguageModel {
    // Create Ollama provider instance with baseURL
    // Note: ollama-ai-provider-v2 expects baseURL WITH /api suffix
    let baseUrl = config.serviceUrl || 'http://localhost:11434'

    // Normalize URL: remove trailing slashes and ensure no /api suffix
    baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '')

    logger.log('Creating model with baseURL:', `${baseUrl}/api`)

    // Custom fetch with extended timeout for AI generation (5 minutes)
    const customFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      const timeout = 300000 // 5 minutes for AI generation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // Merge signals: abort if either the timeout or the passed signal is aborted
      const existingSignal = init?.signal
      if (existingSignal) {
        // If the existing signal is already aborted, abort immediately
        if (existingSignal.aborted) {
          controller.abort()
        } else {
          // Listen for abort from the existing signal
          existingSignal.addEventListener('abort', () => controller.abort())
        }
      }

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }

    const ollama = createOllama({
      baseURL: `${baseUrl}/api`,
      fetch: customFetch
    })

    // Return the model instance
    // Note: num_ctx and other Ollama options are set via providerOptions in streamText
    return ollama(modelId)
  },

  async validateConnection(config: ProviderConfiguration) {
    const start = Date.now()

    try {
      // Normalize URL
      let baseUrl = config.serviceUrl || 'http://localhost:11434'
      baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '')
      const apiUrl = `${baseUrl}/api/tags`

      logger.log('Validating connection to:', apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeout || 5000)
      })

      if (!response.ok) {
        logger.error('[Ollama] Validation failed:', response.status, response.statusText)
        return {
          success: false,
          errorMessage: `HTTP ${response.status}: ${response.statusText}. Check if Ollama is running at ${baseUrl}`,
          modelsFound: 0,
          latencyMs: Date.now() - start
        }
      }

      const data = await response.json()

      logger.log('Validation successful. Models found:', data.models?.length || 0)

      return {
        success: true,
        modelsFound: data.models?.length || 0,
        latencyMs: Date.now() - start
      }
    } catch (error) {
      logger.error('[Ollama] Validation error:', error)
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        modelsFound: 0,
        latencyMs: Date.now() - start
      }
    }
  },

  async listModels(config: ProviderConfiguration): Promise<ModelInfo[]> {
    try {
      // Normalize URL
      let baseUrl = config.serviceUrl || 'http://localhost:11434'
      baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '')
      const apiUrl = `${baseUrl}/api/tags`

      logger.log('Fetching models from:', apiUrl)

      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(config.timeout || 5000)
      })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch models: HTTP ${response.status}. Check if Ollama is running at ${baseUrl}`
        )
      }

      const data = (await response.json()) as {
        models?: Array<{
          name: string
          size: number
          details?: { parameter_size?: number }
        }>
      }

      logger.log('Models fetched:', data.models?.length || 0)

      return (data.models || []).map((model) => ({
        id: model.name,
        name: model.name.replace(':latest', ''),
        size: String(model.size),
        contextLength: model.details?.parameter_size || 4096,
        // Tool calling support detection
        supportsToolCalling: ['llama3', 'mistral', 'qwen'].some((name) =>
          model.name.toLowerCase().includes(name)
        ),
        supportsStreaming: true // All Ollama models support streaming
      }))
    } catch (error) {
      logger.error('[Ollama] Failed to list models:', error)
      throw new Error(
        `Failed to list Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

// ============================================================================
// OpenAI Provider Adapter (Future Phase 2)
// ============================================================================

// Commented out for Phase 1 - will be enabled in Phase 2
/* const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  type: 'openai',
  displayName: 'OpenAI',

  createModel(modelId: string, config: ProviderConfiguration): LanguageModel {
    const openai = createOpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.serviceUrl,
    })
    return openai(modelId)
  },

  async validateConnection(config: ProviderConfiguration) {
    const start = Date.now()

    try {
      const response = await fetch(`${config.serviceUrl || 'https://api.openai.com'}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(config.timeout || 5000),
      })

      if (!response.ok) {
        return {
          success: false,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          modelsFound: 0,
          latencyMs: Date.now() - start,
        }
      }

      const data = await response.json()

      return {
        success: true,
        modelsFound: data.data?.length || 0,
        latencyMs: Date.now() - start,
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        modelsFound: 0,
        latencyMs: Date.now() - start,
      }
    }
  },

  async listModels(config: ProviderConfiguration): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${config.serviceUrl || 'https://api.openai.com'}/v1/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(config.timeout || 5000),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch models: HTTP ${response.status}`)
      }

      interface OpenAIModel {
        id: string
        object: string
        created: number
        owned_by: string
      }

      interface OpenAIModelsResponse {
        data: OpenAIModel[]
        object: string
      }

      const data = await response.json() as OpenAIModelsResponse

      return (data.data || [])
        .filter((model) => model.id.startsWith('gpt-')) // Only GPT models
        .map((model) => ({
          id: model.id,
          name: model.id,
          contextLength: 128000, // GPT-4 context
          supportsToolCalling: true,
          supportsStreaming: true,
        }))
    } catch (error) {
      throw new Error(
        `Failed to list OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  },
} */

// ============================================================================
// Provider Registry Implementation
// ============================================================================

class ProviderRegistryImpl implements ProviderRegistry {
  providers: Map<string, ProviderAdapter> = new Map()

  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.id, adapter)
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.providers.get(providerId)
  }

  list(): ProviderAdapter[] {
    return Array.from(this.providers.values())
  }
}

// ============================================================================
// Global Registry Instance
// ============================================================================

export const providerRegistry = new ProviderRegistryImpl()

// Register Phase 1 providers
providerRegistry.register(ollamaAdapter)

// Register Phase 2 providers (disabled by default, enable when needed)
// providerRegistry.register(openaiAdapter)

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_PROVIDER_CONFIGS: Record<string, Partial<ProviderConfiguration>> = {
  ollama: {
    serviceUrl: 'http://localhost:11434',
    connectionStatus: 'not-configured',
    timeout: 5 * SECONDS
  },
  openai: {
    serviceUrl: 'https://api.openai.com',
    connectionStatus: 'not-configured',
    timeout: TIMEOUTS.DEFAULT
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getDefaultConfig(providerId: string): ProviderConfiguration {
  const defaults = DEFAULT_PROVIDER_CONFIGS[providerId] || {}
  return {
    serviceUrl: defaults.serviceUrl || '',
    connectionStatus: 'not-configured',
    timeout: defaults.timeout || 5 * SECONDS,
    ...defaults
  } as ProviderConfiguration
}

export function isProviderConfigured(config: ProviderConfiguration): boolean {
  return config.connectionStatus === 'configured' && config.serviceUrl.length > 0
}
