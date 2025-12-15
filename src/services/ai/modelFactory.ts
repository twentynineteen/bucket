/**
 * Model Factory
 * Feature: 006-i-wish-to
 * Purpose: Runtime model instantiation with provider switching
 */

import type { LanguageModel } from 'ai'

import type { ProviderConfiguration } from '@/types/scriptFormatter'

import { providerRegistry } from './providerConfig'
import type { ModelCreationOptions } from './types'

// ============================================================================
// Model Factory
// ============================================================================

export class ModelFactory {
  /**
   * Creates a language model instance for the specified provider and model
   */
  static createModel(options: ModelCreationOptions): LanguageModel {
    const { providerId, modelId, configuration } = options

    // Get provider adapter from registry
    const adapter = providerRegistry.get(providerId)

    if (!adapter) {
      throw new Error(
        `Provider "${providerId}" not found. Available providers: ${providerRegistry
          .list()
          .map((p) => p.id)
          .join(', ')}`
      )
    }

    // Validate configuration
    if (!configuration.serviceUrl) {
      throw new Error(`Service URL not configured for provider "${providerId}"`)
    }

    // Create model using adapter
    try {
      return adapter.createModel(modelId, configuration)
    } catch (error) {
      throw new Error(
        `Failed to create model "${modelId}" for provider "${providerId}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  /**
   * Validates if a provider is available and configured
   */
  static async validateProvider(
    providerId: string,
    configuration: ProviderConfiguration
  ): Promise<boolean> {
    const adapter = providerRegistry.get(providerId)

    if (!adapter) {
      return false
    }

    try {
      const result = await adapter.validateConnection(configuration)
      return result.success
    } catch {
      return false
    }
  }

  /**
   * Lists all available providers
   */
  static listProviders() {
    return providerRegistry.list()
  }

  /**
   * Gets a specific provider adapter
   */
  static getProvider(providerId: string) {
    return providerRegistry.get(providerId)
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Creates an Ollama model (Phase 1 shortcut)
 */
export function createOllamaModel(
  modelId: string,
  serviceUrl: string = 'http://localhost:11434'
): LanguageModel {
  return ModelFactory.createModel({
    providerId: 'ollama',
    modelId,
    configuration: {
      serviceUrl,
      connectionStatus: 'configured'
    }
  })
}

/**
 * Creates an OpenAI model (Phase 2 - future)
 */
export function createOpenAIModel(modelId: string, apiKey: string): LanguageModel {
  return ModelFactory.createModel({
    providerId: 'openai',
    modelId,
    configuration: {
      serviceUrl: 'https://api.openai.com',
      apiKey,
      connectionStatus: 'configured'
    }
  })
}
