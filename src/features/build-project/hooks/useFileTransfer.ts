/**
 * useFileTransfer Hook
 *
 * Manages file transfer operations with progress tracking, cancellation support,
 * and Tauri event integration. This hook wraps the file transfer functionality
 * for the BuildProject workflow's file-transfer stage.
 *
 * @example
 * const { progress, status, error, startTransfer, cancel } = useFileTransfer()
 *
 * // Start a transfer
 * await startTransfer(files, '/path/to/destination')
 *
 * // Cancel if needed
 * cancel()
 *
 * // Check status
 * if (status === 'completed') {
 *   console.log(`Transferred ${progress.filesCompleted} files`)
 * }
 */

import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'

import { logger } from '@/utils/logger'

import type { FileTransferProgress, UnsubscribeFn } from '../types'
import { TAURI_EVENTS } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Transfer status states
 */
export type FileTransferStatus =
  | 'idle'
  | 'transferring'
  | 'completed'
  | 'error'
  | 'cancelled'

/**
 * File input for transfer operations
 */
export interface TransferFile {
  /** Absolute path to the source file */
  path: string
  /** Camera number for folder organization (1-based) */
  camera: number
}

/**
 * Error information for failed transfers
 */
export interface FileTransferError {
  /** Error kind/category */
  kind: string
  /** Human-readable error message */
  message: string
  /** Whether the transfer can be retried */
  recoverable: boolean
}

/**
 * Return type for useFileTransfer hook
 */
export interface UseFileTransferReturn {
  /** Current progress information */
  progress: FileTransferProgress | null
  /** Current transfer status */
  status: FileTransferStatus
  /** Error information if status is 'error' */
  error: FileTransferError | null
  /** Start a file transfer operation */
  startTransfer: (files: TransferFile[], destination: string) => Promise<void>
  /** Cancel the current transfer operation */
  cancel: () => void
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial progress state for new transfers
 */
function createInitialProgress(): FileTransferProgress {
  return {
    operationId: '',
    currentFile: '',
    filesCompleted: 0,
    totalFiles: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    bytesPerSecond: 0,
    estimatedTimeRemaining: 0
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing file transfer operations with Tauri backend integration.
 *
 * Features:
 * - Real-time progress tracking via Tauri events
 * - User-initiated cancellation support
 * - Automatic cleanup of event listeners on unmount
 * - Type-safe status and error handling
 */
export function useFileTransfer(): UseFileTransferReturn {
  // State
  const [progress, setProgress] = useState<FileTransferProgress | null>(null)
  const [status, setStatus] = useState<FileTransferStatus>('idle')
  const [error, setError] = useState<FileTransferError | null>(null)

  // Refs for cleanup and cancellation
  const unsubscribeRef = useRef<UnsubscribeFn | null>(null)
  const isMountedRef = useRef(true)
  const operationIdRef = useRef<string | null>(null)

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up event listeners
   */
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current()
      } catch (err) {
        logger.debug('Event listener cleanup encountered errors:', err)
      }
      unsubscribeRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle progress update events from Tauri
   */
  const handleProgressUpdate = useCallback((progressData: FileTransferProgress) => {
    if (!isMountedRef.current) return

    // Verify this progress update is for our operation
    if (operationIdRef.current && progressData.operationId !== operationIdRef.current) {
      return
    }

    setProgress(progressData)

    // Check if transfer is complete
    if (
      progressData.percentage >= 100 &&
      progressData.filesCompleted === progressData.totalFiles
    ) {
      setStatus('completed')
    }
  }, [])

  // ============================================================================
  // Transfer Operations
  // ============================================================================

  /**
   * Start a file transfer operation
   *
   * @param files - Array of files to transfer with camera assignments
   * @param destination - Destination folder path
   */
  const startTransfer = useCallback(
    async (files: TransferFile[], destination: string): Promise<void> => {
      // Reset state for new transfer
      setStatus('transferring')
      setError(null)
      setProgress(createInitialProgress())

      // Generate operation ID for this transfer
      const operationId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      operationIdRef.current = operationId

      // Clean up any existing listeners
      cleanup()

      try {
        // Set up progress event listener BEFORE starting transfer
        const unlisten = await listen<FileTransferProgress>(
          TAURI_EVENTS.FILE_TRANSFER_PROGRESS,
          (event) => {
            handleProgressUpdate(event.payload)
          }
        )
        unsubscribeRef.current = unlisten

        // Prepare file list for Tauri command
        // Format: [path, camera][]
        const fileList: [string, number][] = files.map((f) => [f.path, f.camera])

        // Update initial progress with file count
        if (isMountedRef.current) {
          setProgress((prev) => ({
            ...(prev ?? createInitialProgress()),
            operationId,
            totalFiles: files.length
          }))
        }

        // Invoke the Tauri move_files command
        await invoke('move_files', {
          files: fileList,
          baseDest: destination,
          operationId
        })

        // If we reach here without cancellation, mark as completed
        if (isMountedRef.current && status !== 'cancelled') {
          setStatus('completed')
        }
      } catch (err) {
        if (!isMountedRef.current) return

        // Handle cancellation specifically
        if (err instanceof Error && err.message.includes('cancelled')) {
          setStatus('cancelled')
          setError({
            kind: 'Cancelled',
            message: 'File transfer was cancelled by user',
            recoverable: false
          })
          return
        }

        // Handle other errors
        const errorMessage = err instanceof Error ? err.message : String(err)
        setStatus('error')
        setError({
          kind: 'IO',
          message: errorMessage,
          recoverable: true
        })
        logger.error('File transfer failed:', err)
      }
    },
    [cleanup, handleProgressUpdate, status]
  )

  /**
   * Cancel the current transfer operation
   */
  const cancel = useCallback(() => {
    if (status !== 'transferring') {
      logger.debug('Cannot cancel: no transfer in progress')
      return
    }

    // Emit cancellation event to Tauri backend
    emit(TAURI_EVENTS.CANCEL_REQUEST, {
      operationId: operationIdRef.current,
      stage: 'file-transfer'
    }).catch((err) => {
      logger.error('Failed to emit cancel request:', err)
    })

    // Update local state immediately for responsive UI
    setStatus('cancelled')
    setError({
      kind: 'Cancelled',
      message: 'File transfer was cancelled by user',
      recoverable: false
    })

    // Clean up listeners
    cleanup()
  }, [status, cleanup])

  // ============================================================================
  // Return
  // ============================================================================

  return {
    progress,
    status,
    error,
    startTransfer,
    cancel
  }
}
