use crate::utils::file_copy::{copy_file_with_timeout, is_timeout_error, DEFAULT_TIMEOUT_SECS};
use fs2::available_space;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use tauri::{command, AppHandle, Emitter};

/// Check if there is sufficient disk space at the given path for the required bytes.
///
/// # Arguments
/// * `path` - The path to check available space (will use the mount point containing this path)
/// * `required_bytes` - The number of bytes needed
///
/// # Returns
/// * `Ok(true)` - Sufficient space available
/// * `Ok(false)` - Insufficient space
/// * `Err(String)` - Error checking disk space
#[command]
pub fn check_disk_space(path: String, required_bytes: u64) -> Result<bool, String> {
    let path = Path::new(&path);

    // Get available space at the path
    let available = available_space(path).map_err(|e| {
        format!(
            "Failed to check disk space for '{}': {}",
            path.display(),
            e
        )
    })?;

    Ok(available >= required_bytes)
}

/// Move files to destination with camera folder organization
///
/// # Arguments
/// * `files` - Vector of (file_path, camera_number) tuples
/// * `base_dest` - Base destination folder
/// * `timeout_secs` - Optional timeout in seconds for each file operation (default: 30)
/// * `app_handle` - Tauri app handle for emitting events
///
/// # Events Emitted
/// * `copy_progress` - Progress percentage (0-100)
/// * `copy_complete` - Array of successfully copied file paths
/// * `copy_error` - Error message if a critical error occurs (e.g., timeout)
#[command]
pub fn move_files(
    files: Vec<(String, u32)>,
    base_dest: String,
    timeout_secs: Option<u64>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let app_handle = Arc::new(app_handle); // Allow sharing across threads
    let base_dest = Arc::new(base_dest); // Shared reference
    let timeout = timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);

    // Run file moving in a separate thread
    thread::spawn(move || {
        let mut moved_files = Vec::new();
        let total_files = files.len();

        for (index, (file_path, camera_number)) in files.iter().enumerate() {
            let src_path = Path::new(&file_path);
            let camera_folder =
                Path::new(base_dest.as_str()).join(format!("Footage/Camera {}", camera_number));

            // Ensure the Camera folder exists
            if !camera_folder.exists() {
                if let Err(e) = fs::create_dir_all(&camera_folder) {
                    eprintln!("Failed to create camera folder {}: {}", camera_number, e);
                    continue;
                }
            }

            let dest_file_path = camera_folder.join(src_path.file_name().unwrap());

            // Copy file with timeout protection
            match copy_file_with_timeout(
                src_path,
                &dest_file_path,
                &app_handle,
                index,
                total_files,
                timeout,
            ) {
                Ok(()) => {
                    moved_files.push(dest_file_path.to_string_lossy().to_string());
                }
                Err(e) => {
                    eprintln!("Failed to copy file {}: {}", file_path, e);

                    // For timeout errors, emit error event and abort the entire operation
                    // This prevents the user from waiting indefinitely
                    if is_timeout_error(&e) {
                        let _ = app_handle.emit("copy_error", e.to_string());
                        // Still emit copy_complete with partial results so UI can show what succeeded
                        let _ = app_handle.emit("copy_complete", moved_files);
                        return;
                    }

                    // For other errors, continue with remaining files
                    continue;
                }
            }
        }

        // Emit completion event when done
        let _ = app_handle.emit("copy_complete", moved_files);
    });

    Ok(()) // Return immediately so UI remains responsive
}
