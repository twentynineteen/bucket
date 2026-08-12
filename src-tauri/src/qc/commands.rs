//! Tauri commands for the watermark check (issue #180, stage 2).
//!
//! Progress and cancellation reuse what BuildProject already established rather
//! than inventing a third mechanism: `OperationRegistry` hands out an operation id
//! and a `watch` receiver, and progress arrives as an emitted event. What differs
//! is that the report comes back as the command's return value rather than in a
//! completion event, because it is a value the caller awaits rather than a
//! notification anyone else needs.
//!
//! One run at a time (D19). A second request is rejected with a message rather
//! than queued: two concurrent runs would double the decode load on the same
//! machine for no benefit, and the page has nowhere to show two reports.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

// Re-exported from `build_project`, which owns the one cancellation registry the
// app uses. Nothing in `build_project/transfer.rs` is touched.
use crate::build_project::OperationRegistry;

use super::discovery::{probe_binary_path, resolve_ffmpeg_tools, FfmpegAvailability};
use super::error::QcError;
use super::evidence::{save_evidence, EvidenceItem};
use super::watermark::{analyse, AnalysisRequest, Phase, WatermarkReport};

/// Which run, if any, is in flight.
///
/// Managed state rather than a static: the app owns it, and a test can build its
/// own without the two interfering.
#[derive(Default)]
pub struct QcRunState {
    active: Mutex<Option<String>>,
}

impl QcRunState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Claims the single run slot, or reports what is already using it.
    ///
    /// A poisoned lock is treated as free rather than propagated: the only thing
    /// held is an operation id, so the worst case of recovering from a panic here
    /// is allowing a run that would otherwise be blocked forever.
    pub fn begin(&self, operation_id: String) -> Result<(), QcError> {
        let mut active = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if active.is_some() {
            return Err(QcError::Busy {
                message:
                    "A quality control run is already in progress. Wait for it to finish, or cancel it first."
                        .to_string(),
            });
        }

        *active = Some(operation_id);
        Ok(())
    }

    /// Releases the slot, whatever the run's outcome.
    pub fn finish(&self) {
        let mut active = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *active = None;
    }

    /// The operation id of the run in flight, for cancellation.
    pub fn active(&self) -> Option<String> {
        self.active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

/// What the frontend asks for when starting a watermark check.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkCheckRequest {
    pub video_path: String,
    /// The watermark pool's files, as listed by the frontend's pool resolution.
    pub reference_files: Vec<String>,
    /// The Settings ffmpeg directory, when one is configured.
    pub ffmpeg_directory: Option<String>,
    /// An advanced override; omitted means the calibrated default (B13.1).
    pub match_threshold: Option<f32>,
}

/// Progress for a run in flight.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QcProgressEvent {
    pub operation_id: String,
    pub phase: Phase,
    /// Never decreases over a run (B11.1).
    pub percentage: f64,
    pub detail: String,
}

/// The event name the frontend listens on.
pub const QC_PROGRESS_EVENT: &str = "qc-progress";

/// Runs the watermark check over one video.
#[tauri::command]
pub async fn qc_run_watermark_check(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    runs: State<'_, QcRunState>,
    request: WatermarkCheckRequest,
) -> Result<WatermarkReport, QcError> {
    let (ffmpeg, ffprobe) =
        match resolve_ffmpeg_tools(request.ffmpeg_directory.as_deref(), probe_binary_path) {
            FfmpegAvailability::Ready { ffmpeg, ffprobe } => (ffmpeg, ffprobe),
            // Discovery already knows exactly which binary is missing and where it
            // looked, so the run refuses with that rather than letting a spawn fail.
            other => {
                return Err(QcError::Unavailable {
                    message: describe_unavailable(&other),
                })
            }
        };

    if request.reference_files.is_empty() {
        return Err(QcError::ReferencePool {
            message: "There are no watermark reference images to compare against.".to_string(),
        });
    }

    let (operation_id, cancel_receiver) = registry.register().await;

    // Claimed after registering so the id in the rejection message and the id the
    // cancel command uses are the same one.
    if let Err(busy) = runs.begin(operation_id.clone()) {
        registry.complete(&operation_id).await;
        return Err(busy);
    }

    let analysis = AnalysisRequest {
        video_path: request.video_path.clone(),
        ffmpeg,
        ffprobe,
        reference_files: request.reference_files.clone(),
        match_threshold: request.match_threshold,
        // Stage 2 has no tail analysis, so the dip start is never known and the
        // span falls back to the tail-window approximation, which the report says
        // out loud. Stage 3 fills this in (B4.6, B5.10).
        dip_start_seconds: None,
    };

    let emit_app = app.clone();
    let emit_id = operation_id.clone();

    // Blocking: the whole analysis is process spawning and pixel arithmetic, and
    // running it on the async runtime's worker would stall every other command.
    let result = tokio::task::spawn_blocking(move || {
        analyse(
            &analysis,
            &cancel_receiver,
            &mut |phase, percentage, detail| {
                let _ = emit_app.emit(
                    QC_PROGRESS_EVENT,
                    QcProgressEvent {
                        operation_id: emit_id.clone(),
                        phase,
                        percentage,
                        detail: detail.to_string(),
                    },
                );
            },
        )
    })
    .await;

    // Released before returning, on every path: leaving the slot claimed after a
    // panic would need an app restart to run QC again.
    runs.finish();
    registry.complete(&operation_id).await;

    match result {
        Ok(Ok(report)) => Ok(report),
        Ok(Err(error)) => {
            // Logged as well as returned: a QC failure the operator screenshots is
            // much easier to diagnose against a log line naming the same cause.
            log::warn!("[QC] watermark check failed: {}", error.message());
            Err(error)
        }
        Err(join_error) => Err(QcError::Io {
            message: format!("The quality control run did not finish: {}", join_error),
        }),
    }
}

/// Cancels the run in flight, if there is one.
///
/// No argument: only one run can exist (D19), so asking the caller to track its id
/// would be asking it to keep state that cannot disagree with this one.
#[tauri::command]
pub async fn qc_cancel_run(
    registry: State<'_, OperationRegistry>,
    runs: State<'_, QcRunState>,
) -> Result<bool, QcError> {
    match runs.active() {
        Some(operation_id) => Ok(registry.cancel(&operation_id).await),
        None => Ok(false),
    }
}

/// Writes a report's failure thumbnails into a folder the operator chose.
#[tauri::command]
pub fn qc_save_evidence(
    folder: String,
    prefix: String,
    items: Vec<EvidenceItem>,
) -> Result<Vec<String>, QcError> {
    save_evidence(&folder, &prefix, &items)
}

/// Turns unusable discovery into an instruction, matching the wording the QC page
/// already shows for the same states.
fn describe_unavailable(availability: &FfmpegAvailability) -> String {
    match availability {
        FfmpegAvailability::NotExecutable { path } => format!(
            "ffmpeg at {} cannot be run. Check the file's permissions.",
            path
        ),
        FfmpegAvailability::NotFound { missing, searched } => format!(
            "Video QC needs {}, which could not be found. Searched: {}.",
            missing.join(" and "),
            searched.join(", ")
        ),
        FfmpegAvailability::Ready { .. } => "ffmpeg is available.".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b8_6_rejects_a_second_run_while_one_is_in_flight() {
        let runs = QcRunState::new();
        runs.begin("first".to_string()).unwrap();

        let second = runs.begin("second".to_string());

        match second {
            Err(QcError::Busy { message }) => {
                assert!(
                    message.contains("already in progress"),
                    "the message must say why, got {}",
                    message
                );
            }
            other => panic!("expected a busy rejection, got {:?}", other),
        }
    }

    #[test]
    fn a_finished_run_releases_the_slot() {
        let runs = QcRunState::new();
        runs.begin("first".to_string()).unwrap();
        runs.finish();

        assert!(
            runs.begin("second".to_string()).is_ok(),
            "a finished run must not block the next one"
        );
    }

    #[test]
    fn exposes_the_operation_id_cancellation_needs() {
        let runs = QcRunState::new();

        assert_eq!(runs.active(), None);

        runs.begin("op-1".to_string()).unwrap();

        assert_eq!(runs.active(), Some("op-1".to_string()));

        runs.finish();

        assert_eq!(runs.active(), None);
    }

    #[test]
    fn names_the_missing_binary_when_refusing_to_run() {
        let message = describe_unavailable(&FfmpegAvailability::NotFound {
            missing: vec!["ffprobe".to_string()],
            searched: vec!["/opt/homebrew/bin".to_string()],
        });

        assert!(message.contains("ffprobe"), "got {}", message);
        assert!(message.contains("/opt/homebrew/bin"), "got {}", message);
    }

    #[test]
    fn distinguishes_an_unrunnable_binary_from_a_missing_one() {
        let message = describe_unavailable(&FfmpegAvailability::NotExecutable {
            path: "/custom/ffmpeg".to_string(),
        });

        assert!(message.contains("permissions"), "got {}", message);
    }
}
