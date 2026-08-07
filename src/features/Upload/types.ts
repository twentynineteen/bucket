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

/** How an upload status message should be surfaced to the user. */
export type UploadMessageSeverity = 'info' | 'success' | 'error'

/**
 * An upload status message with its severity carried as data.
 *
 * Severity is decided by which Tauri event fired (`upload_complete` vs
 * `upload_error`), never by inspecting `text`. Backend wording changes -- such
 * as "Sprout rejected the upload: HTTP 413 -- ..." -- must not alter styling.
 */
export interface UploadMessage {
  text: string
  severity: UploadMessageSeverity
  /**
   * Forward-compatibility slot for the typed terminal reason planned in issue
   * #150 (UP-01/UP-07). Unset today; consumers must not depend on it.
   */
  reason?: string
}
