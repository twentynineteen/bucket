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

    // Compare folder size to detect file content changes (with 1KB threshold).
    // If the current size cannot be determined, skip the comparison rather than
    // treating the folder as 0 bytes (which would falsely flag it as stale).
    if let (Ok(current_folder_size), Some(existing_size)) = (
        calculate_folder_size(path),
        existing_breadcrumbs.folder_size_bytes,
    ) {
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

/// True if `dir` contains at least one non-hidden file, searching recursively.
fn dir_contains_visible_file(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_file() {
            return true;
        }
        if path.is_dir() && dir_contains_visible_file(&path) {
            return true;
        }
    }
    false
}

/// True if any of the five standard project folders contains a real file.
/// A `breadcrumbs.json` at the project root deliberately does not count —
/// a metadata-only husk is not a project.
fn has_content_in_standard_folders(path: &Path) -> bool {
    STANDARD_PROJECT_FOLDERS
        .iter()
        .any(|folder| dir_contains_visible_file(&path.join(folder)))
}

pub fn validate_project_folder(path: &Path) -> (bool, Vec<String>, i32) {
    let mut errors = Vec::new();
    let mut camera_count = 0;

    if !path.exists() {
        errors.push("Folder does not exist".to_string());
        return (false, errors, 0);
    }

    for folder in STANDARD_PROJECT_FOLDERS {
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

    // Zero camera folders is a legitimate project (podcast/audio-only) as
    // long as there is some real content; an empty scaffold is not one yet.
    // With at least one Camera folder the project is valid even when empty
    // (a freshly scaffolded shoot awaiting footage).
    if camera_count == 0 && !has_content_in_standard_folders(path) {
        errors.push(
            "No Camera folders and no content found in project folders".to_string(),
        );
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
    // The core is AppHandle-free (and therefore unit-testable); this wrapper
    // injects the scan id into every payload and forwards it to the frontend.
    let mut emit = |event: &str, mut payload: serde_json::Value| {
        if let Some(map) = payload.as_object_mut() {
            map.insert("scanId".to_string(), serde_json::Value::from(scan_id));
        }
        let _ = app_handle.emit(event, payload);
    };

    Ok(scan_directory_core(root_path, options, &mut emit))
}

/// Classify a folder and, if it is a project (valid structure, or it carries a
/// breadcrumbs.json — parseable or not), record it in the result and emit a
/// discovery event. Returns whether the folder was recorded as a project.
fn classify_and_record(
    path: &Path,
    name: &str,
    result: &mut ScanResult,
    emit: &mut dyn FnMut(&str, serde_json::Value),
) -> bool {
    let (is_valid, validation_errors, camera_count) = validate_project_folder(path);
    let has_breadcrumbs = has_breadcrumbs_file(path);
    let invalid_breadcrumbs = has_invalid_breadcrumbs_file(path);

    println!(
        "[Baker] Folder: {} | Valid: {} | HasBreadcrumbs: {} | InvalidBreadcrumbs: {} | CameraCount: {}",
        path.display(),
        is_valid,
        has_breadcrumbs,
        invalid_breadcrumbs,
        camera_count
    );

    if !(is_valid || has_breadcrumbs || invalid_breadcrumbs) {
        return false;
    }

    if is_valid {
        result.valid_projects += 1;
    }

    let stale_breadcrumbs = if has_breadcrumbs {
        check_breadcrumbs_stale(path).unwrap_or(false)
    } else {
        false
    };

    let folder_size = match calculate_folder_size(path) {
        Ok(size) => {
            result.total_folder_size += size;
            Some(size)
        }
        Err(e) => {
            result.errors.push(ScanError {
                path: path.to_string_lossy().to_string(),
                r#type: "filesystem".to_string(),
                message: format!("Failed to calculate folder size: {}", e),
                timestamp: get_current_timestamp(),
            });
            None
        }
    };

    result.projects.push(ProjectFolder {
        path: path.to_string_lossy().to_string(),
        name: name.to_string(),
        is_valid,
        has_breadcrumbs,
        stale_breadcrumbs,
        last_scanned: get_current_timestamp(),
        camera_count,
        validation_errors: validation_errors.clone(),
        invalid_breadcrumbs,
        folder_size_bytes: folder_size,
    });

    emit(
        "baker_scan_discovery",
        serde_json::json!({
            "projectPath": path.to_string_lossy(),
            "isValid": is_valid,
            "hasBreadcrumbs": has_breadcrumbs,
            "invalidBreadcrumbs": invalid_breadcrumbs,
            "errors": validation_errors
        }),
    );

    true
}

struct VisitContext {
    max_depth: i32,
    include_hidden: bool,
}

#[allow(clippy::too_many_arguments)]
fn visit_directory(
    dir: &Path,
    depth: i32,
    skip_standard_children: bool,
    ctx: &VisitContext,
    result: &mut ScanResult,
    folders_scanned: &mut i32,
    last_progress_update: &mut Instant,
    emit: &mut dyn FnMut(&str, serde_json::Value),
) -> Result<(), Box<dyn std::error::Error>> {
    if depth > ctx.max_depth {
        return Ok(());
    }

    let entries = fs::read_dir(dir)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if !ctx.include_hidden && name_str.starts_with('.') {
            continue;
        }

        // Never look for projects inside a project's own structure folders.
        if skip_standard_children
            && STANDARD_PROJECT_FOLDERS.iter().any(|f| *f == name_str)
        {
            continue;
        }

        if should_skip_directory(&path) {
            continue;
        }

        *folders_scanned += 1;
        result.total_folders = *folders_scanned;

        if last_progress_update.elapsed() >= PROGRESS_UPDATE_INTERVAL {
            let progress = ScanProgressEvent {
                scan_id: String::new(), // injected by the emitter wrapper
                folders_scanned: *folders_scanned,
                total_folders: *folders_scanned,
                current_path: path.to_string_lossy().to_string(),
                projects_found: result.valid_projects,
            };
            emit(
                "baker_scan_progress",
                serde_json::to_value(progress).unwrap_or_default(),
            );
            *last_progress_update = Instant::now();
        }

        let is_project = classify_and_record(&path, &name_str, result, emit);

        // Projects may contain nested projects outside their standard
        // folders; plain folders are always traversed — a container may hold
        // projects alongside stray Footage/Graphics directories.
        visit_directory(
            &path,
            depth + 1,
            is_project,
            ctx,
            result,
            folders_scanned,
            last_progress_update,
            emit,
        )?;
    }

    Ok(())
}

pub fn scan_directory_core(
    root_path: &Path,
    options: &ScanOptions,
    emit: &mut dyn FnMut(&str, serde_json::Value),
) -> ScanResult {
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

    // The root directory itself may be a project.
    println!("[Baker] ===== ROOT FOLDER ANALYSIS =====");
    let root_name = root_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let root_is_project = classify_and_record(root_path, &root_name, &mut result, emit);
    println!("[Baker] ================================");

    let ctx = VisitContext {
        max_depth: options.max_depth,
        include_hidden: options.include_hidden,
    };

    if let Err(e) = visit_directory(
        root_path,
        0,
        root_is_project,
        &ctx,
        &mut result,
        &mut folders_scanned,
        &mut last_progress_update,
        emit,
    ) {
        result.errors.push(ScanError {
            path: root_path.to_string_lossy().to_string(),
            r#type: "filesystem".to_string(),
            message: e.to_string(),
            timestamp: get_current_timestamp(),
        });
    }

    result.end_time = Some(get_current_timestamp());
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn make_structure(dir: &Path) {
        for sub in STANDARD_PROJECT_FOLDERS {
            fs::create_dir_all(dir.join(sub)).unwrap();
        }
    }

    /// Video project: full structure plus an (empty) Camera 1 folder.
    fn make_video_project(dir: &Path) {
        make_structure(dir);
        fs::create_dir_all(dir.join("Footage").join("Camera 1")).unwrap();
    }

    /// Podcast project: full structure, no camera folders, one script file.
    fn make_podcast_project(dir: &Path) {
        make_structure(dir);
        fs::write(dir.join("Scripts").join("episode-01.docx"), b"script").unwrap();
    }

    fn scan(root: &Path, max_depth: i32) -> ScanResult {
        let options = ScanOptions {
            max_depth,
            include_hidden: false,
            create_missing: false,
            backup_originals: false,
        };
        scan_directory_core(root, &options, &mut |_, _| {})
    }

    fn project_names(result: &ScanResult) -> Vec<&str> {
        result.projects.iter().map(|p| p.name.as_str()).collect()
    }

    // --- B1: validity ---

    #[test]
    fn b1_1_empty_camera_folder_project_is_valid() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Show A");
        make_video_project(&project);

        let (is_valid, errors, camera_count) = validate_project_folder(&project);
        assert!(is_valid, "errors: {:?}", errors);
        assert_eq!(camera_count, 1);
    }

    #[test]
    fn b1_2_zero_cameras_with_content_is_valid() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 1");
        make_podcast_project(&project);

        let (is_valid, errors, camera_count) = validate_project_folder(&project);
        assert!(is_valid, "errors: {:?}", errors);
        assert!(errors.is_empty());
        assert_eq!(camera_count, 0);
    }

    #[test]
    fn b1_2_deeply_nested_content_counts() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Podcast Ep 2");
        make_structure(&project);
        fs::create_dir_all(project.join("Footage").join("Audio")).unwrap();
        fs::write(project.join("Footage").join("Audio").join("ep.wav"), b"pcm").unwrap();

        let (is_valid, errors, camera_count) = validate_project_folder(&project);
        assert!(is_valid, "errors: {:?}", errors);
        assert_eq!(camera_count, 0);
    }

    #[test]
    fn b1_3_zero_cameras_without_content_is_invalid() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Empty Scaffold");
        make_structure(&project);

        let (is_valid, errors, camera_count) = validate_project_folder(&project);
        assert!(!is_valid);
        assert_eq!(camera_count, 0);
        assert!(
            errors.iter().any(|e| e.to_lowercase().contains("content")),
            "expected a no-content error, got: {:?}",
            errors
        );
    }

    #[test]
    fn b1_3_hidden_files_do_not_count_as_content() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Hidden Only");
        make_structure(&project);
        fs::write(project.join("Footage").join(".DS_Store"), b"junk").unwrap();

        let (is_valid, _, _) = validate_project_folder(&project);
        assert!(!is_valid);
    }

    #[test]
    fn b1_3_root_breadcrumbs_does_not_count_as_content() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("Metadata Husk");
        make_structure(&project);
        fs::write(project.join("breadcrumbs.json"), b"{}").unwrap();

        let (is_valid, _, _) = validate_project_folder(&project);
        assert!(!is_valid);
    }

    #[test]
    fn b1_4_missing_required_folder_is_invalid() {
        let tmp = tempfile::tempdir().unwrap();
        let project = tmp.path().join("No Renders");
        make_podcast_project(&project);
        fs::remove_dir(project.join("Renders")).unwrap();

        let (is_valid, errors, _) = validate_project_folder(&project);
        assert!(!is_valid);
        assert!(errors.iter().any(|e| e.contains("Renders")));
    }

    // --- B4: traversal ---

    #[test]
    fn b4_1_container_with_stray_footage_is_traversed() {
        let tmp = tempfile::tempdir().unwrap();
        let container = tmp.path().join("Season 1");
        fs::create_dir_all(container.join("Footage")).unwrap(); // stray
        make_video_project(&container.join("Episode 1"));
        make_podcast_project(&container.join("Episode 2"));

        let result = scan(tmp.path(), 3);
        let names = project_names(&result);
        assert!(names.contains(&"Episode 1"), "found: {:?}", names);
        assert!(names.contains(&"Episode 2"), "found: {:?}", names);
        assert!(!names.contains(&"Season 1"), "found: {:?}", names);
    }

    #[test]
    fn b4_2_nested_project_inside_project_is_discovered() {
        let tmp = tempfile::tempdir().unwrap();
        let outer = tmp.path().join("Show A");
        make_video_project(&outer);
        make_video_project(&outer.join("Extras").join("Bonus Film"));

        let result = scan(tmp.path(), 4);
        let names = project_names(&result);
        assert!(names.contains(&"Show A"), "found: {:?}", names);
        assert!(names.contains(&"Bonus Film"), "found: {:?}", names);
    }

    #[test]
    fn b4_3_standard_folders_are_not_searched_for_projects() {
        let tmp = tempfile::tempdir().unwrap();
        let outer = tmp.path().join("Show B");
        make_video_project(&outer);
        // A full project planted inside Footage/ must NOT be discovered.
        make_video_project(&outer.join("Footage").join("Sneaky"));

        let result = scan(tmp.path(), 5);
        let names = project_names(&result);
        assert!(names.contains(&"Show B"), "found: {:?}", names);
        assert!(!names.contains(&"Sneaky"), "found: {:?}", names);
    }

    #[test]
    fn b4_4_max_depth_is_respected() {
        let tmp = tempfile::tempdir().unwrap();
        let deep = tmp.path().join("a").join("b").join("c").join("Deep Show");
        make_video_project(&deep);

        let shallow = scan(tmp.path(), 2);
        assert!(!project_names(&shallow).contains(&"Deep Show"));

        let full = scan(tmp.path(), 3);
        assert!(project_names(&full).contains(&"Deep Show"));
    }
}
