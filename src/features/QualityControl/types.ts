/**
 * Quality Control domain types (issue #180)
 *
 * Mirrors the serialised shapes the Rust side returns. `FfmpegAvailability`
 * corresponds to the `#[serde(tag = "status")]` enum in
 * `src-tauri/src/commands/qc.rs`; the tags must stay in step.
 */

/** Where QC stands on being able to run ffmpeg at all. */
export type FfmpegAvailability =
  /** Both binaries found and runnable. */
  | { status: 'ready'; ffmpeg: string; ffprobe: string }
  /** One or both binaries absent. `missing` names them; `searched` says where we looked. */
  | { status: 'notFound'; missing: string[]; searched: string[] }
  /** A binary is present but cannot be executed — a permissions fix, not an install. */
  | { status: 'notExecutable'; path: string }

/** Which top corner a watermark occupies. */
export type QcCorner = 'topLeft' | 'topRight'

/**
 * Which stage of a run progress refers to.
 *
 * Stage 3 adds `tail` when the tail analysis starts emitting one.
 */
export type QcPhase = 'probe' | 'watermark' | 'refine'

/**
 * A contiguous absence of the watermark, as a measured time range.
 *
 * Carries the best score seen inside it and which reference produced it, so a near
 * miss can be told from nothing at all without re-running anything.
 */
export interface QcGap {
  startSeconds: number
  endSeconds: number
  bestConfidence: number
  bestReference: string | null
}

/** A sample that found the mark in a corner other than the established one. */
export interface QcCornerChange {
  atSeconds: number
  expected: QcCorner
  found: QcCorner
}

/** The stretch of the video the watermark was checked over. */
export interface QcSpan {
  startSeconds: number
  endSeconds: number
  /** True when the end was assumed rather than measured from a dip to white. */
  approximated: boolean
}

/**
 * A downscaled failure frame, held in memory only.
 *
 * `jpeg` arrives as a byte array over IPC. Nothing is written to disk unless the
 * operator asks for it (D15).
 */
export interface QcThumbnail {
  label: string
  atSeconds: number
  jpeg: number[]
}

/** Everything one watermark run concluded. */
export interface QcWatermarkReport {
  outcome: 'pass' | 'fail'
  corner: QcCorner | null
  span: QcSpan
  gaps: QcGap[]
  cornerChanges: QcCornerChange[]
  coarseSamples: number
  matchedSamples: number
  /** The highest score any sample reached, whatever the verdict. */
  bestConfidence: number
  /** The lowest score any sample reached, whatever the verdict. */
  weakestConfidence: number
  /** The reference that scored best anywhere, whether or not it ever passed. */
  bestReference: string | null
  /** The reference that produced a passing match, or null if none did. */
  matchedReference: string | null
  threshold: number
  /** False when an override was applied, so the report can say so (D18). */
  thresholdIsDefault: boolean
  referencesUsed: number
  video: { width: number; height: number; durationSeconds: number }
  thumbnails: QcThumbnail[]
  /** Caveats worth stating alongside the verdict. */
  notes: string[]
}

/** Progress for a run in flight. */
export interface QcProgressEvent {
  operationId: string
  phase: QcPhase
  /** Never decreases over a run. */
  percentage: number
  detail: string
}

/**
 * Why a run did not produce a report.
 *
 * Mirrors the `#[serde(tag = "kind")]` enum in `src-tauri/src/qc/error.rs`; the
 * tags must stay in step. Every variant carries `message`, so the UI can always
 * render something without matching on the tag first.
 */
export type QcError =
  | { kind: 'busy'; message: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'probe'; message: string }
  | { kind: 'ffmpeg'; message: string; stderr: string }
  | { kind: 'referencePool'; message: string }
  | { kind: 'threshold'; message: string }
  | { kind: 'io'; message: string }
