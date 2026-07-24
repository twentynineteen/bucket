use std::fs;
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use app_lib::media::{TrelloCard, VideoLink};

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
        folder_size_bytes: calculate_folder_size(path).ok(),
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

        // A breadcrumbs file can be written for any folder with a Footage/
        // directory or an existing breadcrumbs.json — full structural
        // validity is NOT required, so 0-camera (podcast) and structurally
        // imperfect projects stay repairable.
        if !path.join("Footage").is_dir() && !exists {
            result.failed.push(FailedUpdate {
                path: project_path.clone(),
                error: "No Footage folder or breadcrumbs file — nothing to describe"
                    .to_string(),
            });
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

        let (_, _, camera_count) = validate_project_folder(path);

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
                    Err(_) => {
                        // The existing file could not be strictly parsed (e.g. a
                        // drifted field shape such as `createdBy` being an object).
                        // Regenerate it, but salvage the user-managed link fields so
                        // an update can NEVER silently destroy linked Trello cards or
                        // video links.
                        let mut regenerated =
                            new_breadcrumbs_file(path, camera_count, files);
                        salvage_links_from_raw(&content, &mut regenerated);
                        regenerated
                    }
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

/// Rewrite ONLY the `folderSizeBytes` and `lastModified` fields of each
/// project's `breadcrumbs.json`, recalculating the folder size live.
///
/// This is deliberately narrower than `baker_update_breadcrumbs`: the file is
/// edited as raw JSON so every other field — including unknown or drifted ones —
/// is preserved untouched. Projects whose size cannot be calculated are reported
/// as failures rather than written with a false size.
#[tauri::command]
pub async fn baker_update_breadcrumbs_sizes(
    project_paths: Vec<String>,
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
        if !breadcrumbs_path.exists() {
            result.failed.push(FailedUpdate {
                path: project_path.clone(),
                error: "No breadcrumbs file to update".to_string(),
            });
            continue;
        }

        let folder_size = match calculate_folder_size(path) {
            Ok(size) => size,
            Err(e) => {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: format!("Failed to calculate folder size: {}", e),
                });
                continue;
            }
        };

        let content = match fs::read_to_string(&breadcrumbs_path) {
            Ok(content) => content,
            Err(e) => {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: format!("Failed to read breadcrumbs file: {}", e),
                });
                continue;
            }
        };

        let mut value: serde_json::Value = match serde_json::from_str(&content) {
            Ok(serde_json::Value::Object(map)) => serde_json::Value::Object(map),
            Ok(_) => {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: "Breadcrumbs file is not a JSON object".to_string(),
                });
                continue;
            }
            Err(e) => {
                result.failed.push(FailedUpdate {
                    path: project_path.clone(),
                    error: format!("Failed to parse breadcrumbs file: {}", e),
                });
                continue;
            }
        };

        let map = value.as_object_mut().expect("checked object above");
        map.insert(
            "folderSizeBytes".to_string(),
            serde_json::Value::from(folder_size),
        );
        map.insert(
            "lastModified".to_string(),
            serde_json::Value::from(get_current_timestamp()),
        );

        match serde_json::to_string_pretty(&value) {
            Ok(json_content) => {
                if let Err(e) = fs::write(&breadcrumbs_path, json_content) {
                    result.failed.push(FailedUpdate {
                        path: project_path.clone(),
                        error: format!("Failed to write breadcrumbs file: {}", e),
                    });
                } else {
                    result.successful.push(project_path.clone());
                    result.updated.push(project_path);
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

/// Regenerate a single project's `breadcrumbs.json` from the folder contents,
/// salvaging the user-managed link fields from the old file.
///
/// Unlike the batch update, repair ALWAYS backs the existing file up to
/// `breadcrumbs.json.bak` first — a corrupt original is exactly the file the
/// user may want to inspect later. Allowed for any folder with a `Footage/`
/// directory or an existing breadcrumbs file.
#[tauri::command]
pub async fn baker_repair_breadcrumbs(
    project_path: String,
) -> Result<BreadcrumbsFile, String> {
    let path = Path::new(&project_path);

    if !path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let breadcrumbs_path = path.join("breadcrumbs.json");
    let exists = breadcrumbs_path.exists();

    if !path.join("Footage").is_dir() && !exists {
        return Err(
            "Folder has no Footage directory or breadcrumbs file to repair".to_string()
        );
    }

    let raw_content = if exists {
        let content = fs::read_to_string(&breadcrumbs_path)
            .map_err(|e| format!("Failed to read existing breadcrumbs: {}", e))?;
        fs::copy(&breadcrumbs_path, path.join("breadcrumbs.json.bak"))
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        Some(content)
    } else {
        None
    };

    let (_, _, camera_count) = validate_project_folder(path);
    let files = scan_camera_files(path);
    let mut breadcrumbs = new_breadcrumbs_file(path, camera_count, files);
    if let Some(content) = &raw_content {
        salvage_links_from_raw(content, &mut breadcrumbs);
    }

    let json_content = serde_json::to_string_pretty(&breadcrumbs)
        .map_err(|e| format!("Failed to serialize breadcrumbs: {}", e))?;
    fs::write(&breadcrumbs_path, json_content)
        .map_err(|e| format!("Failed to write breadcrumbs file: {}", e))?;

    println!("[Baker] Repaired breadcrumbs for {}", path.display());

    Ok(breadcrumbs)
}

/// Salvage the user-managed link fields (`trelloCards`, `videoLinks` and the
/// legacy `trelloCardUrl`) from raw breadcrumbs JSON.
///
/// Used when the existing `breadcrumbs.json` cannot be strictly deserialized
/// into [`BreadcrumbsFile`] (e.g. a drifted field shape). Without this,
/// regenerating the file would silently destroy the cards/videos the user has
/// linked. Each field is best-effort: anything that cannot be read is left
/// untouched on `target` rather than causing a further failure.
fn salvage_links_from_raw(content: &str, target: &mut BreadcrumbsFile) {
    let value: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return,
    };

    if let Some(cards) = value.get("trelloCards") {
        if let Ok(parsed) = serde_json::from_value::<Vec<TrelloCard>>(cards.clone()) {
            if !parsed.is_empty() {
                target.trello_cards = Some(parsed);
            }
        }
    }

    if let Some(links) = value.get("videoLinks") {
        if let Ok(parsed) = serde_json::from_value::<Vec<VideoLink>>(links.clone()) {
            if !parsed.is_empty() {
                target.video_links = Some(parsed);
            }
        }
    }

    if target.trello_card_url.is_none() {
        if let Some(url) = value.get("trelloCardUrl").and_then(|v| v.as_str()) {
            target.trello_card_url = Some(url.to_string());
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Build a directory that passes `validate_project_folder`.
    fn make_valid_project(dir: &Path) {
        for sub in ["Footage", "Graphics", "Renders", "Projects", "Scripts"] {
            fs::create_dir_all(dir.join(sub)).unwrap();
        }
        // A Camera folder so camera_count > 0.
        fs::create_dir_all(dir.join("Footage").join("Camera 1")).unwrap();
    }

    // A breadcrumbs.json whose `createdBy` is an object, which the strict
    // BreadcrumbsFile deserialize cannot handle.
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

    #[test]
    fn salvage_preserves_links_when_typed_parse_fails() {
        // Precondition: the drifted file really does fail strict deserialization.
        assert!(serde_json::from_str::<BreadcrumbsFile>(DRIFTED_BREADCRUMBS).is_err());

        let mut regenerated = new_breadcrumbs_file(Path::new("/tmp/Demo"), 1, Vec::new());
        assert!(regenerated.trello_cards.is_none());
        assert!(regenerated.video_links.is_none());

        salvage_links_from_raw(DRIFTED_BREADCRUMBS, &mut regenerated);

        let cards = regenerated.trello_cards.expect("trello cards salvaged");
        assert_eq!(cards.len(), 2);
        assert_eq!(cards[0].card_id, "aaa");
        assert_eq!(cards[1].card_id, "bbb");

        let videos = regenerated.video_links.expect("video links salvaged");
        assert_eq!(videos.len(), 1);
        assert_eq!(videos[0].title, "Render 1");

        assert_eq!(
            regenerated.trello_card_url.as_deref(),
            Some("https://trello.com/c/legacy123")
        );
    }

    #[test]
    fn salvage_is_noop_on_unparseable_content() {
        let mut regenerated = new_breadcrumbs_file(Path::new("/tmp/Demo"), 1, Vec::new());
        salvage_links_from_raw("{ not valid json", &mut regenerated);
        assert!(regenerated.trello_cards.is_none());
        assert!(regenerated.video_links.is_none());
    }

    #[tokio::test]
    async fn size_only_update_touches_only_size_and_last_modified() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Sized Project");
        make_valid_project(&project);

        // Put a real file in the project so the size is non-zero.
        fs::write(
            project.join("Footage").join("Camera 1").join("clip.mp4"),
            vec![0u8; 4096],
        )
        .unwrap();

        // Drifted breadcrumbs (createdBy is an object) — the size-only update
        // must still succeed and must NOT normalize or destroy other fields.
        let breadcrumbs_path = project.join("breadcrumbs.json");
        fs::write(&breadcrumbs_path, DRIFTED_BREADCRUMBS).unwrap();

        let result =
            baker_update_breadcrumbs_sizes(vec![project.to_string_lossy().to_string()])
                .await
                .expect("size update should succeed");

        assert_eq!(result.successful.len(), 1, "result was {:?}", result);
        assert!(result.failed.is_empty(), "result was {:?}", result);
        assert!(result.created.is_empty());

        let updated: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&breadcrumbs_path).unwrap()).unwrap();

        // Size was written and is at least the file we created.
        assert!(updated["folderSizeBytes"].as_u64().unwrap() >= 4096);
        assert!(updated["lastModified"].is_string());

        // Every other field survived byte-for-byte, including the drifted one.
        assert_eq!(updated["createdBy"]["data"], "Alice");
        assert_eq!(updated["trelloCardUrl"], "https://trello.com/c/legacy123");
        assert_eq!(updated["trelloCards"].as_array().unwrap().len(), 2);
        assert_eq!(updated["videoLinks"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn size_only_update_fails_cleanly_without_breadcrumbs() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("No Breadcrumbs");
        make_valid_project(&project);

        let result =
            baker_update_breadcrumbs_sizes(vec![project.to_string_lossy().to_string()])
                .await
                .expect("command itself should not error");

        assert!(result.successful.is_empty());
        assert_eq!(result.failed.len(), 1);
        assert!(result.failed[0].error.contains("No breadcrumbs file"));
    }

    /// Podcast project: full structure, no camera folders, one script file.
    fn make_podcast_project(dir: &Path) {
        for sub in ["Footage", "Graphics", "Renders", "Projects", "Scripts"] {
            fs::create_dir_all(dir.join(sub)).unwrap();
        }
        fs::write(dir.join("Scripts").join("episode-01.docx"), b"script").unwrap();
    }

    // --- B3.3: batch update works for 0-camera projects ---

    #[tokio::test]
    async fn update_succeeds_for_zero_camera_project() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 1");
        make_podcast_project(&project);

        let result = baker_update_breadcrumbs(
            vec![project.to_string_lossy().to_string()],
            true,
            false,
        )
        .await
        .expect("update should succeed");

        assert_eq!(result.successful.len(), 1, "result was {:?}", result);
        assert_eq!(result.created.len(), 1);
        assert!(result.failed.is_empty(), "result was {:?}", result);

        let written: BreadcrumbsFile = serde_json::from_str(
            &fs::read_to_string(project.join("breadcrumbs.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(written.number_of_cameras, 0);
    }

    // --- B3.4: relaxed gate ---

    #[tokio::test]
    async fn update_allowed_with_only_footage_folder() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Partial");
        fs::create_dir_all(project.join("Footage").join("Camera 1")).unwrap();
        fs::write(
            project.join("Footage").join("Camera 1").join("clip.mp4"),
            b"vid",
        )
        .unwrap();

        let result = baker_update_breadcrumbs(
            vec![project.to_string_lossy().to_string()],
            true,
            false,
        )
        .await
        .expect("update should succeed");

        assert_eq!(result.successful.len(), 1, "result was {:?}", result);
        assert!(project.join("breadcrumbs.json").exists());
    }

    #[tokio::test]
    async fn update_fails_without_footage_or_breadcrumbs() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Random Folder");
        fs::create_dir_all(&project).unwrap();

        let result = baker_update_breadcrumbs(
            vec![project.to_string_lossy().to_string()],
            true,
            false,
        )
        .await
        .expect("command itself should not error");

        assert!(result.successful.is_empty());
        assert_eq!(result.failed.len(), 1);
        assert!(!project.join("breadcrumbs.json").exists());
    }

    // --- B3.2: repair command ---

    #[tokio::test]
    async fn repair_regenerates_drifted_file_and_backs_up() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("My Project");
        make_valid_project(&project);

        let breadcrumbs_path = project.join("breadcrumbs.json");
        fs::write(&breadcrumbs_path, DRIFTED_BREADCRUMBS).unwrap();

        let repaired = baker_repair_breadcrumbs(project.to_string_lossy().to_string())
            .await
            .expect("repair should succeed");

        // Backup contains the original bytes.
        let backup = fs::read_to_string(project.join("breadcrumbs.json.bak")).unwrap();
        assert_eq!(backup, DRIFTED_BREADCRUMBS);

        // The written file is now strictly parseable and retains the links.
        let written: BreadcrumbsFile =
            serde_json::from_str(&fs::read_to_string(&breadcrumbs_path).unwrap())
                .expect("repaired file is valid");
        let cards = written.trello_cards.expect("trello cards salvaged");
        assert_eq!(cards.len(), 2);
        let videos = written.video_links.expect("video links salvaged");
        assert_eq!(videos.len(), 1);

        assert_eq!(repaired.number_of_cameras, written.number_of_cameras);
    }

    #[tokio::test]
    async fn repair_writes_zero_cameras_for_podcast_project() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 2");
        make_podcast_project(&project);
        fs::write(project.join("breadcrumbs.json"), "{ not valid json").unwrap();

        let repaired = baker_repair_breadcrumbs(project.to_string_lossy().to_string())
            .await
            .expect("repair should succeed");

        assert_eq!(repaired.number_of_cameras, 0);
        assert!(project.join("breadcrumbs.json.bak").exists());

        let written: BreadcrumbsFile = serde_json::from_str(
            &fs::read_to_string(project.join("breadcrumbs.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(written.number_of_cameras, 0);
    }

    #[tokio::test]
    async fn repair_creates_breadcrumbs_when_footage_present() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Fresh Project");
        make_valid_project(&project);

        let repaired = baker_repair_breadcrumbs(project.to_string_lossy().to_string())
            .await
            .expect("repair should succeed");

        assert_eq!(repaired.number_of_cameras, 1);
        assert!(project.join("breadcrumbs.json").exists());
        // Nothing to back up when there was no original file.
        assert!(!project.join("breadcrumbs.json.bak").exists());
    }

    #[tokio::test]
    async fn repair_fails_without_footage_or_breadcrumbs() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Random Folder");
        fs::create_dir_all(&project).unwrap();

        let result = baker_repair_breadcrumbs(project.to_string_lossy().to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn update_preserves_links_even_with_drifted_field() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("My Project");
        make_valid_project(&project);

        let breadcrumbs_path = project.join("breadcrumbs.json");
        fs::write(&breadcrumbs_path, DRIFTED_BREADCRUMBS).unwrap();

        let result = baker_update_breadcrumbs(
            vec![project.to_string_lossy().to_string()],
            false,
            false,
        )
        .await
        .expect("update should succeed");

        assert_eq!(result.successful.len(), 1, "result was {:?}", result);
        assert!(result.failed.is_empty(), "result was {:?}", result);

        // Read back: the regenerated file must be valid AND retain the links.
        let updated = fs::read_to_string(&breadcrumbs_path).unwrap();
        let parsed: BreadcrumbsFile =
            serde_json::from_str(&updated).expect("regenerated file is now valid");

        let cards = parsed.trello_cards.expect("trello cards survived update");
        assert_eq!(cards.len(), 2);
        assert_eq!(cards[0].card_id, "aaa");
        assert_eq!(cards[1].card_id, "bbb");

        let videos = parsed.video_links.expect("video links survived update");
        assert_eq!(videos.len(), 1);
        assert_eq!(videos[0].title, "Render 1");
    }
}
