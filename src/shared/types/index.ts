/**
 * Shared Types Barrel
 *
 * Re-exports core domain types and media types.
 */

// Media types (video links, Trello cards, Sprout video)
/** Video link with URL, title, thumbnail, and creation timestamp */
export type { VideoLink } from './media'
/** Trello card with id, name, URL, labels, and list membership */
export type { TrelloCard } from './media'
/** Trello board with id, name, URL, and organization */
export type { TrelloBoard } from './media'
/** Trello organization with id, name, and display name */
export type { TrelloOrganization } from './media'
/** Trello board visual preferences -- background color, card covers */
export type { TrelloBoardPrefs } from './media'
/** Sprout Video metadata with duration, dimensions, embed code, and assets */
export type { SproutVideoDetails } from './media'
/** Sprout Video asset URLs -- thumbnails, poster frames, source files */
export type { SproutAssets } from './media'

// Core domain types (breadcrumbs, footage, sprout upload)
/** Sprout Video folder with id, name, and parent folder reference */
export type { SproutFolder } from './types'
/** Response from the Sprout Video folders API endpoint */
export type { GetFoldersResponse } from './types'
/** Footage file data with camera number, file path, and metadata */
export type { FootageData } from './types'
/** Breadcrumb entry with project name, date, paths, and linked resources */
export type { Breadcrumb } from './types'
/** Sprout Video upload response with video ID, status, and embed code */
export type { SproutUploadResponse } from './types'

// Script formatter types (AI tools + Settings)
/** Script document with raw text, parsed sections, and formatting state */
export type { ScriptDocument } from './scriptFormatter'
/** Metadata about a completed formatting operation -- duration, provider, tokens */
export type { FormattingMetadata } from './scriptFormatter'
/** AI provider configuration with endpoint, API key, and model selection */
export type { ProviderConfiguration } from './scriptFormatter'
/** Formatted script output with sections, cues, and timing marks */
export type { ProcessedOutput } from './scriptFormatter'
/** AI provider instance with name, models, and connection status */
export type { AIProvider } from './scriptFormatter'
/** AI model metadata with name, capabilities, and context window size */
export type { AIModel } from './scriptFormatter'
/** Single step in the script formatting workflow pipeline */
export type { WorkflowStep } from './scriptFormatter'
/** AI provider type identifier -- openai, anthropic, ollama, local */
export type { ProviderType } from './scriptFormatter'
/** Result of testing an AI provider connection -- success, latency, error */
export type { ConnectionValidationResult } from './scriptFormatter'
/** Local storage keys for persisting script formatter preferences */
export { STORAGE_KEYS } from './scriptFormatter'
/** Query key factory for script formatter data fetching */
export { queryKeys } from './scriptFormatter'

// Breadcrumbs domain types (comparison, diffing, preview)
/** Breadcrumbs file structure with project metadata, files, and linked resources */
export type { BreadcrumbsFile } from './breadcrumbs'
/** File info entry within a breadcrumbs file -- camera number, name, path */
export type { FileInfo } from './breadcrumbs'
/** Type of change detected in a field comparison -- added, modified, removed, unchanged */
export type { FieldChangeType } from './breadcrumbs'
/** Single field change with type, field name, and old/new values */
export type { FieldChange } from './breadcrumbs'
/** Diff result from comparing two breadcrumbs files -- changes and summary counts */
export type { BreadcrumbsDiff } from './breadcrumbs'
/** Enriched field change with display name, formatted values, category, and impact */
export type { DetailedFieldChange } from './breadcrumbs'
/** Per-project change detail with categorized changes and summary counts */
export type { ProjectChangeDetail } from './breadcrumbs'
/** Preview of breadcrumbs update with current, updated, full diff, and meaningful diff */
export type { BreadcrumbsPreview } from './breadcrumbs'

// Example embeddings types (AI tools)
/** Script example with metadata, embedding vector, and source classification */
export type { ExampleWithMetadata } from './exampleEmbeddings'
/** Request payload for uploading a new script example embedding */
export type { UploadRequest } from './exampleEmbeddings'
/** Request payload for replacing an existing script example */
export type { ReplaceRequest } from './exampleEmbeddings'
/** Metadata about a script example -- name, category, word count, date */
export type { ExampleMetadata } from './exampleEmbeddings'
/** Source classification for an example -- bundled or user-uploaded */
export type { ExampleSource } from './exampleEmbeddings'
/** Error returned when an example upload fails */
export type { UploadError } from './exampleEmbeddings'
/** Error returned when an example deletion fails */
export type { DeleteError } from './exampleEmbeddings'
/** Error returned when an example replacement fails */
export type { ReplaceError } from './exampleEmbeddings'
/** Validation result for an uploaded script file -- valid, errors, warnings */
export type { FileValidation } from './exampleEmbeddings'
/** Enum of example categories for filtering and organization */
export { ExampleCategory } from './exampleEmbeddings'
