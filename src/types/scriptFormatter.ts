/**
 * Type definitions for AI-Powered Autocue Script Formatter
 * Feature: 006-i-wish-to
 * Based on: specs/006-i-wish-to/data-model.md
 */

// ============================================================================
// Entity: ScriptDocument (data-model.md section 1)
// ============================================================================

export interface ScriptDocument {
  id: string // UUID
  filename: string // max 255 chars
  fileSize: number // bytes, ≤ 1073741824 (1GB)
  uploadTimestamp: Date
  textContent: string // Plain text for AI processing
  htmlContent: string // HTML with formatting (from mammoth.js)
  formattingMetadata: FormattingMetadata
  validationStatus: 'valid' | 'invalid' | 'corrupted'
  validationErrors?: string[]
}

export interface FormattingMetadata {
  boldRanges: Range[]
  italicRanges: Range[]
  underlineRanges: Range[]
  headings: Heading[]
  lists: ListItem[]
  paragraphs: Paragraph[]
}

export interface Range {
  start: number // Character offset
  end: number // Character offset
  text: string
}

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  position: number
}

export interface ListItem {
  type: 'ordered' | 'unordered'
  text: string
  level: number // Nesting level
  position: number
}

export interface Paragraph {
  text: string
  start: number
  end: number
}

export interface ValidationResult {
  status: 'valid' | 'invalid' | 'corrupted'
  errors: string[]
}

// ============================================================================
// Entity: AIModel (data-model.md section 2)
// ============================================================================

export interface AIModel {
  id: string // Unique identifier
  displayName: string // Human-readable name
  modelId: string // Provider-specific model ID
  availabilityStatus: 'online' | 'offline'
  lastHealthCheck: Date
  size?: string // e.g., "7B", "70B"
  capabilities: ModelCapabilities
}

export interface ModelCapabilities {
  supportsToolCalling: boolean
  supportsStreaming: boolean
  maxTokens: number
}

// ============================================================================
// Entity: AIProvider (new - provider-agnostic architecture)
// ============================================================================

export interface AIProvider {
  id: string // 'ollama', 'openai', 'anthropic', etc.
  displayName: string
  type: ProviderType
  status: 'configured' | 'not-configured' | 'error'
  configuration: ProviderConfiguration
  lastValidated?: Date
}

export type ProviderType = 'ollama' | 'openai' | 'anthropic' | 'azure' | 'custom'

// ============================================================================
// Entity: ProcessingRequest (data-model.md section 3)
// ============================================================================

export interface ProcessingRequest {
  id: string // UUID
  documentId: string // FK to ScriptDocument
  modelId: string // FK to AIModel
  providerId: string // FK to AIProvider
  status: ProcessingStatus
  retryCount: number // min: 0, max: 3
  submissionTimestamp: Date
  completionTimestamp?: Date
  errorMessage?: string
  streamingProgress: number // 0-100
}

export type ProcessingStatus =
  | 'pending'
  | 'in_progress'
  | 'streaming'
  | 'completed'
  | 'failed'

// ============================================================================
// Entity: ProcessedOutput (data-model.md section 4)
// ============================================================================

export interface ProcessedOutput {
  id: string // UUID
  requestId: string // FK to ProcessingRequest
  formattedHtml: string
  formattedText: string
  diffData: DiffData
  editHistory: Edit[]
  generationTimestamp: Date
  isEdited: boolean
  examplesCount?: number // Number of similar examples used for RAG enhancement
}

export interface DiffData {
  additions: Change[]
  deletions: Change[]
  modifications: Change[]
  originalLineCount: number
  modifiedLineCount: number
}

export interface Change {
  type: 'add' | 'delete' | 'modify'
  lineNumber: number
  originalText?: string
  newText: string
  position: { start: number; end: number }
}

export interface Edit {
  timestamp: Date
  type: 'manual' | 'ai_regenerate'
  changeDescription: string
  previousValue: string
  newValue: string
}

// ============================================================================
// Entity: ProviderConfiguration (data-model.md section 5 - generalized)
// ============================================================================

export interface ProviderConfiguration {
  serviceUrl: string // Base URL for provider API
  apiKey?: string // Optional (Ollama doesn't need it)
  connectionStatus: 'configured' | 'not-configured' | 'error'
  lastValidationTimestamp?: Date
  lastValidationResult?: ConnectionValidationResult
  customHeaders?: Record<string, string> // For custom providers
  timeout?: number // Request timeout in ms
}

export interface ConnectionValidationResult {
  success: boolean
  errorMessage?: string
  modelsFound: number
  latencyMs: number
}

// ============================================================================
// Entity: AutocuePrompt (data-model.md section 6)
// ============================================================================

export interface AutocuePrompt {
  promptText: string
  version: string // semver format
  toolsConfig: ToolDefinition[]
  createdAt: Date
  updatedAt: Date
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // Zod schema as JSON
  enabled: boolean
}

// ============================================================================
// Storage Keys (data-model.md section "Indexes & Performance")
// ============================================================================

export const STORAGE_KEYS = {
  PROVIDER_CONFIG: 'autocue:provider-config',
  CURRENT_DOCUMENT: 'autocue:current-document',
  PROCESSING_REQUEST: 'autocue:processing-request',
  PROCESSED_OUTPUT: 'autocue:processed-output',
  SESSION_ID: 'autocue:session-id',
  ACTIVE_PROVIDER: 'autocue:active-provider'
} as const

// ============================================================================
// React Query Keys (data-model.md section "Indexes & Performance")
// ============================================================================

export const queryKeys = {
  providerModels: (providerId: string, url: string) =>
    ['provider', providerId, 'models', url] as const,
  processingRequest: (id: string) => ['processing', 'request', id] as const,
  documentValidation: (filename: string) => ['document', 'validation', filename] as const,
  providerConnection: (providerId: string, url: string) =>
    ['provider', providerId, 'connection', url] as const
}

// ============================================================================
// Helper Types
// ============================================================================

export interface ScriptFormatterState {
  currentDocument?: ScriptDocument
  currentRequest?: ProcessingRequest
  currentOutput?: ProcessedOutput
  activeProvider?: AIProvider
  availableModels: AIModel[]
  isProcessing: boolean
}

// Tauri command return types
export interface ParseResult {
  textContent: string
  htmlContent: string
  formattingMetadata: FormattingMetadata
}

export interface DownloadPath {
  path: string
}

export interface ConnectionStatus {
  connected: boolean
  message?: string
  latencyMs?: number
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStep =
  | 'upload'
  | 'select-model'
  | 'processing'
  | 'review'
  | 'download'
