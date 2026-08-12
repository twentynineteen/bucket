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
