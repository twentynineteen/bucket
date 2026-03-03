//! Tauri commands for BuildProject file transfer operations.
//!
//! This module provides:
//! - `transfer_files_with_progress`: Main file transfer command with progress events
//! - `cancel_file_transfer`: Cancel an in-progress transfer operation
//! - `TransferComplete`: Event payload for transfer completion

use crate::build_project::error::FileTransferError;
use crate::build_project::registry::OperationRegistry;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

/// Buffer size for file copying (64KB)
const BUFFER_SIZE: usize = 65536;

/// Progress update interval (100ms throttling)
const PROGRESS_UPDATE_INTERVAL: Duration = Duration::from_millis(100);

/// Stall timeout per file (30 seconds)
const STALL_TIMEOUT: Duration = Duration::from_secs(30);

/// Request structure for file transfer operations
#[derive(Debug, Clone, Deserialize)]
pub struct TransferRequest {
    /// List of files to transfer
    pub files: Vec<FileTransferItem>,
}

/// Individual file transfer item
#[derive(Debug, Clone, Deserialize)]
pub struct FileTransferItem {
    /// Source file path
    pub source: String,
    /// Destination file path
    pub destination: String,
}

/// Progress event payload emitted during file transfers
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressEvent {
    /// Unique operation identifier
    pub operation_id: String,
    /// Current file being transferred
    pub current_file: String,
    /// Number of files completed
    pub files_completed: usize,
    /// Total number of files to transfer
    pub total_files: usize,
    /// Bytes transferred so far
    pub bytes_transferred: u64,
    /// Total bytes to transfer
    pub total_bytes: u64,
    /// Overall percentage complete (0-100)
    pub percentage: f64,
}

/// Event payload emitted when a file transfer operation completes.
///
/// This struct is emitted via the "file-transfer-complete" event when a transfer
/// operation finishes, whether successfully, with errors, or cancelled.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferComplete {
    /// Unique identifier for this transfer operation
    pub operation_id: String,
    /// Whether the transfer completed successfully
    pub success: bool,
    /// Number of files successfully transferred
    pub files_transferred: usize,
    /// Error message if the transfer failed (None if successful)
    pub error: Option<String>,
}

impl TransferComplete {
    /// Create a successful transfer complete event
    pub fn success(operation_id: String, files_transferred: usize) -> Self {
        Self {
            operation_id,
            success: true,
            files_transferred,
            error: None,
        }
    }

    /// Create a failed transfer complete event
    pub fn failed(operation_id: String, files_transferred: usize, error: String) -> Self {
        Self {
            operation_id,
            success: false,
            files_transferred,
            error: Some(error),
        }
    }

    /// Create a cancelled transfer complete event
    pub fn cancelled(operation_id: String, files_transferred: usize) -> Self {
        Self {
            operation_id,
            success: false,
            files_transferred,
            error: Some("Transfer cancelled by user".to_string()),
        }
    }
}

/// Transfer files with progress tracking, cancellation support, and stall detection
///
/// # Arguments
/// * `app` - Tauri application handle for emitting events
/// * `registry` - Operation registry for tracking and cancellation
/// * `request` - Transfer request containing file pairs
///
/// # Returns
/// * `Ok(String)` - Operation ID on success (transfer continues in background)
/// * `Err(FileTransferError)` - Error details on validation failure
///
/// # Events Emitted
/// * `file-transfer-progress` - Progress updates (throttled to 100ms)
/// * `file-transfer-complete` - Transfer completed (success, failure, or cancellation)
#[tauri::command]
pub async fn transfer_files_with_progress(
    app: AppHandle,
    registry: State<'_, OperationRegistry>,
    request: TransferRequest,
) -> Result<String, FileTransferError> {
    // Validate request
    if request.files.is_empty() {
        return Err(FileTransferError::validation("No files to transfer"));
    }

    // Validate all source files exist before starting
    for item in &request.files {
        let source_path = Path::new(&item.source);
        if !source_path.exists() {
            return Err(FileTransferError::validation(&format!(
                "Source file does not exist: {}",
                item.source
            )));
        }
        if !source_path.is_file() {
            return Err(FileTransferError::validation(&format!(
                "Source path is not a file: {}",
                item.source
            )));
        }
    }

    // Register the operation (async - returns operation_id and cancel_receiver)
    let (operation_id, cancel_receiver) = registry.register().await;
    let operation_id_return = operation_id.clone();

    log::info!(
        "[BuildProject] Starting file transfer operation: {} ({} files)",
        operation_id,
        request.files.len()
    );

    // Calculate total bytes
    let total_bytes: u64 = request
        .files
        .iter()
        .filter_map(|item| fs::metadata(&item.source).ok())
        .map(|meta| meta.len())
        .sum();

    let total_files = request.files.len();

    // Clone for the async task
    let files = request.files.clone();
    let registry_clone = registry.inner().clone();

    // Spawn the transfer task in a blocking thread pool
    tokio::task::spawn_blocking(move || {
        let start_time = Instant::now();
        let mut bytes_transferred: u64 = 0;
        let mut files_completed: usize = 0;
        let mut last_progress_update = Instant::now();

        for (_file_index, item) in files.iter().enumerate() {
            // Check cancellation before starting each file using watch receiver
            if OperationRegistry::is_cancelled(&cancel_receiver) {
                let duration_ms = start_time.elapsed().as_millis() as u64;
                let complete_event =
                    TransferComplete::cancelled(operation_id.clone(), files_completed);
                log::info!(
                    "[BuildProject] Transfer cancelled: {} (files: {}/{}, duration: {}ms)",
                    operation_id,
                    files_completed,
                    total_files,
                    duration_ms
                );
                let _ = app.emit("file-transfer-complete", &complete_event);
                let rt = tokio::runtime::Handle::current();
                rt.block_on(async { registry_clone.complete(&operation_id).await });
                return;
            }

            let source_path = Path::new(&item.source);
            let dest_path = Path::new(&item.destination);

            // Ensure destination directory exists
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    if let Err(e) = fs::create_dir_all(parent) {
                        let complete_event = TransferComplete::failed(
                            operation_id.clone(),
                            files_completed,
                            format!("Failed to create directory: {}", e),
                        );
                        let _ = app.emit("file-transfer-complete", &complete_event);
                        let rt = tokio::runtime::Handle::current();
                        rt.block_on(async { registry_clone.complete(&operation_id).await });
                        return;
                    }
                }
            }

            // Open source file
            let src_file = match File::open(source_path) {
                Ok(f) => f,
                Err(e) => {
                    let complete_event = TransferComplete::failed(
                        operation_id.clone(),
                        files_completed,
                        format!("Failed to open source file: {}", e),
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }
            };

            let _file_size = match src_file.metadata() {
                Ok(m) => m.len(),
                Err(e) => {
                    let complete_event = TransferComplete::failed(
                        operation_id.clone(),
                        files_completed,
                        format!("Failed to get file metadata: {}", e),
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }
            };

            // Create destination file
            let dest_file = match File::create(dest_path) {
                Ok(f) => f,
                Err(e) => {
                    let complete_event = TransferComplete::failed(
                        operation_id.clone(),
                        files_completed,
                        format!("Failed to create destination file: {}", e),
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }
            };

            let mut reader = BufReader::new(src_file);
            let mut writer = BufWriter::new(dest_file);
            let mut buffer = vec![0u8; BUFFER_SIZE];
            let mut last_activity = Instant::now();

            // Copy file in chunks
            loop {
                // Check cancellation via watch channel
                if OperationRegistry::is_cancelled(&cancel_receiver) {
                    let _ = fs::remove_file(dest_path);
                    let duration_ms = start_time.elapsed().as_millis() as u64;
                    let complete_event =
                        TransferComplete::cancelled(operation_id.clone(), files_completed);
                    log::info!(
                        "[BuildProject] Transfer cancelled during copy: {} (files: {}/{}, duration: {}ms)",
                        operation_id,
                        files_completed,
                        total_files,
                        duration_ms
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }

                // Read chunk
                let bytes_read = match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => {
                        last_activity = Instant::now();
                        n
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(e) => {
                        let _ = fs::remove_file(dest_path);
                        let complete_event = TransferComplete::failed(
                            operation_id.clone(),
                            files_completed,
                            format!("Failed to read source file: {}", e),
                        );
                        let _ = app.emit("file-transfer-complete", &complete_event);
                        let rt = tokio::runtime::Handle::current();
                        rt.block_on(async { registry_clone.complete(&operation_id).await });
                        return;
                    }
                };

                // Write chunk
                if let Err(e) = writer.write_all(&buffer[..bytes_read]) {
                    let _ = fs::remove_file(dest_path);
                    let complete_event = TransferComplete::failed(
                        operation_id.clone(),
                        files_completed,
                        format!("Failed to write to destination: {}", e),
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }

                bytes_transferred += bytes_read as u64;

                // Check for stall timeout
                if last_activity.elapsed() > STALL_TIMEOUT {
                    let _ = fs::remove_file(dest_path);
                    let complete_event = TransferComplete::failed(
                        operation_id.clone(),
                        files_completed,
                        format!("Transfer stalled for file: {}", item.source),
                    );
                    let _ = app.emit("file-transfer-complete", &complete_event);
                    let rt = tokio::runtime::Handle::current();
                    rt.block_on(async { registry_clone.complete(&operation_id).await });
                    return;
                }

                // Emit throttled progress update
                if last_progress_update.elapsed() >= PROGRESS_UPDATE_INTERVAL {
                    let percentage = if total_bytes > 0 {
                        (bytes_transferred as f64 / total_bytes as f64) * 100.0
                    } else {
                        0.0
                    };

                    let progress = TransferProgressEvent {
                        operation_id: operation_id.clone(),
                        current_file: item.source.clone(),
                        files_completed,
                        total_files,
                        bytes_transferred,
                        total_bytes,
                        percentage,
                    };

                    let _ = app.emit("file-transfer-progress", &progress);
                    last_progress_update = Instant::now();
                }
            }

            // Flush and sync to ensure data is written to disk
            if let Err(e) = writer.flush() {
                let _ = fs::remove_file(dest_path);
                let complete_event = TransferComplete::failed(
                    operation_id.clone(),
                    files_completed,
                    format!("Failed to flush write buffer: {}", e),
                );
                let _ = app.emit("file-transfer-complete", &complete_event);
                let rt = tokio::runtime::Handle::current();
                rt.block_on(async { registry_clone.complete(&operation_id).await });
                return;
            }

            // CRITICAL: Ensure all data is written to disk before completing
            if let Err(e) = writer.get_mut().sync_all() {
                let _ = fs::remove_file(dest_path);
                let complete_event = TransferComplete::failed(
                    operation_id.clone(),
                    files_completed,
                    format!("Failed to sync file to disk: {}", e),
                );
                let _ = app.emit("file-transfer-complete", &complete_event);
                let rt = tokio::runtime::Handle::current();
                rt.block_on(async { registry_clone.complete(&operation_id).await });
                return;
            }

            files_completed += 1;

            // Emit progress for completed file
            let percentage = if total_bytes > 0 {
                (bytes_transferred as f64 / total_bytes as f64) * 100.0
            } else {
                100.0
            };

            let progress = TransferProgressEvent {
                operation_id: operation_id.clone(),
                current_file: item.source.clone(),
                files_completed,
                total_files,
                bytes_transferred,
                total_bytes,
                percentage,
            };

            let _ = app.emit("file-transfer-progress", &progress);
        }

        // Emit completion event
        let duration_ms = start_time.elapsed().as_millis() as u64;
        let complete_event = TransferComplete::success(operation_id.clone(), files_completed);

        log::info!(
            "[BuildProject] Transfer complete: {} (success: true, files: {}/{}, duration: {}ms)",
            operation_id,
            files_completed,
            total_files,
            duration_ms
        );

        let _ = app.emit("file-transfer-complete", &complete_event);

        // Remove operation from registry
        let rt = tokio::runtime::Handle::current();
        rt.block_on(async { registry_clone.complete(&operation_id).await });
    });

    Ok(operation_id_return)
}

/// Cancel an in-progress file transfer operation.
///
/// This command signals cancellation to an ongoing transfer operation. The transfer
/// will stop at the next safe point (after completing the current chunk copy).
///
/// # Arguments
/// * `registry` - The operation registry state managed by Tauri
/// * `operation_id` - The unique identifier of the operation to cancel
///
/// # Returns
/// * `Ok(true)` - Operation was found and cancellation was signalled
/// * `Ok(false)` - Operation not found (may have already completed)
#[tauri::command]
pub async fn cancel_file_transfer(
    registry: State<'_, OperationRegistry>,
    operation_id: String,
) -> Result<bool, String> {
    log::info!(
        "[BuildProject] Cancel requested for operation: {}",
        operation_id
    );

    // Check if operation exists
    if !registry.has_operation(&operation_id).await {
        log::info!(
            "[BuildProject] Operation {} not found (already completed or never existed)",
            operation_id
        );
        return Ok(false);
    }

    // Signal cancellation via the watch channel
    let cancelled = registry.cancel(&operation_id).await;

    if cancelled {
        log::info!(
            "[BuildProject] Cancellation signalled for operation: {}",
            operation_id
        );
    } else {
        log::warn!(
            "[BuildProject] Failed to signal cancellation for operation: {}",
            operation_id
        );
    }

    Ok(cancelled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transfer_complete_success() {
        let complete = TransferComplete::success("test-op".to_string(), 5);
        assert!(complete.success);
        assert_eq!(complete.files_transferred, 5);
        assert!(complete.error.is_none());
    }

    #[test]
    fn test_transfer_complete_failed() {
        let complete = TransferComplete::failed("test-op".to_string(), 3, "Disk full".to_string());
        assert!(!complete.success);
        assert_eq!(complete.files_transferred, 3);
        assert_eq!(complete.error, Some("Disk full".to_string()));
    }

    #[test]
    fn test_transfer_complete_cancelled() {
        let complete = TransferComplete::cancelled("test-op".to_string(), 2);
        assert!(!complete.success);
        assert_eq!(complete.files_transferred, 2);
        assert!(complete.error.unwrap().contains("cancelled"));
    }

    #[test]
    fn test_transfer_complete_serialization() {
        let complete = TransferComplete::success("op-123".to_string(), 10);
        let json = serde_json::to_string(&complete).unwrap();
        assert!(json.contains("\"operationId\":\"op-123\""));
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"filesTransferred\":10"));
        assert!(json.contains("\"error\":null"));
    }

    #[test]
    fn test_file_transfer_item_deserialization() {
        let json = r#"{"source": "/path/to/video.mp4", "destination": "/dest/video.mp4"}"#;
        let item: FileTransferItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.source, "/path/to/video.mp4");
        assert_eq!(item.destination, "/dest/video.mp4");
    }

    #[test]
    fn test_transfer_progress_event_serialization() {
        let event = TransferProgressEvent {
            operation_id: "op-456".to_string(),
            current_file: "video.mp4".to_string(),
            files_completed: 2,
            total_files: 5,
            bytes_transferred: 1024,
            total_bytes: 2048,
            percentage: 50.0,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"operationId\":\"op-456\""));
        assert!(json.contains("\"currentFile\":\"video.mp4\""));
        assert!(json.contains("\"filesCompleted\":2"));
    }
}
