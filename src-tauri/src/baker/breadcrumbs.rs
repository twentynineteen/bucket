use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use app_lib::breadcrumbs::{self, footage, Breadcrumbs, Change, Read};

use super::legacy::{apply_legacy, off_thread, read_legacy};
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
        folder_size_bytes: footage::folder_size(path).ok(),
    })
}


#[tauri::command]
pub async fn baker_read_breadcrumbs(project_path: String) -> Result<Option<Breadcrumbs>, String> {
    off_thread(move || read_legacy(&project_path)).await
}

/// Rescans each project through the breadcrumbs module (#303). A project with
/// no file is created only when `create_missing` is set.
///
/// `backup_originals` is the old Baker preference. The module already backs up
/// every file whose read needed repairs; this keeps the preference's promise
/// for healthy files too until PR 2 of #303 removes the toggle.
#[tauri::command]
pub async fn baker_update_breadcrumbs(
    project_paths: Vec<String>,
    create_missing: bool,
    backup_originals: bool,
) -> Result<BatchUpdateResult, String> {
    if project_paths.is_empty() {
        return Err("Project paths cannot be empty".to_string());
    }

    off_thread(move || {
        let mut result = BatchUpdateResult::default();
        for project_path in project_paths {
            let path = Path::new(&project_path);
            let existed = path.exists() && !matches!(breadcrumbs::read(path), Read::Missing);
            if path.exists() && !existed && !create_missing {
                continue;
            }
            if backup_originals && existed {
                let file = path.join("breadcrumbs.json");
                if let Err(e) = fs::copy(&file, path.join("breadcrumbs.json.bak")) {
                    result.failed.push(FailedUpdate {
                        path: project_path,
                        error: format!("Failed to create backup: {e}"),
                    });
                    continue;
                }
            }
            let outcome = apply_legacy(&project_path, Change::Rescan);
            result.record(project_path, existed, outcome);
        }
        Ok(result)
    })
    .await
}

/// Recalculates only `folderSizeBytes` (and `lastModified`) for each project.
#[tauri::command]
pub async fn baker_update_breadcrumbs_sizes(
    project_paths: Vec<String>,
) -> Result<BatchUpdateResult, String> {
    if project_paths.is_empty() {
        return Err("Project paths cannot be empty".to_string());
    }

    off_thread(move || {
        let mut result = BatchUpdateResult::default();
        for project_path in project_paths {
            let outcome = apply_legacy(&project_path, Change::RefreshSizes);
            result.record(project_path, true, outcome);
        }
        Ok(result)
    })
    .await
}

/// Repair is a rescan (#303): an unreadable file is regenerated from the
/// folder with its links salvaged, and the original kept as
/// `breadcrumbs.json.bak`.
#[tauri::command]
pub async fn baker_repair_breadcrumbs(project_path: String) -> Result<Breadcrumbs, String> {
    off_thread(move || {
        let repaired = apply_legacy(&project_path, Change::Rescan)?;
        println!("[Baker] Repaired breadcrumbs for {}", project_path);
        Ok(repaired)
    })
    .await
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

    Ok(footage::camera_files(path))
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

    footage::folder_size(path).map_err(|e| format!("Failed to calculate folder size: {}", e))
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

impl BatchUpdateResult {
    fn record(&mut self, project_path: String, existed: bool, outcome: Result<Breadcrumbs, String>) {
        match outcome {
            Ok(_) => {
                self.successful.push(project_path.clone());
                if existed {
                    self.updated.push(project_path);
                } else {
                    self.created.push(project_path);
                }
            }
            Err(error) => self.failed.push(FailedUpdate { path: project_path, error }),
        }
    }
}

/// These cover only what the adapters add on top of the breadcrumbs module:
/// the batch bookkeeping, the `create_missing` filter and the old error
/// strings. The file rules themselves are tested in `app_lib::breadcrumbs`.
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn make_valid_project(dir: &Path) {
        for sub in ["Footage", "Graphics", "Renders", "Projects", "Scripts"] {
            fs::create_dir_all(dir.join(sub)).unwrap();
        }
        fs::create_dir_all(dir.join("Footage").join("Camera 1")).unwrap();
    }

    fn make_podcast_project(dir: &Path) {
        for sub in ["Footage", "Graphics", "Renders", "Projects", "Scripts"] {
            fs::create_dir_all(dir.join(sub)).unwrap();
        }
        fs::write(dir.join("Scripts").join("episode-01.docx"), b"script").unwrap();
    }

    fn path_string(path: &Path) -> String {
        path.to_string_lossy().to_string()
    }

    fn on_disk(project: &Path) -> serde_json::Value {
        serde_json::from_str(&fs::read_to_string(project.join("breadcrumbs.json")).unwrap())
            .unwrap()
    }

    // `createdBy` as an object plus a legacy URL: readable, but needs fixes.
    const DRIFTED_BREADCRUMBS: &str = r#"{
        "projectTitle": "My Project",
        "numberOfCameras": 1,
        "files": [],
        "parentFolder": "/somewhere",
        "createdBy": { "data": "Alice" },
        "creationDateTime": "2026-01-01T00:00:00Z",
        "trelloCardUrl": "https://trello.com/c/legacy123",
        "videoLinks": [
            { "url": "https://v/1", "title": "Render 1" }
        ],
        "trelloCards": [
            { "url": "https://trello.com/c/aaa", "cardId": "aaa", "title": "Card A" },
            { "url": "https://trello.com/c/bbb", "cardId": "bbb", "title": "Card B" }
        ]
    }"#;

    #[tokio::test]
    async fn update_creates_a_missing_file_for_a_zero_camera_project() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 1");
        make_podcast_project(&project);

        let result = baker_update_breadcrumbs(vec![path_string(&project)], true, false)
            .await
            .unwrap();

        assert_eq!(result.created, vec![path_string(&project)], "{result:?}");
        assert!(result.failed.is_empty(), "{result:?}");
        assert_eq!(on_disk(&project)["numberOfCameras"], 0);
    }

    #[tokio::test]
    async fn update_skips_a_missing_file_when_create_missing_is_off() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Show");
        make_valid_project(&project);

        let result = baker_update_breadcrumbs(vec![path_string(&project)], false, false)
            .await
            .unwrap();

        assert!(result.successful.is_empty() && result.failed.is_empty(), "{result:?}");
        assert!(!project.join("breadcrumbs.json").exists());
    }

    #[tokio::test]
    async fn update_fails_without_footage_or_breadcrumbs() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Random Folder");
        fs::create_dir_all(&project).unwrap();

        let result = baker_update_breadcrumbs(vec![path_string(&project)], true, false)
            .await
            .unwrap();

        assert_eq!(result.failed.len(), 1, "{result:?}");
        assert!(!project.join("breadcrumbs.json").exists());
    }

    #[tokio::test]
    async fn update_reports_an_existing_file_as_updated_and_keeps_its_links() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("My Project");
        make_valid_project(&project);
        fs::write(project.join("breadcrumbs.json"), DRIFTED_BREADCRUMBS).unwrap();

        let result = baker_update_breadcrumbs(vec![path_string(&project)], false, false)
            .await
            .unwrap();

        assert_eq!(result.updated, vec![path_string(&project)], "{result:?}");
        let disk = on_disk(&project);
        let card_ids: Vec<_> = disk["trelloCards"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["cardId"].as_str().unwrap())
            .collect();
        assert_eq!(card_ids, vec!["aaa", "bbb", "legacy123"]);
        assert_eq!(disk["videoLinks"].as_array().unwrap().len(), 1);
        assert_eq!(disk["createdBy"], "Alice");
    }

    #[tokio::test]
    async fn update_still_honours_backup_originals_until_the_toggle_goes() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Show");
        make_valid_project(&project);
        let healthy = r#"{ "projectTitle": "Show", "numberOfCameras": 1, "files": [],
            "parentFolder": "/x", "createdBy": "Alice",
            "creationDateTime": "2026-01-01T00:00:00Z" }"#;
        fs::write(project.join("breadcrumbs.json"), healthy).unwrap();

        baker_update_breadcrumbs(vec![path_string(&project)], false, true)
            .await
            .unwrap();

        assert_eq!(
            fs::read_to_string(project.join("breadcrumbs.json.bak")).unwrap(),
            healthy
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn an_unreadable_by_the_os_file_keeps_the_locked_file_message() {
        use std::os::unix::fs::PermissionsExt;
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("breadcrumbs.json");
        fs::write(&file, "{}").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read(&file).is_ok() {
            return; // root
        }

        let error = baker_read_breadcrumbs(path_string(tmp.path())).await.unwrap_err();

        fs::set_permissions(&file, fs::Permissions::from_mode(0o644)).unwrap();
        assert!(error.to_lowercase().contains("failed to read breadcrumbs"), "{error}");
    }

    #[tokio::test]
    async fn size_update_without_a_file_fails_with_the_old_message() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("No Breadcrumbs");
        make_valid_project(&project);

        let result = baker_update_breadcrumbs_sizes(vec![path_string(&project)])
            .await
            .unwrap();

        assert_eq!(result.failed.len(), 1);
        assert!(result.failed[0].error.contains("No breadcrumbs file"));
    }

    #[tokio::test]
    async fn repair_regenerates_an_unreadable_file_and_backs_it_up() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 2");
        make_podcast_project(&project);
        fs::write(project.join("breadcrumbs.json"), "{ not valid json").unwrap();

        let repaired = baker_repair_breadcrumbs(path_string(&project)).await.unwrap();

        assert_eq!(repaired.number_of_cameras, 0);
        assert_eq!(
            fs::read_to_string(project.join("breadcrumbs.json.bak")).unwrap(),
            "{ not valid json"
        );
    }

    #[tokio::test]
    async fn repair_fails_without_footage_or_breadcrumbs() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Random Folder");
        fs::create_dir_all(&project).unwrap();

        assert!(baker_repair_breadcrumbs(path_string(&project)).await.is_err());
    }

    #[tokio::test]
    async fn read_of_a_missing_folder_keeps_the_message_the_frontend_matches() {
        let error = baker_read_breadcrumbs("/no/such/folder".to_string()).await.unwrap_err();
        assert!(error.to_lowercase().contains("project path does not exist"));
    }

    #[tokio::test]
    async fn read_of_an_unreadable_file_keeps_the_message_the_frontend_matches() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("breadcrumbs.json"), "{ broken").unwrap();

        let error = baker_read_breadcrumbs(path_string(tmp.path())).await.unwrap_err();
        assert!(error.to_lowercase().contains("failed to parse breadcrumbs"));
    }
}
