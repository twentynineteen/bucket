//! Upload target: where a transfer's bytes go and the Sprout endpoint they
//! reach (issue #282).

/// Where a transfer's bytes go: a new video, or the source file of an existing
/// one (issue #282).
///
/// The two Sprout endpoints take the same streamed `source_video` part and
/// differ only in URL and in the text fields alongside it. Lifting those two
/// decisions out of `upload_video_task` is what lets a replace reuse the task's
/// progress, stall detection and cancellation rather than fork them.
#[derive(Debug, Clone, PartialEq)]
pub enum UploadTarget {
    New {
        folder_id: Option<String>,
        title: Option<String>,
    },
    Replace {
        video_id: String,
    },
}

/// The Sprout endpoint a target posts to.
pub fn endpoint(target: &UploadTarget) -> String {
    match target {
        UploadTarget::New { .. } => "https://api.sproutvideo.com/v1/videos".to_string(),
        UploadTarget::Replace { video_id } => {
            format!("https://api.sproutvideo.com/v1/videos/{video_id}/replace")
        }
    }
}

/// The multipart text fields sent beside `source_video`.
///
/// A replace takes none: the video already has its folder and title. A new
/// upload sends the folder when one was chosen and the title when it is not
/// blank, so Sprout does not store an empty string where it would otherwise
/// derive a title from the filename.
pub fn text_fields(target: &UploadTarget) -> Vec<(&'static str, String)> {
    match target {
        UploadTarget::Replace { .. } => Vec::new(),
        UploadTarget::New { folder_id, title } => {
            let mut fields = Vec::new();
            if let Some(fid) = folder_id {
                fields.push(("folder_id", fid.clone()));
            }
            if let Some(t) = title {
                let trimmed = t.trim();
                if !trimmed.is_empty() {
                    fields.push(("title", trimmed.to_string()));
                }
            }
            fields
        }
    }
}
