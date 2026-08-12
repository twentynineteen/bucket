//! QC failure reporting (issue #180, stage 2).
//!
//! Every variant is a different instruction to the operator, which is why they are
//! not one string. "ffmpeg is not installed", "this file has no video stream" and
//! "your threshold override is out of range" have nothing in common except that
//! the run did not happen, and a UI that cannot tell them apart cannot tell anyone
//! what to do about it.
//!
//! `message` is present on every variant so the frontend always has something to
//! render without matching on the tag first.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum QcError {
    /// A run is already in flight. One at a time (D19).
    Busy { message: String },
    /// The operator cancelled. Not a failure of the video.
    Cancelled { message: String },
    /// ffmpeg or ffprobe could not be started.
    Unavailable { message: String },
    /// The file cannot be analysed, and this is precisely why (B12.1, B12.3).
    Probe { message: String },
    /// ffmpeg failed. Its own stderr comes along, size-limited (B11.3, B12.2).
    Ffmpeg { message: String, stderr: String },
    /// The reference pool yielded nothing usable.
    ReferencePool { message: String },
    /// An override outside the allowed range (B13.3).
    Threshold { message: String },
    /// Reading or writing failed.
    Io { message: String },
}

impl QcError {
    /// The operator-facing text, whatever went wrong.
    pub fn message(&self) -> &str {
        match self {
            QcError::Busy { message }
            | QcError::Cancelled { message }
            | QcError::Unavailable { message }
            | QcError::Probe { message }
            | QcError::Ffmpeg { message, .. }
            | QcError::ReferencePool { message }
            | QcError::Threshold { message }
            | QcError::Io { message } => message,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialises_with_the_tag_the_frontend_matches_on() {
        // Guards the serde tags against the mirror type in
        // `src/features/QualityControl/types.ts`. The two must stay in step.
        let json = serde_json::to_string(&QcError::Ffmpeg {
            message: "ffmpeg could not decode this video.".to_string(),
            stderr: "Unknown decoder 'hevc'".to_string(),
        })
        .unwrap();

        assert!(json.contains("\"kind\":\"ffmpeg\""), "got {}", json);
        assert!(json.contains("Unknown decoder"), "got {}", json);
    }

    #[test]
    fn every_variant_carries_a_message_the_ui_can_render() {
        let errors = [
            QcError::Busy {
                message: "busy".to_string(),
            },
            QcError::Cancelled {
                message: "cancelled".to_string(),
            },
            QcError::Unavailable {
                message: "unavailable".to_string(),
            },
            QcError::Probe {
                message: "probe".to_string(),
            },
            QcError::Ffmpeg {
                message: "ffmpeg".to_string(),
                stderr: String::new(),
            },
            QcError::ReferencePool {
                message: "pool".to_string(),
            },
            QcError::Threshold {
                message: "threshold".to_string(),
            },
            QcError::Io {
                message: "io".to_string(),
            },
        ];

        for error in errors {
            assert!(!error.message().is_empty(), "{:?} has no message", error);
        }
    }
}
