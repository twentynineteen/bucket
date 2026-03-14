use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

use super::types::*;

pub fn get_current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn should_skip_directory(path: &Path) -> bool {
    if let Some(name) = path.file_name() {
        let name_str = name.to_string_lossy();
        SKIP_PATTERNS
            .iter()
            .any(|pattern| name_str.contains(pattern))
    } else {
        false
    }
}

pub fn calculate_folder_size(path: &Path) -> Result<u64, std::io::Error> {
    let mut total_size = 0u64;

    fn visit_dir(dir: &Path, total: &mut u64) -> Result<(), std::io::Error> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    visit_dir(&path, total)?;
                } else if let Ok(metadata) = entry.metadata() {
                    *total += metadata.len();
                }
            }
        }
        Ok(())
    }

    visit_dir(path, &mut total_size)?;
    Ok(total_size)
}

/// Scan camera folders under Footage/ and return sorted FileInfo entries.
/// This is the shared logic used by stale detection, breadcrumbs update, and file scanning.
pub fn scan_camera_files(path: &Path) -> Vec<FileInfo> {
    let mut files = Vec::new();
    let footage_path = path.join("Footage");

    if let Ok(entries) = fs::read_dir(&footage_path) {
        for entry in entries.flatten() {
            let folder_name = entry.file_name();
            let name_str = folder_name.to_string_lossy().to_string();

            if name_str.starts_with("Camera ") && entry.path().is_dir() {
                if let Some(camera_num_str) = name_str.strip_prefix("Camera ") {
                    if let Ok(camera_num) = camera_num_str.parse::<i32>() {
                        if let Ok(camera_files) = fs::read_dir(entry.path()) {
                            for file in camera_files.flatten() {
                                let file_name =
                                    file.file_name().to_string_lossy().to_string();

                                // Skip hidden files (starting with .) like .DS_Store
                                if file_name.starts_with('.') {
                                    continue;
                                }

                                if file.path().is_file() {
                                    files.push(FileInfo {
                                        camera: camera_num,
                                        name: file_name.clone(),
                                        path: format!(
                                            "Footage/{}/{}",
                                            name_str, file_name
                                        ),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    files.sort_by(|a, b| a.camera.cmp(&b.camera).then_with(|| a.name.cmp(&b.name)));
    files
}

pub fn check_breadcrumbs_stale(path: &Path) -> Result<bool, std::io::Error> {
    let breadcrumbs_path = path.join("breadcrumbs.json");

    if !breadcrumbs_path.exists() {
        return Ok(false);
    }

    let content = fs::read_to_string(&breadcrumbs_path)?;
    let existing_breadcrumbs: BreadcrumbsFile = match serde_json::from_str(&content) {
        Ok(breadcrumbs) => breadcrumbs,
        Err(parse_err) => {
            println!(
                "[Baker] Breadcrumbs parsing failed for {}: {}",
                path.display(),
                parse_err
            );
            return Ok(false);
        }
    };

    let actual_files = scan_camera_files(path);

    // Compare files: check if counts or content differ
    if existing_breadcrumbs.files.len() != actual_files.len() {
        return Ok(true);
    }

    // Sort existing for comparison
    let mut existing_files = existing_breadcrumbs.files.clone();
    existing_files.sort_by(|a, b| a.camera.cmp(&b.camera).then_with(|| a.name.cmp(&b.name)));

    // Compare file names and camera assignments
    for (existing, actual) in existing_files.iter().zip(actual_files.iter()) {
        if existing.name != actual.name || existing.camera != actual.camera {
            return Ok(true);
        }
    }

    // Compare folder size to detect file content changes (with 1KB threshold)
    let current_folder_size = calculate_folder_size(path).unwrap_or(0);
    if let Some(existing_size) = existing_breadcrumbs.folder_size_bytes {
        let size_diff = current_folder_size.abs_diff(existing_size);

        if size_diff >= STALE_SIZE_THRESHOLD_BYTES {
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn has_invalid_breadcrumbs_file(path: &Path) -> bool {
    let breadcrumbs_path = path.join("breadcrumbs.json");

    if !breadcrumbs_path.exists() {
        return false;
    }

    match fs::read_to_string(&breadcrumbs_path) {
        Ok(content) => match serde_json::from_str::<BreadcrumbsFile>(&content) {
            Ok(_) => false,
            Err(_) => {
                println!(
                    "[Baker] Invalid breadcrumbs file detected: {}",
                    path.display()
                );
                true
            }
        },
        Err(_) => {
            println!(
                "[Baker] Unreadable breadcrumbs file detected: {}",
                path.display()
            );
            true
        }
    }
}

pub fn validate_project_folder(path: &Path) -> (bool, Vec<String>, i32) {
    let mut errors = Vec::new();
    let mut camera_count = 0;

    if !path.exists() {
        errors.push("Folder does not exist".to_string());
        return (false, errors, 0);
    }

    let required_folders = vec!["Footage", "Graphics", "Renders", "Projects", "Scripts"];

    for folder in &required_folders {
        let subfolder = path.join(folder);
        if !subfolder.exists() || !subfolder.is_dir() {
            errors.push(format!("Missing required subfolder: {}", folder));
        }
    }

    let footage_path = path.join("Footage");
    if footage_path.exists() {
        if let Ok(entries) = fs::read_dir(&footage_path) {
            for entry in entries.flatten() {
                let file_name = entry.file_name();
                let name_str = file_name.to_string_lossy();
                if name_str.starts_with("Camera ") && entry.path().is_dir() {
                    camera_count += 1;
                }
            }
        }
    }

    if camera_count == 0 {
        errors.push("No Camera folders found in Footage directory".to_string());
    }

    (errors.is_empty(), errors, camera_count)
}

pub fn has_breadcrumbs_file(path: &Path) -> bool {
    let breadcrumbs_path = path.join("breadcrumbs.json");

    if !breadcrumbs_path.exists() {
        println!(
            "[Baker] Breadcrumbs check: {} -> MISSING (file not found)",
            path.display()
        );
        return false;
    }

    match fs::read_to_string(&breadcrumbs_path) {
        Ok(content) => match serde_json::from_str::<BreadcrumbsFile>(&content) {
            Ok(_) => {
                println!(
                    "[Baker] Breadcrumbs check: {} -> FOUND (valid)",
                    path.display()
                );
                true
            }
            Err(e) => {
                println!(
                    "[Baker] Breadcrumbs check: {} -> INVALID (parse error: {})",
                    path.display(),
                    e
                );
                false
            }
        },
        Err(e) => {
            println!(
                "[Baker] Breadcrumbs check: {} -> INVALID (read error: {})",
                path.display(),
                e
            );
            false
        }
    }
}

pub fn scan_directory_recursive(
    root_path: &Path,
    options: &ScanOptions,
    app_handle: &AppHandle,
    scan_id: &str,
) -> Result<ScanResult, String> {
    let mut result = ScanResult {
        start_time: get_current_timestamp(),
        end_time: None,
        root_path: root_path.to_string_lossy().to_string(),
        total_folders: 0,
        valid_projects: 0,
        updated_breadcrumbs: 0,
        created_breadcrumbs: 0,
        total_folder_size: 0,
        errors: Vec::new(),
        projects: Vec::new(),
    };

    let mut folders_scanned = 0;
    let mut last_progress_update = Instant::now();

    struct VisitContext<'a> {
        max_depth: i32,
        include_hidden: bool,
        app_handle: &'a AppHandle,
        scan_id: &'a str,
    }

    fn visit_directory(
        dir: &Path,
        depth: i32,
        ctx: &VisitContext,
        result: &mut ScanResult,
        folders_scanned: &mut i32,
        last_progress_update: &mut Instant,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if depth > ctx.max_depth {
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let file_name = entry.file_name();
                let name_str = file_name.to_string_lossy();

                if !ctx.include_hidden && name_str.starts_with('.') {
                    continue;
                }

                if should_skip_directory(&path) {
                    continue;
                }

                *folders_scanned += 1;
                result.total_folders = *folders_scanned;

                if last_progress_update.elapsed() >= PROGRESS_UPDATE_INTERVAL {
                    let progress_event = ScanProgressEvent {
                        scan_id: ctx.scan_id.to_string(),
                        folders_scanned: *folders_scanned,
                        total_folders: *folders_scanned,
                        current_path: path.to_string_lossy().to_string(),
                        projects_found: result.valid_projects,
                    };

                    let _ = ctx.app_handle.emit("baker_scan_progress", progress_event);
                    *last_progress_update = Instant::now();
                }

                let (is_valid, validation_errors, camera_count) = validate_project_folder(&path);
                let has_breadcrumbs = has_breadcrumbs_file(&path);
                let invalid_breadcrumbs = has_invalid_breadcrumbs_file(&path);

                println!("[Baker] Sub-folder: {} | Valid: {} | HasBreadcrumbs: {} | InvalidBreadcrumbs: {} | CameraCount: {}",
                    path.display(), is_valid, has_breadcrumbs, invalid_breadcrumbs, camera_count);

                if is_valid || has_breadcrumbs || invalid_breadcrumbs {
                    if is_valid {
                        result.valid_projects += 1;
                    }

                    let stale_breadcrumbs = if has_breadcrumbs {
                        check_breadcrumbs_stale(&path).unwrap_or(false)
                    } else {
                        false
                    };

                    let project_folder = ProjectFolder {
                        path: path.to_string_lossy().to_string(),
                        name: file_name.to_string_lossy().to_string(),
                        is_valid,
                        has_breadcrumbs,
                        stale_breadcrumbs,
                        last_scanned: get_current_timestamp(),
                        camera_count,
                        validation_errors: validation_errors.clone(),
                        invalid_breadcrumbs,
                    };

                    let folder_size = calculate_folder_size(&path).unwrap_or(0);
                    result.total_folder_size += folder_size;

                    result.projects.push(project_folder);
                } else if !validation_errors.is_empty() {
                    let has_footage_or_graphics =
                        path.join("Footage").exists() || path.join("Graphics").exists();

                    if !has_footage_or_graphics {
                        visit_directory(
                            &path,
                            depth + 1,
                            ctx,
                            result,
                            folders_scanned,
                            last_progress_update,
                        )?;
                    }
                }

                if is_valid || has_breadcrumbs || invalid_breadcrumbs {
                    let discovery_event = serde_json::json!({
                        "scanId": ctx.scan_id,
                        "projectPath": path.to_string_lossy(),
                        "isValid": is_valid,
                        "hasBreadcrumbs": has_breadcrumbs,
                        "invalidBreadcrumbs": invalid_breadcrumbs,
                        "errors": validation_errors
                    });

                    let _ = ctx.app_handle.emit("baker_scan_discovery", discovery_event);
                }
            }
        }

        Ok(())
    }

    // First check the root directory itself
    let (is_valid, validation_errors, camera_count) = validate_project_folder(root_path);
    let has_breadcrumbs = has_breadcrumbs_file(root_path);
    let invalid_breadcrumbs = has_invalid_breadcrumbs_file(root_path);

    println!("[Baker] ===== ROOT FOLDER ANALYSIS =====");
    println!("[Baker] Path: {}", root_path.display());
    println!("[Baker] Valid BuildProject: {}", is_valid);
    println!("[Baker] Has breadcrumbs.json: {}", has_breadcrumbs);
    println!("[Baker] Invalid breadcrumbs.json: {}", invalid_breadcrumbs);
    println!("[Baker] Camera count: {}", camera_count);
    if !validation_errors.is_empty() {
        println!("[Baker] Validation errors: {:?}", validation_errors);
    }
    println!("[Baker] ================================");

    if is_valid || has_breadcrumbs || invalid_breadcrumbs {
        if is_valid {
            result.valid_projects += 1;
        }

        let stale_breadcrumbs = if has_breadcrumbs {
            check_breadcrumbs_stale(root_path).unwrap_or(false)
        } else {
            false
        };

        let project_folder = ProjectFolder {
            path: root_path.to_string_lossy().to_string(),
            name: root_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            is_valid,
            has_breadcrumbs,
            stale_breadcrumbs,
            last_scanned: get_current_timestamp(),
            camera_count,
            validation_errors: validation_errors.clone(),
            invalid_breadcrumbs,
        };

        let root_folder_size = calculate_folder_size(root_path).unwrap_or(0);
        result.total_folder_size += root_folder_size;

        result.projects.push(project_folder);

        let discovery_event = serde_json::json!({
            "scanId": scan_id,
            "projectPath": root_path.to_string_lossy(),
            "isValid": is_valid,
            "hasBreadcrumbs": has_breadcrumbs,
            "invalidBreadcrumbs": invalid_breadcrumbs,
            "errors": validation_errors
        });
        let _ = app_handle.emit("baker_scan_discovery", discovery_event);
    }

    let ctx = VisitContext {
        max_depth: options.max_depth,
        include_hidden: options.include_hidden,
        app_handle,
        scan_id,
    };

    match visit_directory(
        root_path,
        0,
        &ctx,
        &mut result,
        &mut folders_scanned,
        &mut last_progress_update,
    ) {
        Ok(_) => {
            result.end_time = Some(get_current_timestamp());
            Ok(result)
        }
        Err(e) => {
            result.errors.push(ScanError {
                path: root_path.to_string_lossy().to_string(),
                r#type: "filesystem".to_string(),
                message: e.to_string(),
                timestamp: get_current_timestamp(),
            });
            result.end_time = Some(get_current_timestamp());
            Ok(result)
        }
    }
}
