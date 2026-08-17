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
    /// Create an error for validation failures
    pub fn validation(msg: &str) -> Self {
        Self {
            kind: ErrorKind::Validation,
            message: msg.to_string(),
            file_path: None,
            recoverable: false,
        }
    }

    // ===== Retained but not yet called - see issue #172 =====
    //
    // `validation` above is the only constructor the app reaches today, because
    // `FileTransferError` only ever leaves the backend as the synchronous
    // rejection of `transfer_files_with_progress`, where the sole failures
    // possible are the request validation checks in `commands.rs`.
    //
    // Every failure discovered after the transfer task is spawned is emitted as
    // `TransferComplete { error: Some(String) }` instead, and the frontend
    // recovers the category by substring-matching that message in
    // `mapTransferError` (`src/features/build-project/stages/fileTransfer.ts`).
    // That works today but is fragile: it depends on the wording of OS error
    // text, and the macOS copy path discards a preserved `errno`
    // (`CopyError::Io(e).raw_os_error()`) into an interpolated string.
    //
    // The three constructors below are the ones that would classify failures the
    // transfer path either already detects (permission, I/O) or documents but
    // does not implement (the "stall detection" claimed by the doc comment on
    // `transfer_files_with_progress`, which lives only in the frontend). They are
    // kept rather than deleted so that making the completion event structured
    // stays a deliberate decision instead of a rediscovery. Deleting this block
    // is a safe alternative if that decision goes the other way.

    /// Create an error for timeout operations
    #[allow(dead_code)]
    pub fn timeout(file: &str) -> Self {
        Self {
            kind: ErrorKind::Timeout,
            message: format!("Operation timed out while processing file: {}", file),
            file_path: Some(file.to_string()),
            recoverable: true,
        }
    }

    /// Create an error for permission denied
    #[allow(dead_code)]
    pub fn permission(file: &str) -> Self {
        Self {
            kind: ErrorKind::Permission,
            message: format!("Permission denied accessing file: {}", file),
            file_path: Some(file.to_string()),
            recoverable: false,
        }
    }

    /// Create an IO error with file path
    #[allow(dead_code)]
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
