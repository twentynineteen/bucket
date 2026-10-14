//! Sprout Video upload, folder listing and video metadata.
//!
//! Split into submodules along the seams the code grew on:
//!
//! - `target` - where a transfer's bytes go (`UploadTarget`, `endpoint`,
//!   `text_fields`)
//! - `response` - HTTP response classification and folder listing types
//! - `transfer` - the upload task, progress tracking, size gate and terminal
//!   event arbitration
//! - `supervisor` - stall detection, soft warnings and cancellation

mod response;
mod supervisor;
mod target;
mod transfer;

// Re-export everything the rest of the crate (and the tests) import under
// `crate::commands::sprout_upload::`.
pub use response::{
    classify_folders_page, classify_response, folders_url, SproutFolder, SproutFoldersPage,
    SproutFoldersWirePage,
};
pub use supervisor::{
    StallCheck, StallMonitor, STALL_MIN_PROGRESS_BYTES, STALL_WARNING_AFTER, STALL_WINDOW,
};
pub use target::{endpoint, text_fields, UploadTarget};
pub use transfer::{
    check_upload_size, is_progress_emit_due, stall_message, stall_warning_message,
    warning_transition, CheckedUploadSize, TerminalOnce, UploadProgress, WarningTransition,
    PROGRESS_EMIT_INTERVAL,
};

use std::sync::Arc;
use std::time::Duration;

use app_lib::media::SproutVideoDetails;
use reqwest::Client;
use tauri::{command, AppHandle, State};

use crate::build_project::OperationRegistry;

use response::{header_number, FOLDERS_PER_PAGE, MAX_FOLDER_PAGES};
use supervisor::supervise_upload;
use transfer::{upload_video_task, TerminalGate, UploadProgress as Progress};

/// Starts an upload and returns the id it can be addressed by.
///
/// Returning the id is what makes cancellation possible at all: before #225 this
/// command returned `()`, so a running upload could not be named, let alone
/// stopped, and dismissing the dialog left a multi-gigabyte transfer running with
/// nowhere to watch it. The registry is the same `OperationRegistry` BuildProject's
/// file transfers use - reused rather than reinvented.
#[command]
pub async fn upload_video(
    app_handle: AppHandle,
    registry: State<'_, OperationRegistry>,
    file_path: String,
    api_key: String,
    folder_id: Option<String>,
    title: Option<String>,
) -> Result<String, String> {
    start_transfer(
        app_handle,
        registry.inner(),
        file_path,
        api_key,
        UploadTarget::New { folder_id, title },
    )
    .await
}

/// Replaces the source file of an existing Sprout video (issue #282).
///
/// Sprout keeps the video id, so every embed and share link already published
/// keeps working; only the file behind them changes. The transfer is the same
/// task as `upload_video`, so progress, stall detection and `cancel_upload`
/// apply unchanged.
#[command]
pub async fn replace_video(
    app_handle: AppHandle,
    registry: State<'_, OperationRegistry>,
    file_path: String,
    api_key: String,
    video_id: String,
) -> Result<String, String> {
    start_transfer(
        app_handle,
        registry.inner(),
        file_path,
        api_key,
        UploadTarget::Replace { video_id },
    )
    .await
}

/// Registers an operation, spawns the transfer and its supervisor, and returns
/// the operation id. Shared by `upload_video` and `replace_video`.
async fn start_transfer(
    app_handle: AppHandle,
    registry: &OperationRegistry,
    file_path: String,
    api_key: String,
    target: UploadTarget,
) -> Result<String, String> {
    let (operation_id, cancel_rx) = registry.register().await;

    let gate = TerminalGate::new(app_handle.clone(), operation_id.clone());
    let progress = Arc::new(Progress::new());

    let upload_gate = gate.clone();
    let upload_progress = progress.clone();
    let upload_operation = operation_id.clone();
    let upload = tauri::async_runtime::spawn(async move {
        let outcome = upload_video_task(
            app_handle,
            file_path,
            api_key,
            target,
            upload_progress,
            upload_gate.clone(),
            upload_operation,
        )
        .await;

        // Every exit from the task reports itself, including the `?` paths that
        // used to vanish into a bare `println!`. The gate makes a second report
        // impossible, so the supervisor and this arm cannot both be heard.
        if let Err(err) = outcome {
            upload_gate.fail(err);
        }
    });

    // Deliberately its own task rather than a `select!` inside the upload task: a
    // watchdog that shares the task it is watching cannot fire when that task is
    // blocked inside a syscall, which is one of #150's candidate causes. The same
    // reasoning applies to cancellation - a cancel must be actioned even when the
    // upload task is wedged, which is precisely when a user reaches for it.
    tauri::async_runtime::spawn(supervise_upload(
        upload,
        progress,
        gate,
        cancel_rx,
        registry.clone(),
        operation_id.clone(),
    ));

    Ok(operation_id)
}

/// Signals cancellation for a running upload.
///
/// Extracted from the command so it can be tested against a real registry without
/// a Tauri runtime. Returns false when the operation is not running: a dialog is
/// routinely dismissed a moment after the upload finished, and "nothing to
/// cancel" is not a failure.
pub async fn signal_cancel(registry: &OperationRegistry, operation_id: &str) -> bool {
    if !registry.has_operation(operation_id).await {
        log::info!(
            "[Sprout] Upload {} is not running; nothing to cancel",
            operation_id
        );
        return false;
    }

    let signalled = registry.cancel(operation_id).await;
    if signalled {
        log::info!(
            "[Sprout] Cancellation signalled for upload {}",
            operation_id
        );
    }
    signalled
}

/// Cancels an in-flight upload. Mirrors `cancel_file_transfer`.
///
/// `Ok(false)` means the operation was not found, which is the normal outcome when
/// the upload had already finished.
#[command]
pub async fn cancel_upload(
    registry: State<'_, OperationRegistry>,
    operation_id: String,
) -> Result<bool, String> {
    Ok(signal_cancel(registry.inner(), &operation_id).await)
}

/// Lists the folders directly inside `parent_id`, or the root folders when it is
/// `None`. Pagination is consumed here so the frontend never sees pages.
#[command]
pub async fn get_folders(
    api_key: String,
    parent_id: Option<String>,
) -> Result<SproutFoldersPage, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut folders: Vec<response::SproutFolder> = Vec::new();
    let mut total: Option<u32> = None;
    let mut rate_limit_remaining: Option<u32> = None;
    let mut rate_limit_reset: Option<u64> = None;
    let mut truncated = false;

    for page in 1..=MAX_FOLDER_PAGES {
        let url = folders_url(parent_id.as_deref(), page, FOLDERS_PER_PAGE);

        let response = client
            .get(&url)
            .header("SproutVideo-Api-Key", &api_key)
            .send()
            .await
            .map_err(|e| format!("Could not reach Sprout Video: {}", e))?;

        let status = response.status();
        let headers = response.headers().clone();
        let retry_after = headers
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        rate_limit_remaining = header_number::<u32>(&headers, "X-RateLimit-Remaining");
        rate_limit_reset = header_number::<u64>(&headers, "X-RateLimit-Reset");

        let body_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read folder response (HTTP {}): {}", status, e))?;

        let wire = classify_folders_page(status, &body_text, retry_after.as_deref())?;

        if total.is_none() {
            total = wire.total;
        }
        folders.extend(wire.folders);

        if wire.next_page.is_none() {
            break;
        }

        if page == MAX_FOLDER_PAGES {
            truncated = true;
            eprintln!(
                "get_folders: stopped at the {}-page cap for parent {:?}; more folders exist",
                MAX_FOLDER_PAGES, parent_id
            );
        }
    }

    Ok(SproutFoldersPage {
        folders,
        total,
        truncated,
        rate_limit_remaining,
        rate_limit_reset,
    })
}

/// Fetches video metadata from Sprout Video API given a video ID
/// Feature: 004-embed-multiple-video - URL auto-fetch
#[command]
pub async fn fetch_sprout_video_details(
    video_id: String,
    api_key: String,
) -> Result<SproutVideoDetails, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("https://api.sproutvideo.com/v1/videos/{}", video_id);

    let response = client
        .get(&url)
        .header("SproutVideo-Api-Key", api_key)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let status = response.status();

    if !status.is_success() {
        return Err(format!("API returned error: {}", status));
    }

    let video_data: SproutVideoDetails = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(video_data)
}
