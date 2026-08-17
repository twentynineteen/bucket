use std::env;
use std::path::Path;
use std::process::Command;
use tauri::command;

#[command]
pub fn get_username() -> String {
    match env::var("USERNAME").or(env::var("USER")) {
        Ok(username) => username,
        Err(_) => "Unknown User".to_string(),
    }
}

#[tauri::command]
pub fn open_folder(path: String) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg(path)
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer")
            .arg(path.replace("/", "\\"))
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg(path)
            .spawn()
            .expect("Failed to open folder")
            .wait();
    }
}

/// Whether each of `paths` is present on this machine, one answer per path in
/// the order asked (issue #168).
///
/// Batched deliberately. The Baker detail panel renders one path per footage
/// file, so probing from the frontend a path at a time is one IPC message per
/// rendered row - hundreds on a normal shoot and thousands on a long one. Here
/// the whole list crosses the boundary once and each answer costs a `stat`.
///
/// `Path::exists()` collapses every io error to `false`, which is the intended
/// reading: a check that cannot run is not evidence of presence. That is the
/// same collapse `Settings/api.ts:directoryExists` makes deliberately for #166.
/// Callers must therefore phrase the result as "not found on this machine"
/// rather than asserting the path is gone - these paths are routinely authored
/// on another machine and are often perfectly valid there.
#[command]
pub fn paths_exist(paths: Vec<String>) -> Vec<bool> {
    paths
        .iter()
        .map(|path| !path.is_empty() && Path::new(path).exists())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// B1.1, B1.2 - one answer per path, in the order asked.
    #[test]
    fn answers_each_path_in_order() {
        let dir = std::env::temp_dir().join("bucket_paths_exist_order");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let present = dir.join("present.mov");
        fs::write(&present, b"x").unwrap();
        let absent = dir.join("absent.mov");

        let answers = paths_exist(vec![
            absent.to_string_lossy().into_owned(),
            present.to_string_lossy().into_owned(),
            dir.to_string_lossy().into_owned(),
        ]);

        assert_eq!(answers, vec![false, true, true]);

        let _ = fs::remove_dir_all(&dir);
    }

    /// B1.3 - an empty list is not an error.
    #[test]
    fn answers_an_empty_list_with_an_empty_result() {
        assert_eq!(paths_exist(vec![]), Vec::<bool>::new());
    }

    /// B1.4 - a path that cannot be probed reports not-found rather than
    /// erroring, matching what `Settings/api.ts:directoryExists` does
    /// deliberately for #166: a check that cannot run is not evidence of
    /// presence.
    #[test]
    fn reports_not_found_for_a_path_that_cannot_be_probed() {
        let answers = paths_exist(vec![
            "".to_string(),
            "/this/does/not/exist/\0invalid".to_string(),
        ]);

        assert_eq!(answers, vec![false, false]);
    }

    /// B1.5 - duplicates answer independently and nothing panics.
    #[test]
    fn answers_duplicate_paths_independently() {
        let dir = std::env::temp_dir().join("bucket_paths_exist_dupes");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.to_string_lossy().into_owned();

        assert_eq!(
            paths_exist(vec![path.clone(), path.clone(), "/nope/nope".to_string()]),
            vec![true, true, false]
        );

        let _ = fs::remove_dir_all(&dir);
    }
}
