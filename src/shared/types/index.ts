/**
 * Shared Types Barrel
 *
 * Re-exports core domain types and media types.
 */

// Media types (video links, Trello cards, Sprout video)
export type {
  VideoLink,
  TrelloCard,
  TrelloBoard,
  TrelloOrganization,
  TrelloBoardPrefs,
  SproutVideoDetails,
  SproutAssets
} from './media'

// Core domain types (breadcrumbs, footage, sprout upload)
export type {
  SproutFolder,
  GetFoldersResponse,
  FootageData,
  Breadcrumb,
  SproutUploadResponse
} from './types'

// Script formatter types (AI tools + Settings)
export type {
  ScriptDocument,
  FormattingMetadata,
  ProviderConfiguration,
  ProcessedOutput,
  AIProvider,
  AIModel,
  WorkflowStep,
  ProviderType,
  ConnectionValidationResult
} from './scriptFormatter'
export { STORAGE_KEYS, queryKeys } from './scriptFormatter'

// Example embeddings types (AI tools)
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
} from './exampleEmbeddings'
export { ExampleCategory } from './exampleEmbeddings'
