use crate::utils::file_copy::copy_file_with_overall_progress;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use tauri::{command, AppHandle, Emitter};

#[command]
pub fn move_files(
    files: Vec<(String, u32)>,
    base_dest: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let app_handle = Arc::new(app_handle); // Allow sharing across threads
    let base_dest = Arc::new(base_dest); // Shared reference

    // Run file moving in a separate thread
    thread::spawn(move || {
        let mut moved_files = Vec::new();
        let mut failed_files: Vec<(String, String)> = Vec::new();
        let total_files = files.len();

        for (index, (file_path, camera_number)) in files.iter().enumerate() {
            let src_path = Path::new(&file_path);
            let camera_folder =
                Path::new(base_dest.as_str()).join(format!("Footage/Camera {}", camera_number));

            // Ensure the Camera folder exists
            if !camera_folder.exists() {
                if let Err(e) = fs::create_dir_all(&camera_folder) {
                    let error_msg = format!("Failed to create camera folder {}: {}", camera_number, e);
                    eprintln!("{}", error_msg);

                    // Emit individual error event
                    let _ = app_handle.emit("copy_file_error", serde_json::json!({
                        "file": file_path,
                        "error": error_msg
                    }));

                    failed_files.push((file_path.clone(), error_msg));
                    continue;
                }
            }

            let dest_file_path = camera_folder.join(src_path.file_name().unwrap());

            // Copy file with overall progress tracking
            if let Err(e) = copy_file_with_overall_progress(
                src_path,
                &dest_file_path,
                &app_handle,
                index,
                total_files,
            ) {
                let error_msg = format!("Failed to copy file {}: {}", file_path, e);
                eprintln!("{}", error_msg);

                // Emit individual error event
                let _ = app_handle.emit("copy_file_error", serde_json::json!({
                    "file": file_path,
                    "error": error_msg
                }));

                failed_files.push((file_path.clone(), error_msg));
                continue;
            }

            moved_files.push(dest_file_path.to_string_lossy().to_string());
        }

        // Emit completion event based on whether there were errors
        if failed_files.is_empty() {
            let _ = app_handle.emit("copy_complete", moved_files);
        } else {
            // Convert failed_files to array of objects for consistent frontend format
            let failed_files_json: Vec<serde_json::Value> = failed_files
                .iter()
                .map(|(file, error)| serde_json::json!({"file": file, "error": error}))
                .collect();

            let _ = app_handle.emit("copy_complete_with_errors", serde_json::json!({
                "successful_files": moved_files,
                "failed_files": failed_files_json,
                "failure_count": failed_files.len(),
                "success_count": moved_files.len(),
                "total_files": total_files
            }));
        }
    });

    Ok(()) // Return immediately so UI remains responsive
}
