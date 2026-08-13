//! Saving failure evidence on request (issue #180, stage 2, B10).
//!
//! Nothing is written automatically. macOS does not clear
//! `~/Library/Caches/<bundle-id>` on any schedule, so a cache written there
//! persists indefinitely, and one badly broken video refined at a fine interval
//! could leave dozens of frames behind that nobody knows about. Thumbnails
//! therefore live in memory for as long as the report is open and reach the disk
//! only when an operator picks a folder (D15).
//!
//! Existing files are never overwritten, reusing the poster frame convention
//! (`resolve_available_poster_frame_path`): evidence saved twice from two runs of
//! the same video must not silently replace the first run's.

use std::fs;
use std::path::Path;

use crate::commands::poster_frame::resolve_available_poster_frame_path;

use super::error::KavanaghError;

/// A thumbnail arriving back from the frontend to be written out.
///
/// Deserialised separately from `Thumbnail` because the frontend round-trips the
/// bytes it was given, and the two shapes are free to diverge.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceItem {
    pub label: String,
    pub jpeg: Vec<u8>,
}

/// Keeps a report's evidence within the retention cap.
///
/// Applied to the *requests* before any frame is grabbed, so the cap bounds the
/// ffmpeg spawns as well as the memory. The earliest failures are kept: the first
/// place a video goes wrong is nearly always the one worth looking at, and a later
/// gap is usually the same fault continuing.
pub fn cap_evidence<T>(items: Vec<T>, max: usize) -> Vec<T> {
    items.into_iter().take(max).collect()
}

/// Turns a label into a filename stem safe on any volume.
///
/// Slashes and colons in particular: a label carries a timestamp, and `04:12` in a
/// filename is a path separator on some systems and legal on others.
pub fn evidence_stem(prefix: &str, label: &str) -> String {
    let cleaned: String = label
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => c,
            _ => '-',
        })
        .collect();

    format!("{}-{}", prefix, cleaned.trim_matches('-'))
}

/// Writes the thumbnails into an operator-chosen folder.
///
/// Returns the paths written, so the UI can say where they went rather than
/// claiming success and leaving the operator to find them.
pub fn save_evidence(
    folder: &str,
    prefix: &str,
    items: &[EvidenceItem],
) -> Result<Vec<String>, KavanaghError> {
    let dir = Path::new(folder);
    if !dir.is_dir() {
        return Err(KavanaghError::Io {
            message: format!("{} is not a folder that can be written to.", folder),
        });
    }

    let mut written = Vec::new();
    for item in items {
        let target =
            resolve_available_poster_frame_path(dir, &evidence_stem(prefix, &item.label), "jpg");

        fs::write(&target, &item.jpeg).map_err(|e| KavanaghError::Io {
            message: format!("Could not write {}: {}", target.display(), e),
        })?;

        written.push(target.to_string_lossy().to_string());
    }

    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kavanagh::watermark::Thumbnail;
    use tempfile::tempdir;

    fn item(label: &str, bytes: &[u8]) -> EvidenceItem {
        EvidenceItem {
            label: label.to_string(),
            jpeg: bytes.to_vec(),
        }
    }

    fn thumbnail(at: f64) -> Thumbnail {
        Thumbnail {
            label: format!("watermark-missing-{}s", at),
            at_seconds: at,
            jpeg: vec![0xff, 0xd8],
        }
    }

    #[test]
    fn b10_4_caps_the_number_of_retained_thumbnails() {
        let many: Vec<Thumbnail> = (0..40).map(|i| thumbnail(f64::from(i))).collect();

        let capped = cap_evidence(many, 6);

        assert_eq!(capped.len(), 6);
        assert_eq!(
            capped[0].at_seconds, 0.0,
            "the earliest failure is the one worth keeping"
        );
    }

    #[test]
    fn b10_2_writes_every_thumbnail_into_the_chosen_folder() {
        let dir = tempdir().unwrap();

        let written = save_evidence(
            dir.path().to_str().unwrap(),
            "kavanagh-render",
            &[item("watermark-missing-12.0s", &[1, 2, 3])],
        )
        .expect("evidence should be written");

        assert_eq!(written.len(), 1);
        assert_eq!(fs::read(&written[0]).unwrap(), vec![1, 2, 3]);
        assert!(
            written[0].ends_with("kavanagh-render-watermark-missing-12.0s.jpg"),
            "got {}",
            written[0]
        );
    }

    #[test]
    fn b10_3_never_overwrites_a_file_already_in_the_folder() {
        let dir = tempdir().unwrap();
        let existing = dir.path().join("kavanagh-render-watermark-missing-12.0s.jpg");
        fs::write(&existing, b"from an earlier run").unwrap();

        let written = save_evidence(
            dir.path().to_str().unwrap(),
            "kavanagh-render",
            &[item("watermark-missing-12.0s", &[9])],
        )
        .unwrap();

        assert!(written[0].ends_with("-2.jpg"), "got {}", written[0]);
        assert_eq!(
            fs::read(&existing).unwrap(),
            b"from an earlier run".to_vec(),
            "the earlier run's evidence must be left alone"
        );
    }

    #[test]
    fn reports_a_folder_that_cannot_be_written_to() {
        let result = save_evidence(
            "/definitely/not/a/real/volume/evidence",
            "kavanagh",
            &[item("a", &[1])],
        );

        assert!(matches!(result, Err(KavanaghError::Io { .. })));
    }

    #[test]
    fn strips_characters_a_filename_cannot_carry() {
        // A label holds a timestamp, and a colon is a path separator on some
        // volumes and legal on others.
        assert_eq!(
            evidence_stem("kavanagh", "watermark missing 04:12/04:31"),
            "kavanagh-watermark-missing-04-12-04-31"
        );
    }
}
