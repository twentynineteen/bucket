//! Tauri commands for a Kavanagh run (issue #180, stages 2-3).
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

use super::check::{run_check, CheckReport};
use super::discovery::{probe_binary_path, resolve_ffmpeg_tools, FfmpegAvailability};
use super::error::KavanaghError;
use super::evidence::{save_evidence, EvidenceItem};
use super::watermark::{AnalysisRequest, Phase};

/// Which run, if any, is in flight.
///
/// Managed state rather than a static: the app owns it, and a test can build its
/// own without the two interfering.
#[derive(Default)]
pub struct KavanaghRunState {
    active: Mutex<Option<String>>,
}

impl KavanaghRunState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Claims the single run slot, or reports what is already using it.
    ///
    /// A poisoned lock is treated as free rather than propagated: the only thing
    /// held is an operation id, so the worst case of recovering from a panic here
    /// is allowing a run that would otherwise be blocked forever.
    pub fn begin(&self, operation_id: String) -> Result<(), KavanaghError> {
        let mut active = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if active.is_some() {
            return Err(KavanaghError::Busy {
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
    /// The sting pool's files. Defaulted so the watermark-only command, which
    /// has no use for them, does not have to send an empty array.
    #[serde(default)]
    pub sting_reference_files: Vec<String>,
    /// The Settings ffmpeg directory, when one is configured.
    pub ffmpeg_directory: Option<String>,
    /// An advanced override; omitted means the calibrated default (B13.1).
    pub match_threshold: Option<f32>,
}

/// Progress for a run in flight.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KavanaghProgressEvent {
    pub operation_id: String,
    pub phase: Phase,
    /// Never decreases over a run (B11.1).
    pub percentage: f64,
    pub detail: String,
}

/// The event name the frontend listens on.
pub const KAVANAGH_PROGRESS_EVENT: &str = "kavanagh-progress";

/// Runs both checks over one video and returns a single verdict (D9, B7).
///
/// The tail is measured first so the watermark pass knows where to stop, which
/// is why this is one command rather than the frontend calling two and stitching
/// the results together.
#[tauri::command]
pub async fn kavanagh_run_check(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    runs: State<'_, KavanaghRunState>,
    request: WatermarkCheckRequest,
) -> Result<CheckReport, KavanaghError> {
    let (ffmpeg, ffprobe) =
        match resolve_ffmpeg_tools(request.ffmpeg_directory.as_deref(), probe_binary_path) {
            FfmpegAvailability::Ready { ffmpeg, ffprobe } => (ffmpeg, ffprobe),
            other => {
                return Err(KavanaghError::Unavailable {
                    message: describe_unavailable(&other),
                })
            }
        };

    if request.reference_files.is_empty() {
        return Err(KavanaghError::ReferencePool {
            message: "There are no watermark reference images to compare against.".to_string(),
        });
    }

    // An empty sting pool is deliberately not refused here: the sting check
    // reports it as an unavailable pool and the tail is still worth measuring,
    // which is what B6.4 asks for.

    let (operation_id, cancel_receiver) = registry.register().await;

    if let Err(busy) = runs.begin(operation_id.clone()) {
        registry.complete(&operation_id).await;
        return Err(busy);
    }

    let analysis = AnalysisRequest {
        video_path: request.video_path.clone(),
        ffmpeg,
        ffprobe,
        reference_files: request.reference_files.clone(),
        sting_reference_files: request.sting_reference_files.clone(),
        match_threshold: request.match_threshold,
        // Measured by the run itself rather than supplied.
        dip_start_seconds: None,
    };

    let mut emit = progress_emitter(app.clone(), operation_id.clone());

    let result = tokio::task::spawn_blocking(move || {
        run_check(&analysis, &cancel_receiver, &mut emit)
    })
    .await;

    runs.finish();
    registry.complete(&operation_id).await;

    match result {
        Ok(Ok(report)) => Ok(report),
        Ok(Err(error)) => {
            log::warn!("[Kavanagh] check failed: {}", error.message());
            Err(error)
        }
        Err(join_error) => Err(KavanaghError::Io {
            message: format!("The quality control run did not finish: {}", join_error),
        }),
    }
}

/// Builds the progress closure both entry points hand to the analysis.
///
/// Owned rather than borrowed because the analysis runs on a blocking thread and
/// outlives the command's stack frame.
fn progress_emitter(
    app: AppHandle,
    operation_id: String,
) -> impl FnMut(Phase, f64, &str) + Send + 'static {
    move |phase, percentage, detail| {
        let _ = app.emit(
            KAVANAGH_PROGRESS_EVENT,
            KavanaghProgressEvent {
                operation_id: operation_id.clone(),
                phase,
                percentage,
                detail: detail.to_string(),
            },
        );
    }
}

/// Cancels the run in flight, if there is one.
///
/// No argument: only one run can exist (D19), so asking the caller to track its id
/// would be asking it to keep state that cannot disagree with this one.
#[tauri::command]
pub async fn kavanagh_cancel_run(
    registry: State<'_, OperationRegistry>,
    runs: State<'_, KavanaghRunState>,
) -> Result<bool, KavanaghError> {
    match runs.active() {
        Some(operation_id) => Ok(registry.cancel(&operation_id).await),
        None => Ok(false),
    }
}

/// Writes a report's failure thumbnails into a folder the operator chose.
#[tauri::command]
pub fn kavanagh_save_evidence(
    folder: String,
    prefix: String,
    items: Vec<EvidenceItem>,
) -> Result<Vec<String>, KavanaghError> {
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
        let runs = KavanaghRunState::new();
        runs.begin("first".to_string()).unwrap();

        let second = runs.begin("second".to_string());

        match second {
            Err(KavanaghError::Busy { message }) => {
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
        let runs = KavanaghRunState::new();
        runs.begin("first".to_string()).unwrap();
        runs.finish();

        assert!(
            runs.begin("second".to_string()).is_ok(),
            "a finished run must not block the next one"
        );
    }

    #[test]
    fn exposes_the_operation_id_cancellation_needs() {
        let runs = KavanaghRunState::new();

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
