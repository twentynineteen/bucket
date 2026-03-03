//! File transfer types and data structures for BuildProject workflow.
//!
//! This module provides data structures for tracking file transfer operations:
//! - `TransferStatus`: Enum for tracking operation state
//! - `TransferProgress`: Progress information for ongoing transfers
//! - `TransferResult`: Final result of a transfer operation
//! - `FileTransferInfo`: Information about a single file to transfer
//! - `FailedFile`: Information about a file that failed to transfer

use serde::{Deserialize, Serialize};

/// Status of a file transfer operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferStatus {
    /// Transfer is pending and has not started yet
    Pending,
    /// Transfer is currently in progress
    InProgress,
    /// Transfer completed successfully
    Completed,
    /// Transfer failed with an error
    Failed,
    /// Transfer was cancelled by user
    Cancelled,
}

/// Progress information for a file transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    /// Current file being transferred (1-indexed)
    pub current_file: usize,
    /// Total number of files to transfer
    pub total_files: usize,
    /// Bytes transferred for current file
    pub bytes_transferred: u64,
    /// Total bytes for current file
    pub bytes_total: u64,
    /// Name of the current file being transferred
    pub current_file_name: String,
    /// Overall percentage complete (0-100)
    pub overall_percent: f64,
    /// Current status of the transfer
    pub status: TransferStatus,
}

impl TransferProgress {
    /// Create a new TransferProgress in Pending state
    pub fn new(total_files: usize) -> Self {
        Self {
            current_file: 0,
            total_files,
            bytes_transferred: 0,
            bytes_total: 0,
            current_file_name: String::new(),
            overall_percent: 0.0,
            status: TransferStatus::Pending,
        }
    }

    /// Update progress for a new file
    pub fn start_file(&mut self, file_index: usize, file_name: &str, file_size: u64) {
        self.current_file = file_index;
        self.current_file_name = file_name.to_string();
        self.bytes_transferred = 0;
        self.bytes_total = file_size;
        self.status = TransferStatus::InProgress;
        self.update_overall_percent();
    }

    /// Update bytes transferred for current file
    pub fn update_bytes(&mut self, bytes: u64) {
        self.bytes_transferred = bytes;
        self.update_overall_percent();
    }

    /// Mark current file as complete
    pub fn complete_file(&mut self) {
        self.bytes_transferred = self.bytes_total;
        self.update_overall_percent();
    }

    /// Mark transfer as fully completed
    pub fn mark_completed(&mut self) {
        self.status = TransferStatus::Completed;
        self.overall_percent = 100.0;
    }

    /// Mark transfer as failed
    pub fn mark_failed(&mut self) {
        self.status = TransferStatus::Failed;
    }

    /// Mark transfer as cancelled
    pub fn mark_cancelled(&mut self) {
        self.status = TransferStatus::Cancelled;
    }

    /// Calculate and update overall percentage
    fn update_overall_percent(&mut self) {
        if self.total_files == 0 {
            self.overall_percent = 0.0;
            return;
        }

        // Files fully completed
        let files_complete = if self.current_file > 0 {
            self.current_file - 1
        } else {
            0
        };

        // Current file progress as fraction
        let current_file_fraction = if self.bytes_total > 0 {
            self.bytes_transferred as f64 / self.bytes_total as f64
        } else {
            0.0
        };

        // Overall progress: completed files + current file progress
        let total_progress = files_complete as f64 + current_file_fraction;
        self.overall_percent = (total_progress / self.total_files as f64) * 100.0;
    }

    /// Get the current file progress as a percentage (0-100)
    pub fn current_file_percent(&self) -> f64 {
        if self.bytes_total == 0 {
            return 0.0;
        }
        (self.bytes_transferred as f64 / self.bytes_total as f64) * 100.0
    }
}

/// Information about a single file to be transferred
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferInfo {
    /// Source path of the file
    pub source_path: String,
    /// Destination path for the file
    pub destination_path: String,
    /// Size of the file in bytes
    pub size_bytes: u64,
    /// Camera assignment (1-indexed)
    pub camera: i32,
}

/// Result of a file transfer operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferResult {
    /// Operation ID for this transfer
    pub operation_id: String,
    /// Final status of the transfer
    pub status: TransferStatus,
    /// Number of files successfully transferred
    pub files_transferred: usize,
    /// Total number of files that were to be transferred
    pub total_files: usize,
    /// Total bytes transferred
    pub bytes_transferred: u64,
    /// Files that failed to transfer (path -> error message)
    pub failed_files: Vec<FailedFile>,
    /// Duration of the transfer in milliseconds
    pub duration_ms: u64,
}

/// Information about a file that failed to transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedFile {
    /// Source path that failed
    pub source_path: String,
    /// Destination path that was attempted
    pub destination_path: String,
    /// Error message describing the failure
    pub error: String,
}

impl TransferResult {
    /// Create a new successful transfer result
    pub fn success(
        operation_id: String,
        files_transferred: usize,
        bytes_transferred: u64,
        duration_ms: u64,
    ) -> Self {
        Self {
            operation_id,
            status: TransferStatus::Completed,
            files_transferred,
            total_files: files_transferred,
            bytes_transferred,
            failed_files: Vec::new(),
            duration_ms,
        }
    }

    /// Create a cancelled transfer result
    pub fn cancelled(
        operation_id: String,
        files_transferred: usize,
        total_files: usize,
        bytes_transferred: u64,
        duration_ms: u64,
    ) -> Self {
        Self {
            operation_id,
            status: TransferStatus::Cancelled,
            files_transferred,
            total_files,
            bytes_transferred,
            failed_files: Vec::new(),
            duration_ms,
        }
    }

    /// Create a failed transfer result
    pub fn failed(
        operation_id: String,
        files_transferred: usize,
        total_files: usize,
        bytes_transferred: u64,
        failed_files: Vec<FailedFile>,
        duration_ms: u64,
    ) -> Self {
        Self {
            operation_id,
            status: TransferStatus::Failed,
            files_transferred,
            total_files,
            bytes_transferred,
            failed_files,
            duration_ms,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transfer_progress_new() {
        let progress = TransferProgress::new(10);

        assert_eq!(progress.current_file, 0);
        assert_eq!(progress.total_files, 10);
        assert_eq!(progress.status, TransferStatus::Pending);
        assert_eq!(progress.overall_percent, 0.0);
    }

    #[test]
    fn test_transfer_progress_start_file() {
        let mut progress = TransferProgress::new(4);

        progress.start_file(1, "test.mp4", 1000);

        assert_eq!(progress.current_file, 1);
        assert_eq!(progress.current_file_name, "test.mp4");
        assert_eq!(progress.bytes_total, 1000);
        assert_eq!(progress.status, TransferStatus::InProgress);
    }

    #[test]
    fn test_transfer_progress_update_bytes() {
        let mut progress = TransferProgress::new(4);
        progress.start_file(1, "test.mp4", 1000);

        progress.update_bytes(500);

        assert_eq!(progress.bytes_transferred, 500);
        assert_eq!(progress.current_file_percent(), 50.0);
    }

    #[test]
    fn test_transfer_progress_overall_percent() {
        let mut progress = TransferProgress::new(4);

        // Start file 1
        progress.start_file(1, "file1.mp4", 1000);
        progress.update_bytes(500);
        // Progress: 0 complete + 0.5 current = 0.5/4 = 12.5%
        assert!((progress.overall_percent - 12.5).abs() < 0.01);

        // Complete file 1
        progress.complete_file();
        // Progress: 0 complete + 1.0 current = 1.0/4 = 25%
        assert!((progress.overall_percent - 25.0).abs() < 0.01);

        // Start file 2
        progress.start_file(2, "file2.mp4", 1000);
        progress.update_bytes(500);
        // Progress: 1 complete + 0.5 current = 1.5/4 = 37.5%
        assert!((progress.overall_percent - 37.5).abs() < 0.01);
    }

    #[test]
    fn test_transfer_progress_mark_completed() {
        let mut progress = TransferProgress::new(4);
        progress.start_file(4, "file4.mp4", 1000);

        progress.mark_completed();

        assert_eq!(progress.status, TransferStatus::Completed);
        assert_eq!(progress.overall_percent, 100.0);
    }

    #[test]
    fn test_transfer_progress_mark_cancelled() {
        let mut progress = TransferProgress::new(4);
        progress.start_file(2, "file2.mp4", 1000);

        progress.mark_cancelled();

        assert_eq!(progress.status, TransferStatus::Cancelled);
    }

    #[test]
    fn test_transfer_result_success() {
        let result = TransferResult::success("op-123".to_string(), 10, 50000, 1000);

        assert_eq!(result.status, TransferStatus::Completed);
        assert_eq!(result.files_transferred, 10);
        assert_eq!(result.total_files, 10);
        assert!(result.failed_files.is_empty());
    }

    #[test]
    fn test_transfer_result_cancelled() {
        let result = TransferResult::cancelled("op-123".to_string(), 5, 10, 25000, 500);

        assert_eq!(result.status, TransferStatus::Cancelled);
        assert_eq!(result.files_transferred, 5);
        assert_eq!(result.total_files, 10);
    }

    #[test]
    fn test_transfer_result_failed() {
        let failed_files = vec![FailedFile {
            source_path: "/source/file.mp4".to_string(),
            destination_path: "/dest/file.mp4".to_string(),
            error: "Permission denied".to_string(),
        }];

        let result = TransferResult::failed("op-123".to_string(), 9, 10, 45000, failed_files, 900);

        assert_eq!(result.status, TransferStatus::Failed);
        assert_eq!(result.files_transferred, 9);
        assert_eq!(result.failed_files.len(), 1);
    }

    #[test]
    fn test_transfer_status_serialization() {
        // Test all TransferStatus variants serialize correctly
        let statuses = vec![
            (TransferStatus::Pending, "\"Pending\""),
            (TransferStatus::InProgress, "\"InProgress\""),
            (TransferStatus::Completed, "\"Completed\""),
            (TransferStatus::Failed, "\"Failed\""),
            (TransferStatus::Cancelled, "\"Cancelled\""),
        ];

        for (status, expected) in statuses {
            let json = serde_json::to_string(&status).expect("Serialization failed");
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_transfer_status_deserialization() {
        let statuses = vec![
            ("\"Pending\"", TransferStatus::Pending),
            ("\"InProgress\"", TransferStatus::InProgress),
            ("\"Completed\"", TransferStatus::Completed),
            ("\"Failed\"", TransferStatus::Failed),
            ("\"Cancelled\"", TransferStatus::Cancelled),
        ];

        for (json, expected) in statuses {
            let status: TransferStatus =
                serde_json::from_str(json).expect("Deserialization failed");
            assert_eq!(status, expected);
        }
    }

    #[test]
    fn test_transfer_progress_serialization() {
        let mut progress = TransferProgress::new(5);
        progress.start_file(1, "test.mp4", 1000);
        progress.update_bytes(500);

        let json = serde_json::to_string(&progress).expect("Serialization failed");

        assert!(json.contains("\"current_file\":1"));
        assert!(json.contains("\"total_files\":5"));
        assert!(json.contains("\"bytes_transferred\":500"));
        assert!(json.contains("\"bytes_total\":1000"));
        assert!(json.contains("\"current_file_name\":\"test.mp4\""));
        assert!(json.contains("\"status\":\"InProgress\""));
    }

    #[test]
    fn test_transfer_progress_deserialization() {
        let json = r#"{
            "current_file": 2,
            "total_files": 4,
            "bytes_transferred": 750,
            "bytes_total": 1000,
            "current_file_name": "video.mp4",
            "overall_percent": 43.75,
            "status": "InProgress"
        }"#;

        let progress: TransferProgress =
            serde_json::from_str(json).expect("Deserialization failed");

        assert_eq!(progress.current_file, 2);
        assert_eq!(progress.total_files, 4);
        assert_eq!(progress.bytes_transferred, 750);
        assert_eq!(progress.bytes_total, 1000);
        assert_eq!(progress.current_file_name, "video.mp4");
        assert_eq!(progress.status, TransferStatus::InProgress);
    }

    #[test]
    fn test_transfer_progress_mark_failed() {
        let mut progress = TransferProgress::new(4);
        progress.start_file(2, "file2.mp4", 1000);

        progress.mark_failed();

        assert_eq!(progress.status, TransferStatus::Failed);
    }

    #[test]
    fn test_transfer_progress_zero_total_files() {
        let mut progress = TransferProgress::new(0);

        // Should not panic with zero total files
        progress.start_file(1, "test.mp4", 1000);
        progress.update_bytes(500);

        assert_eq!(progress.overall_percent, 0.0);
    }

    #[test]
    fn test_transfer_progress_zero_byte_file() {
        let mut progress = TransferProgress::new(4);

        // Zero-byte file should not cause division by zero
        progress.start_file(1, "empty.txt", 0);

        assert_eq!(progress.current_file_percent(), 0.0);
    }

    #[test]
    fn test_file_transfer_info_serialization() {
        let info = FileTransferInfo {
            source_path: "/source/video.mp4".to_string(),
            destination_path: "/dest/video.mp4".to_string(),
            size_bytes: 1048576,
            camera: 2,
        };

        let json = serde_json::to_string(&info).expect("Serialization failed");

        assert!(json.contains("\"source_path\":\"/source/video.mp4\""));
        assert!(json.contains("\"destination_path\":\"/dest/video.mp4\""));
        assert!(json.contains("\"size_bytes\":1048576"));
        assert!(json.contains("\"camera\":2"));
    }

    #[test]
    fn test_failed_file_serialization() {
        let failed = FailedFile {
            source_path: "/src/file.mp4".to_string(),
            destination_path: "/dst/file.mp4".to_string(),
            error: "Disk full".to_string(),
        };

        let json = serde_json::to_string(&failed).expect("Serialization failed");

        assert!(json.contains("\"source_path\":\"/src/file.mp4\""));
        assert!(json.contains("\"error\":\"Disk full\""));
    }

    #[test]
    fn test_transfer_result_serialization() {
        let result = TransferResult::success("op-456".to_string(), 10, 102400, 5000);

        let json = serde_json::to_string(&result).expect("Serialization failed");

        assert!(json.contains("\"operation_id\":\"op-456\""));
        assert!(json.contains("\"status\":\"Completed\""));
        assert!(json.contains("\"files_transferred\":10"));
        assert!(json.contains("\"bytes_transferred\":102400"));
        assert!(json.contains("\"duration_ms\":5000"));
    }

    #[test]
    fn test_transfer_status_equality() {
        assert_eq!(TransferStatus::Pending, TransferStatus::Pending);
        assert_eq!(TransferStatus::InProgress, TransferStatus::InProgress);
        assert_eq!(TransferStatus::Completed, TransferStatus::Completed);
        assert_eq!(TransferStatus::Failed, TransferStatus::Failed);
        assert_eq!(TransferStatus::Cancelled, TransferStatus::Cancelled);

        assert_ne!(TransferStatus::Pending, TransferStatus::Completed);
        assert_ne!(TransferStatus::InProgress, TransferStatus::Failed);
    }

    #[test]
    fn test_transfer_progress_complete_then_start_new() {
        let mut progress = TransferProgress::new(3);

        // Complete first file
        progress.start_file(1, "file1.mp4", 1000);
        progress.update_bytes(1000);
        progress.complete_file();

        // Start second file
        progress.start_file(2, "file2.mp4", 2000);

        // Verify state reset for new file
        assert_eq!(progress.current_file, 2);
        assert_eq!(progress.current_file_name, "file2.mp4");
        assert_eq!(progress.bytes_transferred, 0);
        assert_eq!(progress.bytes_total, 2000);
    }
}
