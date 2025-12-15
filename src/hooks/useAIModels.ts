/**
 * useAIModels Hook
 * Feature: 006-i-wish-to (T041)
 * Purpose: Fetch models from active provider using React Query
 */

import { REFRESH, SECONDS } from '@constants/timing'
import { providerRegistry } from '@services/ai/providerConfig'
import { useQuery } from '@tanstack/react-query'

import {
  queryKeys,
  type AIModel,
  type ProviderConfiguration
} from '@/types/scriptFormatter'

interface UseAIModelsOptions {
  providerId: string
  configuration: ProviderConfiguration
  enabled?: boolean
}

interface UseAIModelsResult {
  models: AIModel[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useAIModels({
  providerId,
  configuration,
  enabled = true
}: UseAIModelsOptions): UseAIModelsResult {
  const {
    data: models = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.providerModels(providerId, configuration.serviceUrl),
    queryFn: async () => {
      const adapter = providerRegistry.get(providerId)
      if (!adapter) {
        throw new Error(`Provider "${providerId}" not found`)
      }

      // Fetch models from provider
      const modelInfoList = await adapter.listModels(configuration)

      // Convert to AIModel format
      const aiModels: AIModel[] = modelInfoList.map((info) => ({
        id: info.id,
        displayName: info.name,
        modelId: info.id,
        availabilityStatus: 'online',
        lastHealthCheck: new Date(),
        size: info.size,
        capabilities: {
          supportsToolCalling: info.supportsToolCalling,
          supportsStreaming: info.supportsStreaming,
          maxTokens: info.contextLength || 4096
        }
      }))

      return aiModels
    },
    enabled,
    refetchInterval: REFRESH.AI_MODELS, // Refresh every 30 seconds while active
    staleTime: 20 * SECONDS, // Consider data stale after 20 seconds
    retry: 2 // Retry failed requests
  })

  return {
    models,
    isLoading,
    error: error as Error | null,
    refetch: () => {
      refetch()
    }
  }
}
