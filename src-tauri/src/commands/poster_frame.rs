//! Sprout Video poster frame commands (Issue #140).
//!
//! Sprout takes a custom poster frame as a multipart `custom_poster_frame`
//! part on `PUT /v1/videos/:id`. The image itself is generated on the
//! frontend canvas, so these commands only move bytes: one to Sprout, one
//! (optionally) into the project's `Graphics/` folder.

use reqwest::{multipart, Client};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::command;

/// Failure detail for a poster frame request. The HTTP status is kept
/// separate from the message so the frontend can decide whether a retry is
/// worth attempting (5xx/429) or pointless (413/401/404).
#[derive(Debug, Clone, Serialize)]
pub struct PosterFrameError {
    pub status: Option<u16>,
    pub message: String,
}

/// Builds a `PosterFrameError` for a non-success HTTP response.
pub fn poster_frame_error_for_status(status: u16, message: &str) -> PosterFrameError {
    PosterFrameError {
        status: Some(status),
        message: message.to_string(),
    }
}

fn transport_error(message: String) -> PosterFrameError {
    PosterFrameError {
        status: None,
        message,
    }
}

/// Uploads a custom poster frame for an existing Sprout video.
#[command]
pub async fn set_sprout_poster_frame(
    video_id: String,
    api_key: String,
    image_bytes: Vec<u8>,
    file_name: Option<String>,
) -> Result<(), PosterFrameError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| transport_error(format!("Failed to create HTTP client: {}", e)))?;

    let part = multipart::Part::bytes(image_bytes)
        .file_name(file_name.unwrap_or_else(|| "posterframe.jpg".to_string()))
        .mime_str("image/jpeg")
        .map_err(|e| transport_error(e.to_string()))?;

    let form = multipart::Form::new().part("custom_poster_frame", part);

    let response = client
        .put(format!(
            "https://api.sproutvideo.com/v1/videos/{}",
            video_id
        ))
        .header("SproutVideo-Api-Key", api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| transport_error(e.to_string()))?;

    let status = response.status();
    if status.is_success() {
        return Ok(());
    }

    // Sprout returns a JSON error body for most failures, but 413 comes back
    // empty — fall back to the status' canonical reason in that case.
    let body = response.text().await.unwrap_or_default();
    let message = if body.trim().is_empty() {
        status
            .canonical_reason()
            .unwrap_or("Poster frame upload failed")
            .to_string()
    } else {
        body.trim().to_string()
    };

    Err(poster_frame_error_for_status(status.as_u16(), &message))
}

/// Returns the first free `<stem>.<ext>` / `<stem>-2.<ext>` / … path in `dir`.
/// Existing poster frames are never overwritten.
pub fn resolve_available_poster_frame_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let first = dir.join(format!("{}.{}", stem, ext));
    if !first.exists() {
        return first;
    }

    let mut suffix = 2u32;
    loop {
        let candidate = dir.join(format!("{}-{}.{}", stem, suffix, ext));
        if !candidate.exists() {
            return candidate;
        }
        suffix += 1;
    }
}

/// Writes a copy of the poster frame into `<project_path>/Graphics/`,
/// creating the folder when the project doesn't have one. Returns the path
/// that was written.
#[command]
pub fn save_poster_frame_copy(
    project_path: String,
    file_stem: String,
    image_bytes: Vec<u8>,
) -> Result<String, String> {
    let graphics_dir = Path::new(&project_path).join("Graphics");
    fs::create_dir_all(&graphics_dir)
        .map_err(|e| format!("Could not create {}: {}", graphics_dir.display(), e))?;

    let target = resolve_available_poster_frame_path(&graphics_dir, &file_stem, "jpg");
    fs::write(&target, image_bytes)
        .map_err(|e| format!("Could not write {}: {}", target.display(), e))?;

    Ok(target.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn b7_4_uses_the_plain_name_when_nothing_exists() {
        let dir = tempdir().unwrap();

        let path = resolve_available_poster_frame_path(
            dir.path(),
            "posterframe-Managing_Change",
            "jpg",
        );

        assert_eq!(
            path.file_name().unwrap().to_str().unwrap(),
            "posterframe-Managing_Change.jpg"
        );
    }

    #[test]
    fn b7_4_auto_suffixes_when_the_name_is_taken() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("posterframe-Managing_Change.jpg"), b"old").unwrap();

        let path = resolve_available_poster_frame_path(
            dir.path(),
            "posterframe-Managing_Change",
            "jpg",
        );

        assert_eq!(
            path.file_name().unwrap().to_str().unwrap(),
            "posterframe-Managing_Change-2.jpg"
        );
    }

    #[test]
    fn b7_4_keeps_counting_past_the_first_suffix() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("posterframe-Managing_Change.jpg"), b"old").unwrap();
        fs::write(dir.path().join("posterframe-Managing_Change-2.jpg"), b"older").unwrap();

        let path = resolve_available_poster_frame_path(
            dir.path(),
            "posterframe-Managing_Change",
            "jpg",
        );

        assert_eq!(
            path.file_name().unwrap().to_str().unwrap(),
            "posterframe-Managing_Change-3.jpg"
        );
    }

    #[test]
    fn b7_3_creates_the_graphics_folder_when_missing() {
        let project = tempdir().unwrap();

        let written = save_poster_frame_copy(
            project.path().to_string_lossy().to_string(),
            "posterframe-Managing_Change".to_string(),
            vec![1, 2, 3, 4],
        )
        .expect("copy should be written");

        let graphics = project.path().join("Graphics");
        assert!(graphics.is_dir(), "Graphics/ should have been created");
        assert_eq!(
            fs::read(&written).unwrap(),
            vec![1, 2, 3, 4],
            "the poster frame bytes should land in the file"
        );
        assert!(written.ends_with("Graphics/posterframe-Managing_Change.jpg"));
    }

    #[test]
    fn b7_4_never_overwrites_an_existing_copy() {
        let project = tempdir().unwrap();
        let graphics = project.path().join("Graphics");
        fs::create_dir_all(&graphics).unwrap();
        fs::write(graphics.join("posterframe-Managing_Change.jpg"), b"original").unwrap();

        let written = save_poster_frame_copy(
            project.path().to_string_lossy().to_string(),
            "posterframe-Managing_Change".to_string(),
            vec![9, 9],
        )
        .expect("copy should be written");

        assert!(written.ends_with("posterframe-Managing_Change-2.jpg"));
        assert_eq!(
            fs::read(graphics.join("posterframe-Managing_Change.jpg")).unwrap(),
            b"original".to_vec(),
            "the pre-existing file must be left alone"
        );
    }

    #[test]
    fn b7_5_reports_an_error_for_an_unusable_project_path() {
        let result = save_poster_frame_copy(
            "/definitely/not/a/real/volume/project".to_string(),
            "posterframe-x".to_string(),
            vec![1],
        );

        assert!(result.is_err());
    }

    #[test]
    fn b5_5_classifies_http_statuses_into_poster_frame_errors() {
        let too_large = poster_frame_error_for_status(413, "Request Entity Too Large");
        assert_eq!(too_large.status, Some(413));
        assert!(too_large.message.contains("Request Entity Too Large"));

        let server = poster_frame_error_for_status(503, "Service Unavailable");
        assert_eq!(server.status, Some(503));
    }
}
