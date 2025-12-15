/**
 * AI Provider Types and Interfaces
 * Feature: 006-i-wish-to
 * Purpose: Provider-agnostic architecture for multiple AI services
 */

import type { ProviderConfiguration, ProviderType } from '@types/scriptFormatter'
import type { LanguageModel } from 'ai'

// ============================================================================
// Provider Interface
// ============================================================================

export interface ProviderAdapter {
  id: string
  type: ProviderType
  displayName: string
  createModel: (modelId: string, config: ProviderConfiguration) => LanguageModel
  validateConnection: (
    config: ProviderConfiguration
  ) => Promise<ConnectionValidationResult>
  listModels: (config: ProviderConfiguration) => Promise<ModelInfo[]>
}

export interface ConnectionValidationResult {
  success: boolean
  errorMessage?: string
  modelsFound: number
  latencyMs: number
}

export interface ModelInfo {
  id: string
  name: string
  size?: string
  contextLength?: number
  supportsToolCalling: boolean
  supportsStreaming: boolean
}

// ============================================================================
// Provider Registry
// ============================================================================

export interface ProviderRegistry {
  providers: Map<string, ProviderAdapter>
  register: (adapter: ProviderAdapter) => void
  get: (providerId: string) => ProviderAdapter | undefined
  list: () => ProviderAdapter[]
}

// ============================================================================
// Model Creation Options
// ============================================================================

export interface ModelCreationOptions {
  providerId: string
  modelId: string
  configuration: ProviderConfiguration
  maxRetries?: number
  timeout?: number
}

// ============================================================================
// Streaming Options
// ============================================================================

export interface StreamingOptions {
  onChunk?: (chunk: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}
