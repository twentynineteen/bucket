/**
 * BuildProject Event Type Definitions
 *
 * Defines event types for stage progress, workflow communication,
 * and Tauri event payloads used in the BuildProject feature.
 */

// ============================================================================
// File Transfer Progress Events
// ============================================================================

/**
 * Progress information for file transfer operations.
 * Emitted by the Rust backend during file copy/move operations.
 */
export interface FileTransferProgress {
  /** Unique identifier for this transfer operation */
  operationId: string

  /** Name of the file currently being transferred */
  currentFile: string

  /** Number of files that have completed transfer */
  filesCompleted: number

  /** Total number of files to transfer */
  totalFiles: number

  /** Bytes transferred so far in current file */
  bytesTransferred: number

  /** Total bytes to transfer for current file */
  totalBytes: number

  /** Overall percentage complete (0-100) */
  percentage: number

  /** Transfer speed in bytes per second */
  bytesPerSecond: number

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining: number
}

/**
 * A single file to transfer, matching the Rust backend's struct.
 */
export interface FileTransferItem {
  /** Source file path */
  source: string
  /** Destination file path */
  destination: string
}

/**
 * Request payload for `transfer_files_with_progress`.
 */
export interface TransferRequest {
  /** List of files to transfer */
  files: FileTransferItem[]
}

/**
 * Transfer complete event payload from the Rust backend.
 */
export interface TransferCompleteEvent {
  /** Unique operation identifier */
  operationId: string
  /** Whether the transfer completed successfully */
  success: boolean
  /** Number of files successfully transferred */
  filesTransferred: number
  /** Error message if the transfer failed */
  error: string | null
}

/**
 * Handler function for file transfer progress
 */
export type FileTransferProgressHandler = (progress: FileTransferProgress) => void
