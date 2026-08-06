//! Tests for the Sprout Video poster frame commands (Issue #140).
//!
//! Written before the implementation: `resolve_available_poster_frame_path`,
//! `save_poster_frame_copy` and `set_sprout_poster_frame` do not exist yet.

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
