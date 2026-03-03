use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Default timeout in seconds for file operations (30 seconds of no progress)
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Error type for file copy operations
#[derive(Debug)]
pub enum CopyError {
    Io(std::io::Error),
    Timeout { file: String, elapsed_secs: u64 },
}

impl std::fmt::Display for CopyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CopyError::Io(e) => write!(f, "{}", e),
            CopyError::Timeout { file, elapsed_secs } => {
                write!(
                    f,
                    "Timeout copying '{}': no progress for {} seconds",
                    file, elapsed_secs
                )
            }
        }
    }
}

impl From<std::io::Error> for CopyError {
    fn from(err: std::io::Error) -> Self {
        CopyError::Io(err)
    }
}

/// File Copy with configurable timeout
///
/// # Arguments
/// * `src` - Source file path
/// * `dest` - Destination file path
/// * `app_handle` - Tauri app handle for emitting progress events
/// * `file_index` - Current file index (0-based)
/// * `total_files` - Total number of files being copied
/// * `timeout_secs` - Maximum seconds allowed without progress before timeout
pub fn copy_file_with_timeout(
    src: &Path,
    dest: &Path,
    app_handle: &AppHandle,
    file_index: usize,
    total_files: usize,
    timeout_secs: u64,
) -> Result<(), CopyError> {
    let src_file = File::open(src)?;
    let dest_file = File::create(dest)?;
    let metadata = src.metadata()?;
    let total_size = metadata.len();
    let mut copied_size: u64 = 0;

    let mut reader = BufReader::new(src_file);
    let mut writer = BufWriter::new(dest_file);
    let mut buffer = [0; 8192];

    // Timeout tracking with watchdog thread
    let cancelled = Arc::new(AtomicBool::new(false));
    let last_progress = Arc::new(Mutex::new(Instant::now()));
    let timeout = Duration::from_secs(timeout_secs);

    // Clone for watchdog
    let cancelled_watchdog = cancelled.clone();
    let last_progress_watchdog = last_progress.clone();

    // Watchdog thread monitors progress and sets cancelled flag on timeout
    let watchdog = thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(1));

            // Check if we should stop (operation completed or already cancelled)
            if cancelled_watchdog.load(Ordering::SeqCst) {
                break;
            }

            // Check for timeout
            let elapsed = last_progress_watchdog.lock().unwrap().elapsed();
            if elapsed > timeout {
                cancelled_watchdog.store(true, Ordering::SeqCst);
                break;
            }
        }
    });

    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| src.to_string_lossy().to_string());

    let result = (|| -> Result<(), CopyError> {
        loop {
            // Check for timeout cancellation before each read
            if cancelled.load(Ordering::SeqCst) {
                let elapsed = last_progress.lock().unwrap().elapsed().as_secs();
                return Err(CopyError::Timeout {
                    file: file_name.clone(),
                    elapsed_secs: elapsed,
                });
            }

            let bytes_read = reader.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }

            // Check for timeout after read (in case read was slow)
            if cancelled.load(Ordering::SeqCst) {
                let elapsed = last_progress.lock().unwrap().elapsed().as_secs();
                return Err(CopyError::Timeout {
                    file: file_name.clone(),
                    elapsed_secs: elapsed,
                });
            }

            writer.write_all(&buffer[..bytes_read])?;
            copied_size += bytes_read as u64;

            // Update last progress time
            *last_progress.lock().unwrap() = Instant::now();

            // Calculate overall progress across all files
            let file_progress = copied_size as f64 / total_size as f64;
            let files_completed = file_index as f64;
            let overall_progress = (files_completed + file_progress) / total_files as f64 * 100.0;

            let _ = app_handle.emit("copy_progress", overall_progress);
        }

        writer.flush()?;

        // CRITICAL: Ensure all data is written to disk before completing.
        // This is especially important for large files and network drives where
        // OS buffers may take significant time to flush. Without this, the
        // copy_complete event can fire before files are fully written, causing
        // subsequent operations (like Premiere template creation) to fail or hang.
        writer.get_mut().sync_all()?;

        Ok(())
    })();

    // Signal watchdog to stop and wait for it
    cancelled.store(true, Ordering::SeqCst);
    let _ = watchdog.join();

    result
}

/// Check if an error is a timeout error
pub fn is_timeout_error(err: &CopyError) -> bool {
    matches!(err, CopyError::Timeout { .. })
}
