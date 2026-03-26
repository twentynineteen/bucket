/**
 * Breadcrumbs Stage Module
 *
 * Handles saving the breadcrumbs.json file during project creation.
 * This stage creates project metadata including project name, creation date,
 * camera assignments, and file information.
 *
 * Compatible with XState v5 fromPromise actors.
 */

import { invoke } from '@tauri-apps/api/core'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { fromPromise } from 'xstate'

import {
  type BreadcrumbsStageData,
  BuildProjectError,
  createIOError,
  createStageFailure,
  createStageSuccess,
  createTimeoutError,
  createValidationError,
  DEFAULT_STAGE_CONFIGS,
  ErrorKind,
  type StageConfig,
  type StageFailure,
  type StageResult
} from '../types'

// =============================================================================
// Types
// =============================================================================

/**
 * File data for breadcrumbs (camera assignment and file info)
 */
export interface BreadcrumbsFileData {
  camera: number
  name: string
  path: string
}

/**
 * Input parameters for the saveBreadcrumbs function
 */
export interface SaveBreadcrumbsInput {
  /** Full path to the project folder */
  projectFolder: string
  /** Project title/name */
  projectTitle: string
  /** Number of cameras in the project */
  numberOfCameras: number
  /** Array of files with camera assignments */
  files: BreadcrumbsFileData[]
  /** Parent folder where the project resides */
  parentFolder: string
  /** Username of the creator */
  username: string
  /** Optional folder size in bytes (calculated if not provided) */
  folderSizeBytes?: number
}

/**
 * Complete breadcrumbs.json schema
 * Matches the schema used throughout the application
 */
export interface BreadcrumbsJson {
  projectTitle: string
  numberOfCameras: number
  files: BreadcrumbsFileData[]
  parentFolder: string
  createdBy: string
  creationDateTime: string
  folderSizeBytes?: number
  lastModified?: string
  scannedBy?: string
  trelloCardUrl?: string
  videoLinks?: Array<{
    url: string
    videoId: string
    title: string
    thumbnailUrl?: string
    lastFetched?: string
  }>
  trelloCards?: Array<{
    url: string
    cardId: string
    title: string
    boardName?: string
    lastFetched?: string
  }>
}

/**
 * Options for stage execution
 */
export interface SaveBreadcrumbsOptions {
  /** Stage configuration (uses defaults if not provided) */
  config?: Partial<StageConfig>
  /** Whether to calculate folder size (default: true) */
  calculateFolderSize?: boolean
  /** Abort signal for cancellation support */
  signal?: AbortSignal
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default configuration for the breadcrumbs stage
 */
export const BREADCRUMBS_STAGE_CONFIG: StageConfig = {
  ...DEFAULT_STAGE_CONFIGS.breadcrumbs
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate folder size using Tauri backend
 * Returns undefined if calculation fails (non-blocking)
 */
async function getFolderSize(folderPath: string): Promise<number | undefined> {
  try {
    const size = await invoke<number>('get_folder_size', { folderPath })
    return size
  } catch {
    // Folder size is optional, don't fail the stage
    return undefined
  }
}

/**
 * Create ISO 8601 timestamp
 */
function createTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Build the breadcrumbs data structure
 */
function buildBreadcrumbsData(
  input: SaveBreadcrumbsInput,
  folderSizeBytes?: number
): BreadcrumbsJson {
  return {
    projectTitle: input.projectTitle,
    numberOfCameras: input.numberOfCameras,
    files: input.files,
    parentFolder: input.parentFolder,
    createdBy: input.username || 'Unknown User',
    creationDateTime: createTimestamp(),
    folderSizeBytes
  }
}

/**
 * Validate breadcrumbs input parameters
 */
function validateInput(input: SaveBreadcrumbsInput): void {
  if (!input.projectFolder?.trim()) {
    throw createValidationError('breadcrumbs', 'Project folder path is required', {
      field: 'projectFolder'
    })
  }

  if (!input.projectTitle?.trim()) {
    throw createValidationError('breadcrumbs', 'Project title is required', {
      field: 'projectTitle'
    })
  }

  if (typeof input.numberOfCameras !== 'number' || input.numberOfCameras < 1) {
    throw createValidationError('breadcrumbs', 'Number of cameras must be at least 1', {
      field: 'numberOfCameras',
      value: input.numberOfCameras
    })
  }
}

/**
 * Execute with timeout support
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: 'breadcrumbs'
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise
  }

  let timeoutId: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createTimeoutError(stage, timeoutMs))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    throw error
  }
}

// =============================================================================
// Main Stage Function
// =============================================================================

/**
 * Save breadcrumbs.json file with project metadata
 *
 * This function:
 * 1. Validates input parameters
 * 2. Optionally calculates folder size
 * 3. Creates the breadcrumbs data structure
 * 4. Writes the breadcrumbs.json file to the project folder
 *
 * @param input - Project metadata and file information
 * @param options - Stage execution options
 * @returns StageResult with breadcrumbs path and metadata
 *
 * @example
 * ```typescript
 * const result = await saveBreadcrumbs({
 *   projectFolder: '/path/to/project',
 *   projectTitle: 'My Project',
 *   numberOfCameras: 3,
 *   files: [
 *     { camera: 1, name: 'clip1.mp4', path: 'Footage/Camera 1/clip1.mp4' }
 *   ],
 *   parentFolder: '/path/to',
 *   username: 'john.doe'
 * })
 *
 * if (result.ok) {
 *   console.log('Breadcrumbs saved to:', result.data.breadcrumbsPath)
 * }
 * ```
 */
export async function saveBreadcrumbs(
  input: SaveBreadcrumbsInput,
  options: SaveBreadcrumbsOptions = {}
): Promise<StageResult<BreadcrumbsStageData>> {
  const startTime = performance.now()
  const config = { ...BREADCRUMBS_STAGE_CONFIG, ...options.config }

  try {
    // Check for cancellation
    if (options.signal?.aborted) {
      return createStageFailure(
        ErrorKind.Cancelled,
        'Operation cancelled',
        false,
        performance.now() - startTime
      )
    }

    // Validate input
    validateInput(input)

    // Calculate folder size if requested
    const shouldCalculateSize = options.calculateFolderSize !== false
    let folderSizeBytes = input.folderSizeBytes

    if (shouldCalculateSize && !folderSizeBytes) {
      folderSizeBytes = await getFolderSize(input.projectFolder)
    }

    // Build breadcrumbs data
    const breadcrumbsData = buildBreadcrumbsData(input, folderSizeBytes)

    // Write to file with timeout support
    const breadcrumbsPath = `${input.projectFolder}/breadcrumbs.json`
    const content = JSON.stringify(breadcrumbsData, null, 2)

    const writeOperation = writeTextFile(breadcrumbsPath, content)

    if (config.timeout > 0) {
      await withTimeout(writeOperation, config.timeout, 'breadcrumbs')
    } else {
      await writeOperation
    }

    // Check for cancellation after write
    if (options.signal?.aborted) {
      return createStageFailure(
        ErrorKind.Cancelled,
        'Operation cancelled after write',
        false,
        performance.now() - startTime
      )
    }

    const durationMs = performance.now() - startTime

    return createStageSuccess<BreadcrumbsStageData>(
      {
        breadcrumbsPath,
        projectTitle: input.projectTitle,
        numberOfCameras: input.numberOfCameras
      },
      durationMs
    )
  } catch (error) {
    const durationMs = performance.now() - startTime

    // Handle known error types
    if (error instanceof BuildProjectError) {
      return createStageFailure(error.kind, error.message, error.recoverable, durationMs)
    }

    // Handle file system errors
    if (error instanceof Error) {
      const message = error.message

      // Check for common file system error patterns
      if (
        message.includes('permission') ||
        message.includes('EACCES') ||
        message.includes('EPERM')
      ) {
        return createStageFailure(
          ErrorKind.Permission,
          `Permission denied when writing breadcrumbs: ${message}`,
          false,
          durationMs
        )
      }

      if (message.includes('no space') || message.includes('ENOSPC')) {
        return createStageFailure(
          ErrorKind.InsufficientSpace,
          'Insufficient disk space to write breadcrumbs file',
          false,
          durationMs
        )
      }

      if (message.includes('not found') || message.includes('ENOENT')) {
        return createStageFailure(
          ErrorKind.NotFound,
          `Project folder not found: ${input.projectFolder}`,
          true,
          durationMs
        )
      }

      // Generic I/O error
      const ioError = createIOError(
        'breadcrumbs',
        `Failed to write breadcrumbs file: ${message}`,
        { path: `${input.projectFolder}/breadcrumbs.json` }
      )

      return createStageFailure(
        ioError.kind,
        ioError.message,
        ioError.recoverable,
        durationMs
      )
    }

    // Unknown error
    return createStageFailure(
      ErrorKind.Unknown,
      `Unknown error saving breadcrumbs: ${String(error)}`,
      false,
      durationMs
    )
  }
}

// =============================================================================
// XState v5 Actor
// =============================================================================

/**
 * XState v5 fromPromise actor for the breadcrumbs stage
 *
 * This actor can be used directly in an XState machine setup:
 *
 * @example
 * ```typescript
 * import { setup } from 'xstate'
 * import { saveBreadcrumbsActor } from '@/features/build-project/stages/breadcrumbs'
 *
 * const machine = setup({
 *   actors: {
 *     saveBreadcrumbs: saveBreadcrumbsActor
 *   }
 * }).createMachine({
 *   // ...
 *   states: {
 *     savingBreadcrumbs: {
 *       invoke: {
 *         src: 'saveBreadcrumbs',
 *         input: ({ context }) => ({
 *           projectFolder: context.projectFolder,
 *           projectTitle: context.projectTitle,
 *           numberOfCameras: context.numCameras,
 *           files: context.files,
 *           parentFolder: context.destinationPath,
 *           username: context.username
 *         }),
 *         onDone: { target: 'nextStage' },
 *         onError: { target: 'error' }
 *       }
 *     }
 *   }
 * })
 * ```
 */
export const saveBreadcrumbsActor = fromPromise<
  BreadcrumbsStageData,
  SaveBreadcrumbsInput
>(async ({ input }) => {
  const result = await saveBreadcrumbs(input)

  if (result.ok === true) {
    return result.data
  }

  // Type assertion - we know result is StageFailure when ok is false
  const failure = result as StageFailure
  throw new BuildProjectError(
    failure.error.kind as ErrorKind,
    'breadcrumbs',
    failure.error.message,
    failure.error.recoverable
  )
})

// =============================================================================
// Retry Wrapper
// =============================================================================

/**
 * Execute saveBreadcrumbs with retry support
 *
 * Respects the retryable and maxRetries settings from StageConfig.
 *
 * @param input - Save breadcrumbs input parameters
 * @param options - Stage options including config
 * @returns StageResult with retry information in context if retried
 */
export async function saveBreadcrumbsWithRetry(
  input: SaveBreadcrumbsInput,
  options: SaveBreadcrumbsOptions = {}
): Promise<StageResult<BreadcrumbsStageData>> {
  const config = { ...BREADCRUMBS_STAGE_CONFIG, ...options.config }
  let lastResult: StageResult<BreadcrumbsStageData>
  let attempts = 0

  do {
    attempts++
    lastResult = await saveBreadcrumbs(input, options)

    // Success - return immediately
    if (lastResult.ok === true) {
      return lastResult
    }

    // Type assertion - we know lastResult is StageFailure when ok is false
    const failure = lastResult as StageFailure

    // Non-recoverable error - return immediately
    if (!failure.error.recoverable) {
      return lastResult
    }

    // Check if retries are exhausted
    if (!config.retryable || attempts >= config.maxRetries) {
      return lastResult
    }

    // Brief delay before retry (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000)
    await new Promise((resolve) => setTimeout(resolve, delay))
  } while (attempts <= config.maxRetries)

  return lastResult
}
