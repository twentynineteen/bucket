/**
 * File Transfer Stage Module
 *
 * Provides file transfer functionality with progress tracking, cancellation support,
 * and comprehensive error handling for the BuildProject workflow.
 *
 * Compatible with XState v5 fromPromise actors and the Tauri event system.
 */
import { fromPromise } from 'xstate'
import {
  cancelFileTransfer,
  listenFileTransferComplete,
  listenFileTransferProgress,
  transferFilesWithProgress
} from '../api'
import {
  BuildProjectError,
  createStageFailure,
  createStageSuccess,
  DEFAULT_STAGE_CONFIGS,
  ErrorKind,
  type FileTransferItem,
  type FileTransferProgressHandler,
  type FileTransferStageData,
  type StageConfig,
  type StageResult
} from '../types'

// =============================================================================
// Types
// =============================================================================

/**
 * Transfer payload shapes live with the other event types, next to the
 * `FileTransferProgress` payload they arrive with. Re-exported here because
 * this module's public surface has always included them.
 */
export type { FileTransferItem, TransferCompleteEvent, TransferRequest } from '../types'

/** An unlisten handle, as returned by the api.ts event wrappers. */
type UnlistenFn = () => void

/**
 * Options for the transferFiles function
 */
export interface TransferFilesOptions {
  /** Files to transfer with source and destination paths */
  files: FileTransferItem[]
  /** Optional callback for progress updates */
  onProgress?: FileTransferProgressHandler
  /** Optional AbortSignal for cancellation */
  signal?: AbortSignal
  /** Optional stage configuration override */
  config?: Partial<StageConfig>
}

/**
 * Result from initiating a transfer operation
 */
export interface TransferOperationHandle {
  /** Operation ID for tracking */
  operationId: string
  /** Promise that resolves when transfer completes */
  completion: Promise<StageResult<FileTransferStageData>>
  /** Function to cancel the transfer */
  cancel: () => Promise<boolean>
}

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for stall detection (30 seconds with no progress) */
const DEFAULT_STALL_TIMEOUT_MS = 30000

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Known transfer error patterns. The first match wins; order matters.
 */
const TRANSFER_ERROR_MATCHERS: ReadonlyArray<{
  test: (lower: string) => boolean
  kind: ErrorKind
  code: string
  recoverable: boolean
  getMessage: (original: string, filePath?: string) => string
}> = [
  {
    test: s => s.includes('not found') || s.includes('does not exist'),
    kind: ErrorKind.NotFound,
    code: 'FILE_NOT_FOUND',
    recoverable: false,
    getMessage: (orig, fp) => (fp ? `File not found: ${fp}` : orig)
  },
  {
    test: s =>
      s.includes('no space') ||
      s.includes('disk full') ||
      s.includes('insufficient space'),
    kind: ErrorKind.InsufficientSpace,
    code: 'DISK_FULL',
    recoverable: false,
    getMessage: () => 'Not enough disk space to complete the transfer'
  },
  {
    test: s => s.includes('cancelled') || s.includes('canceled'),
    kind: ErrorKind.Cancelled,
    code: 'CANCELLED',
    recoverable: false,
    getMessage: orig => orig
  },
  {
    test: s => s.includes('stall') || s.includes('timed out'),
    kind: ErrorKind.Timeout,
    code: 'STALLED',
    recoverable: true,
    getMessage: (orig, fp) => (fp ? `Transfer stalled for file: ${fp}` : orig)
  },
  {
    test: s => s.includes('permission') || s.includes('access denied'),
    kind: ErrorKind.Permission,
    code: 'PERMISSION_DENIED',
    recoverable: false,
    getMessage: (orig, fp) => (fp ? `Permission denied: ${fp}` : orig)
  }
]

/**
 * Maps error messages from the Rust backend to BuildProjectError instances
 */
function mapTransferError(errorMessage: string, filePath?: string): BuildProjectError {
  const lowerError = errorMessage.toLowerCase()
  const pathContext = filePath ? { path: filePath } : undefined

  const match = TRANSFER_ERROR_MATCHERS.find(m => m.test(lowerError))
  if (match) {
    return new BuildProjectError(
      match.kind,
      'file-transfer',
      match.getMessage(errorMessage, filePath),
      match.recoverable,
      { code: match.code, context: pathContext }
    )
  }

  // Generic I/O error
  return new BuildProjectError(ErrorKind.IO, 'file-transfer', errorMessage, true, {
    code: 'IO_ERROR',
    context: pathContext
  })
}

// =============================================================================
// Core Transfer Function
// =============================================================================

/**
 * Transfers files with progress tracking and cancellation support.
 *
 * This function initiates a file transfer operation via the Tauri backend,
 * sets up event listeners for progress updates, and handles completion/errors.
 *
 * @param options - Transfer options including files, progress callback, and abort signal
 * @returns Promise resolving to StageResult with transfer data or error
 *
 * @example
 * ```ts
 * const result = await transferFiles({
 *   files: [
 *     { source: '/path/to/video.mp4', destination: '/project/Footage/Camera 1/video.mp4' }
 *   ],
 *   onProgress: (progress) => {
 *     console.log(`${progress.percentage}% complete`)
 *   },
 *   signal: abortController.signal
 * })
 *
 * if (result.ok) {
 *   console.log(`Transferred ${result.data.filesTransferred} files`)
 * } else {
 *   console.error(`Transfer failed: ${result.error.message}`)
 * }
 * ```
 */
export async function transferFiles(
  options: TransferFilesOptions
): Promise<StageResult<FileTransferStageData>> {
  const { files, onProgress, signal, config } = options
  const mergedConfig = { ...DEFAULT_STAGE_CONFIGS['file-transfer'], ...config }
  const startTime = performance.now()

  // Validate input
  if (!files || files.length === 0) {
    return createStageFailure(
      ErrorKind.Validation,
      'No files provided for transfer',
      false,
      performance.now() - startTime
    )
  }

  // Check if already cancelled before starting
  if (signal?.aborted) {
    return createStageFailure(
      ErrorKind.Cancelled,
      'Transfer cancelled before starting',
      false,
      performance.now() - startTime
    )
  }

  let operationId: string
  // Collected rather than held in two `let`s: the assignments happen inside
  // `.then()` callbacks, so on the linear path to the `finally` block below
  // TypeScript still has the variables as `null` and the calls are unreachable
  // by its reckoning. An array the closures push into has no such seam (#210).
  const unlisteners: UnlistenFn[] = []
  let stallTimeoutId: ReturnType<typeof setTimeout> | null = null
  let lastProgressTime = Date.now()

  try {
    // Initiate the transfer - returns operation ID immediately
    operationId = await transferFilesWithProgress({ files })

    // Create a promise that resolves when transfer completes
    const completionPromise = new Promise<StageResult<FileTransferStageData>>(
      (resolve, reject) => {
        // Set up stall detection
        const checkStall = () => {
          const timeSinceLastProgress = Date.now() - lastProgressTime
          if (timeSinceLastProgress > DEFAULT_STALL_TIMEOUT_MS) {
            // Stall detected - attempt to cancel and reject
            cancelFileTransfer(operationId).catch(() => {
              // Ignore cancellation errors during stall handling
            })
            resolve(
              createStageFailure(
                ErrorKind.Timeout,
                'File transfer stalled - no progress for 30 seconds',
                true,
                performance.now() - startTime
              )
            )
          } else {
            stallTimeoutId = setTimeout(checkStall, 5000)
          }
        }
        stallTimeoutId = setTimeout(checkStall, 5000)

        // Listen for progress events
        listenFileTransferProgress(event => {
          if (event.payload.operationId === operationId) {
            lastProgressTime = Date.now()
            onProgress?.(event.payload)
          }
        })
          .then(unlisten => {
            unlisteners.push(unlisten)
          })
          .catch(reject)

        // Listen for completion event
        listenFileTransferComplete(event => {
          if (event.payload.operationId === operationId) {
            const duration = performance.now() - startTime

            if (event.payload.success) {
              resolve(
                createStageSuccess<FileTransferStageData>(
                  {
                    filesTransferred: event.payload.filesTransferred,
                    totalBytes: 0, // Not provided by backend, could be enhanced
                    destinationFolder: '' // Would need to be passed through
                  },
                  duration
                )
              )
            } else {
              const error = mapTransferError(
                event.payload.error || 'Unknown transfer error'
              )
              resolve(
                createStageFailure(error.kind, error.message, error.recoverable, duration)
              )
            }
          }
        })
          .then(unlisten => {
            unlisteners.push(unlisten)
          })
          .catch(reject)

        // Handle abort signal
        if (signal) {
          const abortHandler = () => {
            cancelFileTransfer(operationId)
              .then(() => {
                resolve(
                  createStageFailure(
                    ErrorKind.Cancelled,
                    'Transfer cancelled by user',
                    false,
                    performance.now() - startTime
                  )
                )
              })
              .catch(err => {
                resolve(
                  createStageFailure(
                    ErrorKind.Cancelled,
                    `Cancel request failed: ${err}`,
                    false,
                    performance.now() - startTime
                  )
                )
              })
          }

          if (signal.aborted) {
            abortHandler()
          } else {
            signal.addEventListener('abort', abortHandler, { once: true })
          }
        }

        // Apply timeout if configured
        if (mergedConfig.timeout > 0) {
          setTimeout(() => {
            cancelFileTransfer(operationId).catch(() => {
              // Ignore cancellation errors during timeout handling
            })
            resolve(
              createStageFailure(
                ErrorKind.Timeout,
                `Transfer timed out after ${mergedConfig.timeout}ms`,
                true,
                performance.now() - startTime
              )
            )
          }, mergedConfig.timeout)
        }
      }
    )

    return await completionPromise
  } catch (error) {
    const duration = performance.now() - startTime

    // Handle Tauri invoke errors
    if (error instanceof Error) {
      const mappedError = mapTransferError(error.message)
      return createStageFailure(
        mappedError.kind,
        mappedError.message,
        mappedError.recoverable,
        duration
      )
    }

    return createStageFailure(ErrorKind.Unknown, String(error), false, duration)
  } finally {
    // Cleanup listeners and timers
    if (stallTimeoutId) {
      clearTimeout(stallTimeoutId)
    }
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}

// =============================================================================
// Advanced Transfer Handle API
// =============================================================================

/**
 * Initiates a file transfer and returns a handle for tracking and cancellation.
 *
 * This function provides more control over the transfer operation compared to
 * the simple `transferFiles` function. It returns immediately with an operation
 * handle that can be used to cancel the transfer or await its completion.
 *
 * @param options - Transfer options
 * @returns Transfer operation handle with operationId, completion promise, and cancel function
 *
 * @example
 * ```ts
 * const handle = await startTransfer({
 *   files: [{ source: '/src/video.mp4', destination: '/dest/video.mp4' }],
 *   onProgress: (p) => updateUI(p.percentage)
 * })
 *
 * console.log(`Started transfer: ${handle.operationId}`)
 *
 * // Later, if user clicks cancel:
 * await handle.cancel()
 *
 * // Or wait for completion:
 * const result = await handle.completion
 * ```
 */
export async function startTransfer(
  options: TransferFilesOptions
): Promise<TransferOperationHandle> {
  const { files, onProgress, config } = options
  const mergedConfig = { ...DEFAULT_STAGE_CONFIGS['file-transfer'], ...config }
  const startTime = performance.now()

  // Validate input
  if (!files || files.length === 0) {
    throw new BuildProjectError(
      ErrorKind.Validation,
      'file-transfer',
      'No files provided for transfer',
      false
    )
  }

  // Initiate the transfer
  const operationId = await transferFilesWithProgress({ files })

  let progressUnlisten: UnlistenFn | null = null
  let completeUnlisten: UnlistenFn | null = null
  let stallTimeoutId: ReturnType<typeof setTimeout> | null = null
  let lastProgressTime = Date.now()
  let resolved = false

  // Create completion promise
  const completion = new Promise<StageResult<FileTransferStageData>>(resolve => {
    const cleanup = () => {
      if (stallTimeoutId) clearTimeout(stallTimeoutId)
      progressUnlisten?.()
      completeUnlisten?.()
    }

    const resolveOnce = (result: StageResult<FileTransferStageData>) => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(result)
      }
    }

    // Stall detection
    const checkStall = () => {
      if (resolved) return
      const timeSinceLastProgress = Date.now() - lastProgressTime
      if (timeSinceLastProgress > DEFAULT_STALL_TIMEOUT_MS) {
        cancelFileTransfer(operationId).catch(() => {})
        resolveOnce(
          createStageFailure(
            ErrorKind.Timeout,
            'File transfer stalled - no progress for 30 seconds',
            true,
            performance.now() - startTime
          )
        )
      } else {
        stallTimeoutId = setTimeout(checkStall, 5000)
      }
    }
    stallTimeoutId = setTimeout(checkStall, 5000)

    // Progress listener
    listenFileTransferProgress(event => {
      if (event.payload.operationId === operationId) {
        lastProgressTime = Date.now()
        onProgress?.(event.payload)
      }
    })
      .then(unlisten => {
        progressUnlisten = unlisten
      })
      .catch(err => {
        resolveOnce(
          createStageFailure(
            ErrorKind.Unknown,
            `Failed to listen for progress: ${err}`,
            false,
            performance.now() - startTime
          )
        )
      })

    // Completion listener
    listenFileTransferComplete(event => {
      if (event.payload.operationId === operationId) {
        const duration = performance.now() - startTime

        if (event.payload.success) {
          resolveOnce(
            createStageSuccess<FileTransferStageData>(
              {
                filesTransferred: event.payload.filesTransferred,
                totalBytes: 0,
                destinationFolder: ''
              },
              duration
            )
          )
        } else {
          const error = mapTransferError(event.payload.error || 'Unknown transfer error')
          resolveOnce(
            createStageFailure(error.kind, error.message, error.recoverable, duration)
          )
        }
      }
    })
      .then(unlisten => {
        completeUnlisten = unlisten
      })
      .catch(err => {
        resolveOnce(
          createStageFailure(
            ErrorKind.Unknown,
            `Failed to listen for completion: ${err}`,
            false,
            performance.now() - startTime
          )
        )
      })

    // Timeout handling
    if (mergedConfig.timeout > 0) {
      setTimeout(() => {
        cancelFileTransfer(operationId).catch(() => {})
        resolveOnce(
          createStageFailure(
            ErrorKind.Timeout,
            `Transfer timed out after ${mergedConfig.timeout}ms`,
            true,
            performance.now() - startTime
          )
        )
      }, mergedConfig.timeout)
    }
  })

  // Cancel function
  const cancel = async (): Promise<boolean> => {
    try {
      return await cancelFileTransfer(operationId)
    } catch {
      return false
    }
  }

  return {
    operationId,
    completion,
    cancel
  }
}

/**
 * Cancels an in-progress file transfer operation.
 *
 * @param operationId - The operation ID to cancel
 * @returns true if cancellation was signalled, false if operation not found
 */
export async function cancelTransfer(operationId: string): Promise<boolean> {
  try {
    return await cancelFileTransfer(operationId)
  } catch {
    return false
  }
}

// =============================================================================
// XState v5 Actor
// =============================================================================

/**
 * Input parameters for the file transfer XState actor
 */
export interface FileTransferActorInput {
  /** Files to transfer */
  files: FileTransferItem[]
  /** Optional progress callback */
  onProgress?: FileTransferProgressHandler
  /** Optional destination folder for result metadata */
  destinationFolder?: string
}

/**
 * XState v5 fromPromise actor for file transfer operations.
 *
 * This actor can be used directly in XState machine definitions for
 * orchestrating file transfers within a larger workflow.
 *
 * @example
 * ```ts
 * const machine = setup({
 *   actors: {
 *     transferFiles: fileTransferActor
 *   }
 * }).createMachine({
 *   // ...
 *   states: {
 *     transferring: {
 *       invoke: {
 *         src: 'transferFiles',
 *         input: ({ context }) => ({
 *           files: context.filesToTransfer,
 *           onProgress: (p) => console.log(p.percentage),
 *           destinationFolder: context.projectFolder
 *         }),
 *         onDone: 'success',
 *         onError: 'error'
 *       }
 *     }
 *   }
 * })
 * ```
 */
export const fileTransferActor = fromPromise<
  FileTransferStageData,
  FileTransferActorInput
>(async ({ input, signal }) => {
  const { files, onProgress, destinationFolder } = input

  const result = await transferFiles({
    files,
    onProgress,
    signal
  })

  if (result.ok) {
    return {
      ...result.data,
      destinationFolder: destinationFolder || result.data.destinationFolder
    }
  }

  // Type narrowing: result is StageFailure here (ok === false)
  // Use explicit type since discriminated union is on 'ok' property
  const failureResult = result as {
    ok: false
    error: { kind: string; message: string; recoverable: boolean }
    durationMs: number
  }

  // Throw error for XState error handling
  throw new BuildProjectError(
    failureResult.error.kind as ErrorKind,
    'file-transfer',
    failureResult.error.message,
    failureResult.error.recoverable
  )
})

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates file transfer items from footage files and a destination folder.
 *
 * @param files - Array of footage files with camera assignments
 * @param projectFolder - Base project folder path
 * @returns Array of FileTransferItem objects
 *
 * @example
 * ```ts
 * const items = createTransferItems(
 *   [{ file: { path: '/src/video.mp4', name: 'video.mp4' }, camera: 1 }],
 *   '/projects/MyProject'
 * )
 * // Returns: [{ source: '/src/video.mp4', destination: '/projects/MyProject/Footage/Camera 1/video.mp4' }]
 * ```
 */
export function createTransferItems(
  files: Array<{ file: { path: string; name: string }; camera: number }>,
  projectFolder: string
): FileTransferItem[] {
  return files.map(({ file, camera }) => ({
    source: file.path,
    destination: `${projectFolder}/Footage/Camera ${camera}/${file.name}`
  }))
}

/**
 * Estimates total transfer size from file items.
 * Note: This requires filesystem access and may not be accurate for all cases.
 *
 * @param files - Array of file transfer items
 * @returns Estimated total bytes (0 if cannot be determined)
 */
export function estimateTransferSize(files: FileTransferItem[]): number {
  // This would need filesystem access to get actual sizes
  // For now, return 0 as estimation requires Tauri backend
  return files.length > 0 ? 0 : 0
}

/**
 * Formats bytes into a human-readable string.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

/**
 * Formats estimated time remaining into a human-readable string.
 *
 * @param ms - Milliseconds remaining
 * @returns Formatted string (e.g., "2m 30s")
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0s'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}
