use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use std::thread;
use tauri::{command, AppHandle, Emitter};

/// Copy a file using Finder's native UI via AppleScript
/// This shows the familiar macOS progress dialog with pause/cancel controls
fn copy_file_with_finder(src: &Path, dest: &Path) -> Result<(), String> {
    let src_str = src.to_string_lossy();
    let dest_parent = dest.parent().ok_or("Invalid destination path")?;
    let dest_parent_str = dest_parent.to_string_lossy();

    // AppleScript to copy file using Finder
    // This triggers the native macOS copy dialog with progress
    let script = format!(
        r#"
        tell application "Finder"
            set sourceFile to POSIX file "{}" as alias
            set destFolder to POSIX file "{}" as alias
            duplicate sourceFile to destFolder with replacing
        end tell
        "#,
        src_str, dest_parent_str
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Finder copy failed: {}", stderr));
    }

    Ok(())
}

#[command]
pub fn move_files(
    files: Vec<(String, u32)>,
    base_dest: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let app_handle = Arc::new(app_handle);
    let base_dest = Arc::new(base_dest);

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

            // Emit progress before starting each file (for UI feedback)
            let progress = (index as f64 / total_files as f64) * 100.0;
            let _ = app_handle.emit("copy_progress", progress);

            // Copy file using Finder's native UI
            if let Err(e) = copy_file_with_finder(src_path, &dest_file_path) {
                eprintln!("Failed to copy file {}: {}", file_path, e);
                continue;
            }

            moved_files.push(dest_file_path.to_string_lossy().to_string());
        }

        // Emit 100% progress before completion
        let _ = app_handle.emit("copy_progress", 100.0_f64);

        // Emit completion event when done
        let _ = app_handle.emit("copy_complete", moved_files);
    });

    Ok(()) // Return immediately so UI remains responsive
}
