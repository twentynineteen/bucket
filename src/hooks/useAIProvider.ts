/**
 * useAIProvider Hook
 * Feature: 006-i-wish-to (T040)
 * Purpose: Provider management and switching (provider-agnostic architecture)
 */

import { getDefaultConfig, providerRegistry } from '@services/ai/providerConfig'
import { useAppStore } from '@store/useAppStore'
import { useState } from 'react'

import {
  STORAGE_KEYS,
  type AIProvider,
  type ProviderConfiguration
} from '@/types/scriptFormatter'

interface UseAIProviderResult {
  activeProvider: AIProvider | null
  availableProviders: AIProvider[]
  switchProvider: (providerId: string) => void
  validateProvider: (
    providerId: string,
    config: ProviderConfiguration
  ) => Promise<{
    success: boolean
    latencyMs?: number
    errorMessage?: string
    modelsFound?: number
  }>
  updateProviderConfig: (providerId: string, config: ProviderConfiguration) => void
}

export function useAIProvider(): UseAIProviderResult {
  const ollamaUrl = useAppStore((state) => state.ollamaUrl)

  // Initialize providers immediately
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>(() => {
    const adapters = providerRegistry.list()
    return adapters.map((adapter) => {
      const config = getDefaultConfig(adapter.id)
      // Use stored Ollama URL if this is the Ollama provider
      if (adapter.id === 'ollama' && ollamaUrl) {
        config.serviceUrl = ollamaUrl
      }
      return {
        id: adapter.id,
        displayName: adapter.displayName,
        type: adapter.type,
        status: 'not-configured',
        configuration: config
      }
    })
  })

  // Initialize active provider from localStorage or default
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(() => {
    const savedProviderId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROVIDER)
    const savedConfig = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG)

    const providers = providerRegistry.list().map((adapter) => {
      const config = getDefaultConfig(adapter.id)
      // Use stored Ollama URL if this is the Ollama provider
      if (adapter.id === 'ollama' && ollamaUrl) {
        config.serviceUrl = ollamaUrl
      }
      return {
        id: adapter.id,
        displayName: adapter.displayName,
        type: adapter.type,
        status: 'not-configured' as const,
        configuration: config
      }
    })

    if (savedProviderId) {
      const provider = providers.find((p) => p.id === savedProviderId)
      if (provider) {
        if (savedConfig) {
          try {
            provider.configuration = JSON.parse(savedConfig)
          } catch {
            // Use default config
          }
        }
        return provider
      }
    }

    // Default to first provider (Ollama)
    return providers[0] || null
  })

  const switchProvider = (providerId: string) => {
    const provider = availableProviders.find((p) => p.id === providerId)
    if (provider) {
      setActiveProvider(provider)
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, providerId)
    }
  }

  const validateProvider = async (providerId: string, config: ProviderConfiguration) => {
    try {
      const adapter = providerRegistry.get(providerId)
      if (!adapter) {
        return {
          success: false,
          errorMessage: `Provider "${providerId}" not found`
        }
      }

      const result = await adapter.validateConnection(config)

      // Update provider status
      setAvailableProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                status: result.success ? 'configured' : 'error',
                configuration: {
                  ...config,
                  connectionStatus: result.success ? 'configured' : 'error',
                  lastValidationTimestamp: new Date(),
                  lastValidationResult: {
                    success: result.success,
                    errorMessage: result.errorMessage,
                    modelsFound: result.modelsFound,
                    latencyMs: result.latencyMs
                  }
                }
              }
            : p
        )
      )

      return result
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  const updateProviderConfig = (providerId: string, config: ProviderConfiguration) => {
    setAvailableProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, configuration: config } : p))
    )

    // Save to localStorage
    if (activeProvider?.id === providerId) {
      localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(config))
    }
  }

  return {
    activeProvider,
    availableProviders,
    switchProvider,
    validateProvider,
    updateProviderConfig
  }
}
