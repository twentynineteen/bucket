//! The facts about a project folder that its breadcrumbs file records.
//!
//! Baker's scanner calls these too, so a rescan and a stale check measure the
//! folder the same way.

use std::fs;
use std::io;
use std::path::Path;

use super::{FileInfo, BACKUP_NAME, FILE_NAME, TEMP_PREFIX};

/// `N` for a `Camera N` folder name.
fn camera_number(folder_name: &str) -> Option<i32> {
    folder_name.strip_prefix("Camera ")?.parse().ok()
}

/// Every non-hidden file in each `Footage/Camera N` folder, sorted by camera
/// then name, with project-relative paths.
pub fn camera_files(project: &Path) -> Vec<FileInfo> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(project.join("Footage")) else {
        return files;
    };

    for folder in entries.flatten() {
        let folder_name = folder.file_name().to_string_lossy().to_string();
        let Some(camera) = camera_number(&folder_name) else {
            continue;
        };
        let Ok(camera_entries) = fs::read_dir(folder.path()) else {
            continue;
        };
        for file in camera_entries.flatten() {
            let name = file.file_name().to_string_lossy().to_string();
            // Hidden files (.DS_Store and friends) are not footage.
            if name.starts_with('.') || !file.path().is_file() {
                continue;
            }
            files.push(FileInfo {
                camera,
                path: format!("Footage/{folder_name}/{name}"),
                name,
            });
        }
    }

    files.sort_by(|a, b| a.camera.cmp(&b.camera).then_with(|| a.name.cmp(&b.name)));
    files
}

/// How many `Footage/Camera N` folders exist, empty ones included.
pub fn camera_folder_count(project: &Path) -> i32 {
    let Ok(entries) = fs::read_dir(project.join("Footage")) else {
        return 0;
    };
    entries
        .flatten()
        .filter(|entry| {
            entry.path().is_dir() && camera_number(&entry.file_name().to_string_lossy()).is_some()
        })
        .count() as i32
}

/// Total bytes of every file under the project, except the breadcrumbs file,
/// its backup and any in-flight temp file. Leaving those out keeps the size stable across the very
/// write that records it.
pub fn folder_size(project: &Path) -> io::Result<u64> {
    fn visit(dir: &Path, top: bool, total: &mut u64) -> io::Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                visit(&path, false, total)?;
                continue;
            }
            let name = entry.file_name();
            let is_ours = name == FILE_NAME
                || name == BACKUP_NAME
                || name.to_string_lossy().starts_with(TEMP_PREFIX);
            if top && is_ours {
                continue;
            }
            *total += entry.metadata()?.len();
        }
        Ok(())
    }

    let mut total = 0;
    visit(project, true, &mut total)?;
    Ok(total)
}
