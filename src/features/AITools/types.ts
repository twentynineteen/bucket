/**
 * AITools Module - Shared Types
 *
 * Central type definitions for the AITools feature module.
 * Re-exports types from shared type files that AI hooks consume.
 */

// Re-export all types from exampleEmbeddings
export type {
  ExampleWithMetadata,
  UploadRequest,
  ReplaceRequest,
  ExampleMetadata,
  ExampleSource,
  UploadError,
  DeleteError,
  ReplaceError,
  FileValidation
} from '@shared/types/exampleEmbeddings'
export { ExampleCategory } from '@shared/types/exampleEmbeddings'

// Re-export relevant types from scriptFormatter
export type {
  ProviderConfiguration,
  ProcessedOutput,
  AIProvider,
  AIModel,
  ScriptDocument,
  FormattingMetadata,
  WorkflowStep
} from '@shared/types/scriptFormatter'

/**
 * Similar example returned from vector search
 */
export interface SimilarExample {
  id: string
  title: string
  category: string
  before_text: string
  after_text: string
  similarity: number
}

/**
 * Ollama API response for /api/tags endpoint
 */
export interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
  details?: {
    format?: string
    family?: string
    parameter_size?: string
  }
}

export interface OllamaTagsResponse {
  models: OllamaModel[]
}
