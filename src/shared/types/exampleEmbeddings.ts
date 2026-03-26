/**
 * Types for AI Script Example Embedding Management
 * Feature: 007-frontend-script-example
 */

/**
 * Category classification for script examples
 */
export enum ExampleCategory {
  EDUCATIONAL = 'educational',
  BUSINESS = 'business',
  NARRATIVE = 'narrative',
  INTERVIEW = 'interview',
  DOCUMENTARY = 'documentary',
  USER_CUSTOM = 'user-custom'
}

/**
 * Source origin of an example
 */
export type ExampleSource = 'bundled' | 'user-uploaded'

/**
 * User-provided metadata for uploading examples
 */
export interface ExampleMetadata {
  title: string // 1-200 chars, no newlines
  category: ExampleCategory
  tags?: string[] // Optional, max 10 tags, each max 50 chars
  qualityScore?: number // Optional, 1-5
}

/**
 * Complete example with all metadata (API response)
 */
export interface ExampleWithMetadata {
  id: string
  title: string
  category: string
  beforeText: string
  afterText: string
  tags: string[]
  wordCount: number | null
  qualityScore: number | null
  source: ExampleSource
  createdAt: string // ISO 8601
}

/**
 * Request payload for uploading a new example
 */
export interface UploadRequest {
  beforeContent: string // Original script content
  afterContent: string // Formatted script content
  metadata: ExampleMetadata
  embedding: number[] // Pre-computed embedding (384 floats)
}

/**
 * Request payload for replacing an existing example
 */
export interface ReplaceRequest {
  beforeContent: string
  afterContent: string
  embedding: number[]
}

/**
 * Error types for file upload operations
 */
export type UploadError =
  | { type: 'file_too_large'; maxSize: number }
  | { type: 'invalid_encoding'; details: string }
  | { type: 'invalid_extension'; expected: string }
  | { type: 'content_too_short'; minLength: number }
  | { type: 'content_too_long'; maxLength: number }
  | { type: 'embedding_failed'; error: string }
  | { type: 'validation_failed'; field: string; message: string }
  | { type: 'network_error'; error: string }

/**
 * Error types for delete operations
 */
export type DeleteError =
  | { type: 'example_not_found'; id: string }
  | { type: 'cannot_delete_bundled'; id: string }
  | { type: 'database_error'; error: string }
  | { type: 'network_error'; error: string }

/**
 * Error types for replace operations
 */
export type ReplaceError =
  | { type: 'example_not_found'; id: string }
  | { type: 'cannot_replace_bundled'; id: string }
  | { type: 'validation_failed'; field: string; message: string }
  | { type: 'database_error'; error: string }
  | { type: 'network_error'; error: string }

/**
 * File validation result
 */
export interface FileValidation {
  valid: boolean
  error?: UploadError
}
