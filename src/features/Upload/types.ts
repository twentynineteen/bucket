/**
 * Upload Module Types
 *
 * Re-exports shared types relevant to Upload consumers.
 */
export type {
  SproutUploadResponse,
  GetFoldersResponse,
  SproutFolder,
  SproutVideoDetails
} from '@shared/types'

/**
 * Failure detail from the poster frame command. `status` is the HTTP status
 * Sprout returned, or null for a transport-level failure.
 */
export interface PosterFrameError {
  status: number | null
  message: string
}

/** Progress of the poster frame step within an upload. */
export type PosterFrameStatus = 'idle' | 'working' | 'success' | 'error'

/** Outcome of setting a poster frame on a freshly uploaded Sprout video. */
export interface PosterFrameRunResult {
  /** True when Sprout accepted the poster frame. */
  ok: boolean
  /** Sprout's poster frame URL after the update, when it could be read back. */
  posterFrameUrl: string | null
  /** Human-readable failure text, null on success. */
  error: string | null
}
