/**
 * BuildProject File Transfer Error Module
 *
 * Provides structured error types for file transfer operations in the BuildProject workflow.
 * These errors are serializable for transmission to the frontend via Tauri IPC.
 */
use serde::{Deserialize, Serialize};
use std::fmt;
use std::io;

/// Classification of error types for file transfer operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    /// Input validation failed (e.g., invalid file path, missing required fields)
    Validation,
    /// File system I/O error (e.g., read/write failure, file not found)
    Io,
    /// Permission denied (e.g., insufficient access rights)
    Permission,
    /// Operation timed out
    Timeout,
    /// Operation was cancelled by user
    Cancelled,
    /// Unclassified error
    Unknown,
}

/// Structured error type for file transfer operations
///
/// Designed for JSON serialization to the frontend with actionable information:
/// - `kind`: Error category for programmatic handling
/// - `message`: Human-readable description
/// - `file_path`: Optional path of the affected file
/// - `recoverable`: Whether the operation can be retried
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTransferError {
    /// The category of error
    pub kind: ErrorKind,
    /// Human-readable error message
    pub message: String,
    /// Path of the file that caused the error (if applicable)
    pub file_path: Option<String>,
    /// Whether this error is recoverable (can be retried)
    pub recoverable: bool,
}

impl FileTransferError {
    /// Create a new FileTransferError with all fields
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        let recoverable = matches!(kind, ErrorKind::Timeout | ErrorKind::Io);
        Self {
            kind,
            message: message.into(),
            file_path: None,
            recoverable,
        }
    }

    /// Create a new FileTransferError with a file path
    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.file_path = Some(path.into());
        self
    }

    /// Set the recoverable flag
    pub fn with_recoverable(mut self, recoverable: bool) -> Self {
        self.recoverable = recoverable;
        self
    }

    /// Create an error for cancelled operations
    pub fn cancelled() -> Self {
        Self {
            kind: ErrorKind::Cancelled,
            message: "Operation was cancelled by user".to_string(),
            file_path: None,
            recoverable: false,
        }
    }

    /// Create an error for timeout operations
    pub fn timeout(file: &str) -> Self {
        Self {
            kind: ErrorKind::Timeout,
            message: format!("Operation timed out while processing file: {}", file),
            file_path: Some(file.to_string()),
            recoverable: true,
        }
    }

    /// Create an error for permission denied
    pub fn permission(file: &str) -> Self {
        Self {
            kind: ErrorKind::Permission,
            message: format!("Permission denied accessing file: {}", file),
            file_path: Some(file.to_string()),
            recoverable: false,
        }
    }

    /// Create an error for validation failures
    pub fn validation(msg: &str) -> Self {
        Self {
            kind: ErrorKind::Validation,
            message: msg.to_string(),
            file_path: None,
            recoverable: false,
        }
    }

    /// Create an IO error with file path
    pub fn io(msg: impl Into<String>, file: &str) -> Self {
        Self {
            kind: ErrorKind::Io,
            message: msg.into(),
            file_path: Some(file.to_string()),
            recoverable: true,
        }
    }
}

impl fmt::Display for FileTransferError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.file_path {
            Some(path) => write!(f, "{} (file: {})", self.message, path),
            None => write!(f, "{}", self.message),
        }
    }
}

impl std::error::Error for FileTransferError {}

impl From<io::Error> for FileTransferError {
    fn from(error: io::Error) -> Self {
        let kind = match error.kind() {
            io::ErrorKind::NotFound => ErrorKind::Io,
            io::ErrorKind::PermissionDenied => ErrorKind::Permission,
            io::ErrorKind::TimedOut => ErrorKind::Timeout,
            io::ErrorKind::Interrupted => ErrorKind::Cancelled,
            _ => ErrorKind::Io,
        };

        let recoverable = matches!(
            error.kind(),
            io::ErrorKind::TimedOut | io::ErrorKind::Interrupted | io::ErrorKind::WouldBlock
        );

        Self {
            kind,
            message: error.to_string(),
            file_path: None,
            recoverable,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancelled_error() {
        let error = FileTransferError::cancelled();
        assert!(matches!(error.kind, ErrorKind::Cancelled));
        assert!(!error.recoverable);
        assert!(error.file_path.is_none());
    }

    #[test]
    fn test_timeout_error() {
        let error = FileTransferError::timeout("/path/to/file.mov");
        assert!(matches!(error.kind, ErrorKind::Timeout));
        assert!(error.recoverable);
        assert_eq!(error.file_path, Some("/path/to/file.mov".to_string()));
    }

    #[test]
    fn test_permission_error() {
        let error = FileTransferError::permission("/protected/file.mov");
        assert!(matches!(error.kind, ErrorKind::Permission));
        assert!(!error.recoverable);
        assert_eq!(error.file_path, Some("/protected/file.mov".to_string()));
    }

    #[test]
    fn test_validation_error() {
        let error = FileTransferError::validation("Invalid camera number");
        assert!(matches!(error.kind, ErrorKind::Validation));
        assert!(!error.recoverable);
        assert!(error.file_path.is_none());
    }

    #[test]
    fn test_from_io_error_permission_denied() {
        let io_error = io::Error::new(io::ErrorKind::PermissionDenied, "access denied");
        let error: FileTransferError = io_error.into();
        assert!(matches!(error.kind, ErrorKind::Permission));
    }

    #[test]
    fn test_from_io_error_not_found() {
        let io_error = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let error: FileTransferError = io_error.into();
        assert!(matches!(error.kind, ErrorKind::Io));
    }

    #[test]
    fn test_from_io_error_timed_out() {
        let io_error = io::Error::new(io::ErrorKind::TimedOut, "operation timed out");
        let error: FileTransferError = io_error.into();
        assert!(matches!(error.kind, ErrorKind::Timeout));
        assert!(error.recoverable);
    }

    #[test]
    fn test_display_with_path() {
        let error = FileTransferError::timeout("/path/to/file.mov");
        let display = format!("{}", error);
        assert!(display.contains("/path/to/file.mov"));
    }

    #[test]
    fn test_display_without_path() {
        let error = FileTransferError::validation("Invalid input");
        let display = format!("{}", error);
        assert_eq!(display, "Invalid input");
    }

    #[test]
    fn test_builder_pattern() {
        let error = FileTransferError::new(ErrorKind::Io, "Read failed")
            .with_path("/data/video.mp4")
            .with_recoverable(false);

        assert!(matches!(error.kind, ErrorKind::Io));
        assert_eq!(error.file_path, Some("/data/video.mp4".to_string()));
        assert!(!error.recoverable);
    }

    #[test]
    fn test_serialization() {
        let error = FileTransferError::timeout("/path/to/file.mov");
        let json = serde_json::to_string(&error).expect("Serialization failed");

        assert!(json.contains("\"kind\":\"timeout\""));
        assert!(json.contains("\"filePath\":\"/path/to/file.mov\""));
        assert!(json.contains("\"recoverable\":true"));
    }

    #[test]
    fn test_io_error_factory() {
        let error = FileTransferError::io("Read failed", "/data/file.mov");

        assert!(matches!(error.kind, ErrorKind::Io));
        assert_eq!(error.message, "Read failed");
        assert_eq!(error.file_path, Some("/data/file.mov".to_string()));
        assert!(error.recoverable); // IO errors are recoverable by default
    }

    #[test]
    fn test_from_io_error_interrupted() {
        let io_error = io::Error::new(io::ErrorKind::Interrupted, "interrupted");
        let error: FileTransferError = io_error.into();

        assert!(matches!(error.kind, ErrorKind::Cancelled));
        assert!(error.recoverable); // Interrupted is recoverable
    }

    #[test]
    fn test_from_io_error_would_block() {
        let io_error = io::Error::new(io::ErrorKind::WouldBlock, "would block");
        let error: FileTransferError = io_error.into();

        assert!(matches!(error.kind, ErrorKind::Io));
        assert!(error.recoverable); // WouldBlock is recoverable
    }

    #[test]
    fn test_recoverable_field_for_different_kinds() {
        // Timeout and IO are recoverable
        let timeout_err = FileTransferError::new(ErrorKind::Timeout, "timeout");
        assert!(timeout_err.recoverable);

        let io_err = FileTransferError::new(ErrorKind::Io, "io error");
        assert!(io_err.recoverable);

        // Validation, Permission, Cancelled, Unknown are not recoverable
        let validation_err = FileTransferError::new(ErrorKind::Validation, "invalid");
        assert!(!validation_err.recoverable);

        let permission_err = FileTransferError::new(ErrorKind::Permission, "denied");
        assert!(!permission_err.recoverable);

        let cancelled_err = FileTransferError::new(ErrorKind::Cancelled, "cancelled");
        assert!(!cancelled_err.recoverable);

        let unknown_err = FileTransferError::new(ErrorKind::Unknown, "unknown");
        assert!(!unknown_err.recoverable);
    }

    #[test]
    fn test_error_kind_serialization() {
        // Test that all ErrorKind variants serialize to camelCase
        let kinds = vec![
            (ErrorKind::Validation, "validation"),
            (ErrorKind::Io, "io"),
            (ErrorKind::Permission, "permission"),
            (ErrorKind::Timeout, "timeout"),
            (ErrorKind::Cancelled, "cancelled"),
            (ErrorKind::Unknown, "unknown"),
        ];

        for (kind, expected) in kinds {
            let json = serde_json::to_string(&kind).expect("Serialization failed");
            assert_eq!(json, format!("\"{}\"", expected));
        }
    }

    #[test]
    fn test_deserialization() {
        let json = r#"{
            "kind": "timeout",
            "message": "Operation timed out",
            "filePath": "/test/file.mp4",
            "recoverable": true
        }"#;

        let error: FileTransferError = serde_json::from_str(json).expect("Deserialization failed");

        assert!(matches!(error.kind, ErrorKind::Timeout));
        assert_eq!(error.message, "Operation timed out");
        assert_eq!(error.file_path, Some("/test/file.mp4".to_string()));
        assert!(error.recoverable);
    }

    #[test]
    fn test_display_trait_impl() {
        // Test the Display implementation for Error trait compatibility
        let error = FileTransferError::io("File read error", "/path/file.mp4");
        let error_string = error.to_string();

        assert!(error_string.contains("File read error"));
        assert!(error_string.contains("/path/file.mp4"));
    }

    #[test]
    fn test_error_trait_impl() {
        // Verify FileTransferError implements std::error::Error
        let error = FileTransferError::validation("Invalid input");
        let _: &dyn std::error::Error = &error;
    }
}
