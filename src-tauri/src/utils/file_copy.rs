use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use tauri::{AppHandle, Emitter};

/// File Copy with Overall Progress Tracking across multiple files
pub fn copy_file_with_overall_progress(
    src: &Path,
    dest: &Path,
    app_handle: &AppHandle,
    file_index: usize,
    total_files: usize,
) -> std::io::Result<()> {
    let src_file = File::open(src)?;
    let dest_file = File::create(dest)?;
    let metadata = src.metadata()?;
    let total_size = metadata.len();
    let mut copied_size: u64 = 0;

    let mut reader = BufReader::new(src_file);
    let mut writer = BufWriter::new(dest_file);
    let mut buffer = [0; 8192];

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        writer.write_all(&buffer[..bytes_read])?;
        copied_size += bytes_read as u64;

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
}
