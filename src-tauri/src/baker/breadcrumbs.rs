use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use super::scanning::*;
use super::types::*;

#[tauri::command]
pub async fn baker_start_scan(
    root_path: String,
    options: ScanOptions,
    state: State<'_, ScanState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let path = Path::new(&root_path);

    println!(
        "[Baker] Starting scan: Path={}, MaxDepth={}, IncludeHidden={}",
        root_path, options.max_depth, options.include_hidden
    );

    if !path.exists() {
        let error_msg = "Root path does not exist".to_string();
        println!("[Baker] Scan validation failed: {}", error_msg);
        return Err(error_msg);
    }

    if !path.is_dir() {
        let error_msg = "Root path is not a directory".to_string();
        println!("[Baker] Scan validation failed: {}", error_msg);
        return Err(error_msg);
    }

    if options.max_depth < 1 {
        return Err("Max depth must be at least 1".to_string());
    }

    let scan_id = Uuid::new_v4().to_string();
    println!("[Baker] Generated scan ID: {}", scan_id);

    let scan_id_clone = scan_id.clone();
    let path_clone = path.to_path_buf();
    let options_clone = options.clone();
    let scans_ref = state.scans.clone();
    let app_handle_clone = app_handle.clone();

    tokio::spawn(async move {
        println!(
            "[Baker] Starting background scan task for ID: {}",
            scan_id_clone
        );
        let scan_start = Instant::now();

        match scan_directory_recursive(
            &path_clone,
            &options_clone,
            &app_handle_clone,
            &scan_id_clone,
        ) {
            Ok(result) => {
                let scan_duration = scan_start.elapsed();
                println!("[Baker] Scan completed successfully in {:.2}s: {} projects found, {} folders scanned",
                    scan_duration.as_secs_f32(), result.valid_projects, result.total_folders);

                if let Ok(mut scans) = scans_ref.lock() {
                    scans.insert(scan_id_clone.clone(), result.clone());
                }

                let complete_event = serde_json::json!({
                    "scanId": scan_id_clone,
                    "result": result
                });

                let _ = app_handle_clone.emit("baker_scan_complete", complete_event);
            }
            Err(e) => {
                let scan_duration = scan_start.elapsed();
                println!(
                    "[Baker] Scan failed after {:.2}s with error: {}",
                    scan_duration.as_secs_f32(),
                    e
                );

                let error_event = serde_json::json!({
                    "scanId": scan_id_clone,
                    "error": {
                        "path": path_clone.to_string_lossy(),
                        "type": "filesystem",
                        "message": e,
                        "timestamp": get_current_timestamp()
                    }
                });

                let _ = app_handle_clone.emit("baker_scan_error", error_event);
            }
        }
    });

    Ok(scan_id)
}

#[tauri::command]
pub async fn baker_get_scan_status(
    scan_id: String,
    state: State<'_, ScanState>,
) -> Result<ScanResult, String> {
    let scans = state.scans.lock().map_err(|_| "Failed to acquire lock")?;

    scans
        .get(&scan_id)
        .cloned()
        .ok_or_else(|| "Scan ID not found".to_string())
}

#[tauri::command]
pub async fn baker_cancel_scan(scan_id: String, state: State<'_, ScanState>) -> Result<(), String> {
    let mut scans = state.scans.lock().map_err(|_| "Failed to acquire lock")?;

    if let Some(result) = scans.get_mut(&scan_id) {
        if result.end_time.is_none() {
            result.end_time = Some(get_current_timestamp());
        }
    } else {
        return Err("Scan ID not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn baker_validate_folder(folder_path: String) -> Result<ProjectFolder, String> {
    let path = Path::new(&folder_path);

    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }

    let (is_valid, validation_errors, camera_count) = validate_project_folder(path);
    let has_breadcrumbs = has_breadcrumbs_file(path);
    let invalid_breadcrumbs = has_invalid_breadcrumbs_file(path);
    let stale_breadcrumbs = if has_breadcrumbs {
        check_breadcrumbs_stale(path).unwrap_or(false)
    } else {
        false
    };

    Ok(ProjectFolder {
        path: folder_path.clone(),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        is_valid,
        has_breadcrumbs,
        stale_breadcrumbs,
        last_scanned: get_current_timestamp(),
        camera_count,
        validation_errors,
        invalid_breadcrumbs,
    })
}

#[tauri::command]
pub async fn baker_read_breadcrumbs(
    project_path: String,
) -> Result<Option<BreadcrumbsFile>, String> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let breadcrumbs_path = path.join("breadcrumbs.json");

    if !breadcrumbs_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&breadcrumbs_path)
        .map_err(|e| format!("Failed to read breadcrumbs file: {}", e))?;

    let breadcrumbs: BreadcrumbsFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse breadcrumbs file: {}", e))?;

    Ok(Some(breadcrumbs))
}

#[tauri::command]
pub async fn baker_update_breadcrumbs(
    project_paths: Vec<String>,
    create_missing: bool,
    backup_originals: bool,
) -> Result<BatchUpdateResult, String> {
    if project_paths.is_empty() {
        return Err("Project paths cannot be empty".to_string());
    }

    let mut result = BatchUpdateResult {
        successful: Vec::new(),
        failed: Vec::new(),
        created: Vec::new(),
        updated: Vec::new(),
    };

    for project_path in project_paths {
        let path = Path::new(&project_path);

        if !path.exists() {
            result.failed.push(FailedUpdate {
                path: project_path.clone(),
                error: "Path does not exist".to_string(),
            });
            continue;
        }

        let breadcrumbs_path = path.join("breadcrumbs.json");
        let exists = breadcrumbs_path.exists();

        if !exists && !create_missing {
            continue;
        }

        // Create backup if requested and file exists
        if backup_originals && exists {
            let backup_path = path.join("breadcrumbs.json.bak");
            if let Err(e) = fs::copy(&breadcrumbs_path, &backup_path) {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: format!("Failed to create backup: {}", e),
                });
                continue;
            }
        }

        let (is_valid, _, camera_count) = validate_project_folder(path);

        if !is_valid {
            result.failed.push(FailedUpdate {
                path: project_path.clone(),
                error: "Invalid project structure".to_string(),
            });
            continue;
        }

        let files = scan_camera_files(path);

        let breadcrumbs = if exists {
            match fs::read_to_string(&breadcrumbs_path) {
                Ok(content) => match serde_json::from_str::<BreadcrumbsFile>(&content) {
                    Ok(mut existing) => {
                        existing.files = files;
                        if !existing.created_by.ends_with(" - updated by Baker") {
                            existing.created_by =
                                format!("{} - updated by Baker", existing.created_by);
                        }
                        existing.last_modified = Some(get_current_timestamp());
                        existing.scanned_by = Some("Baker".to_string());
                        existing.folder_size_bytes = calculate_folder_size(path).ok();
                        existing
                    }
                    Err(_) => new_breadcrumbs_file(path, camera_count, files),
                },
                Err(_) => {
                    result.failed.push(FailedUpdate {
                        path: project_path.clone(),
                        error: "Failed to read existing breadcrumbs".to_string(),
                    });
                    continue;
                }
            }
        } else {
            new_breadcrumbs_file(path, camera_count, files)
        };

        match serde_json::to_string_pretty(&breadcrumbs) {
            Ok(json_content) => {
                if let Err(e) = fs::write(&breadcrumbs_path, json_content) {
                    result.failed.push(FailedUpdate {
                        path: project_path.clone(),
                        error: format!("Failed to write breadcrumbs file: {}", e),
                    });
                } else {
                    result.successful.push(project_path.clone());
                    if exists {
                        result.updated.push(project_path);
                    } else {
                        result.created.push(project_path);
                    }
                }
            }
            Err(e) => {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: format!("Failed to serialize breadcrumbs: {}", e),
                });
            }
        }
    }

    Ok(result)
}

fn new_breadcrumbs_file(path: &Path, camera_count: i32, files: Vec<FileInfo>) -> BreadcrumbsFile {
    BreadcrumbsFile {
        project_title: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        number_of_cameras: camera_count,
        files,
        parent_folder: path
            .parent()
            .unwrap_or(path)
            .to_string_lossy()
            .to_string(),
        created_by: "Baker".to_string(),
        creation_date_time: get_current_timestamp(),
        folder_size_bytes: calculate_folder_size(path).ok(),
        last_modified: Some(get_current_timestamp()),
        scanned_by: Some("Baker".to_string()),
        trello_card_url: None,
        video_links: None,
        trello_cards: None,
    }
}

#[tauri::command]
pub async fn baker_scan_current_files(project_path: String) -> Result<Vec<FileInfo>, String> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Project path is not a directory".to_string());
    }

    Ok(scan_camera_files(path))
}

#[tauri::command]
pub async fn get_folder_size(folder_path: String) -> Result<u64, String> {
    let path = Path::new(&folder_path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    calculate_folder_size(path).map_err(|e| format!("Failed to calculate folder size: {}", e))
}

#[tauri::command]
pub async fn baker_read_raw_breadcrumbs(project_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let breadcrumbs_path = path.join("breadcrumbs.json");

    if !breadcrumbs_path.exists() {
        return Ok(None);
    }

    match fs::read_to_string(&breadcrumbs_path) {
        Ok(content) => Ok(Some(content)),
        Err(e) => Err(format!("Failed to read breadcrumbs file: {}", e)),
    }
}
