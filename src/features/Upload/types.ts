/**
 * Upload Module Types
 *
 * Re-exports shared types relevant to Upload consumers.
 */
import type { SproutUploadResponse } from '@shared/types'

export type {
  SproutUploadResponse,
  GetFoldersResponse,
  SproutFolder,
  SproutVideoDetails
} from '@shared/types'

export type { PosterframeTemplateId } from './internal/posterframeTemplates'

/**
 * A folder chosen as an upload destination.
 *
 * `name` and `path` are stored alongside `id` so the trigger can render a label
 * before the tree has loaded -- and so a persisted choice still reads sensibly
 * if the folder is later removed on Sprout's side.
 */
export interface SelectedSproutFolder {
  id: string
  name: string
  /** Breadcrumb from the root, e.g. `Marketing / Q2 Campaign`. */
  path: string
}

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

/**
 * One `upload_progress` sample (issue #225, UP-30).
 *
 * `percentage` was a truncated `u32` and the only thing reported, so a user could
 * not tell 3% of 200 MB from 3% of 12 GB -- exactly the judgement they make when
 * deciding whether a slow upload is worth waiting for. It is now a float, and the
 * absolute figures come with it.
 */
export interface UploadProgressEvent {
  /** Which upload this belongs to. See `UploadCompleteEvent`. */
  operationId: string
  bytesSent: number
  totalBytes: number
  /** Unrounded, so slow movement on a large file is still visible. */
  percentage: number
}

/**
 * A successful upload.
 *
 * The operation id makes concurrent or sequential uploads distinguishable in
 * events and in logs. Without it a zombie operation's events were
 * indistinguishable from a retry's (#150 UP-11).
 */
export interface UploadCompleteEvent {
  operationId: string
  video: SproutUploadResponse
}

/** A failed upload. `message` is already user-facing prose from the backend. */
export interface UploadErrorEvent {
  operationId: string
  message: string
}

/**
 * A user-cancelled upload (issue #225, UP-21).
 *
 * Its own channel rather than an `upload_error` carrying "cancelled" in the text:
 * cancellation is not a failure and must not raise a destructive toast, and
 * deciding that from the wording would be the string sniffing #152 removed.
 */
export interface UploadCancelledEvent {
  operationId: string
  bytesSent: number
  totalBytes: number
}

/**
 * The non-terminal "this looks stalled" signal, and its withdrawal (UP-26/UP-27).
 *
 * `message` is null when a standing warning is being withdrawn because progress
 * resumed. Nothing about this event ends the upload -- that is the point of it,
 * and why it is not a terminal event.
 */
export interface UploadStallWarningEvent {
  operationId: string
  bytesSent: number
  totalBytes: number
  silentForSeconds: number
  message: string | null
}
