/**
 * Folder Creation Stage Module
 *
 * This module handles the creation of the project folder structure
 * as part of the BuildProject workflow. It creates the main project
 * folder and all required subfolders.
 *
 * Compatible with XState v5 fromPromise actors.
 */

import { mkdir } from '@tauri-apps/plugin-fs'
import { fromPromise } from 'xstate'

import {
  BuildProjectError,
  createIOError,
  createPermissionError,
  createStageFailure,
  createStageSuccess,
  ErrorKind,
  type FoldersStageData,
  type StageConfig,
  type StageResult
} from '../types'

// =============================================================================
// Constants
// =============================================================================

/**
 * Standard subfolders to create in every project
 */
export const PROJECT_SUBFOLDERS = [
  'Footage',
  'Graphics',
  'Renders',
  'Projects',
  'Scripts'
] as const

/**
 * Default configuration for the folder creation stage
 */
export const FOLDER_CREATION_CONFIG: StageConfig = {
  name: 'folders',
  displayName: 'Creating Folders',
  timeout: 60000, // 1 minute
  retryable: true,
  maxRetries: 2,
  cancellable: true,
  parallel: false,
  dependsOn: ['validation']
}

// =============================================================================
// Types
// =============================================================================

/**
 * Input parameters for folder creation
 */
export interface FolderCreationInput {
  /** Full path to the project root folder to create */
  projectFolder: string

  /** Number of camera folders to create (0 = no camera folders) */
  numCameras: number

  /** Optional abort signal for cancellation support */
  signal?: AbortSignal
}

/**
 * Result data returned on successful folder creation
 * Alias for FoldersStageData from types
 */
export type FolderCreationData = FoldersStageData

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Creates a single folder with error handling
 *
 * @param folderPath - Path to the folder to create
 * @throws BuildProjectError on failure
 */
async function createSingleFolder(folderPath: string): Promise<void> {
  try {
    await mkdir(folderPath, { recursive: true })
  } catch (error) {
    // Check for permission errors
    if (
      error instanceof Error &&
      (error.message.includes('permission') ||
        error.message.includes('EACCES') ||
        error.message.includes('EPERM'))
    ) {
      throw createPermissionError(
        'folders',
        `Cannot create folder: ${folderPath}`,
        folderPath
      )
    }

    // Wrap other errors as I/O errors
    throw createIOError('folders', `Failed to create folder: ${folderPath}`, {
      path: folderPath,
      originalError: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Creates camera subfolders under Footage/
 *
 * @param projectFolder - Project root path
 * @param numCameras - Number of camera folders to create
 * @param signal - Optional abort signal
 * @returns Array of created camera folder paths
 */
async function createCameraFolders(
  projectFolder: string,
  numCameras: number,
  signal?: AbortSignal
): Promise<string[]> {
  const createdFolders: string[] = []

  for (let cam = 1; cam <= numCameras; cam++) {
    // Check for cancellation before each folder
    if (signal?.aborted) {
      throw new BuildProjectError(
        ErrorKind.Cancelled,
        'folders',
        'Folder creation was cancelled',
        false
      )
    }

    const cameraPath = `${projectFolder}/Footage/Camera ${cam}`
    await createSingleFolder(cameraPath)
    createdFolders.push(cameraPath)
  }

  return createdFolders
}

/**
 * Creates the standard support subfolders in parallel
 *
 * @param projectFolder - Project root path
 * @returns Array of created folder paths
 */
async function createSupportFolders(projectFolder: string): Promise<string[]> {
  const folderPaths = PROJECT_SUBFOLDERS.map((name) => `${projectFolder}/${name}`)

  await Promise.all(folderPaths.map((path) => createSingleFolder(path)))

  return folderPaths
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Creates the complete project folder structure
 *
 * This function creates:
 * 1. The main project folder
 * 2. Camera subfolders under Footage/ (if numCameras > 0)
 * 3. Standard support folders: Footage/, Graphics/, Renders/, Projects/, Scripts/
 *
 * @param input - Folder creation parameters
 * @returns StageResult with created folder paths or error information
 *
 * @example
 * const result = await createFolders({
 *   projectFolder: '/Users/dan/Projects/MyVideo',
 *   numCameras: 3
 * })
 *
 * if (result.ok) {
 *   console.log('Created folders:', result.data.createdFolders)
 * } else {
 *   console.error('Failed:', result.error.message)
 * }
 */
export async function createFolders(
  input: FolderCreationInput
): Promise<StageResult<FolderCreationData>> {
  const startTime = performance.now()
  const { projectFolder, numCameras, signal } = input
  const createdFolders: string[] = []

  try {
    // Check for immediate cancellation
    if (signal?.aborted) {
      return createStageFailure(
        ErrorKind.Cancelled,
        'Folder creation was cancelled before starting',
        false,
        performance.now() - startTime
      )
    }

    // Step 1: Create main project folder
    await createSingleFolder(projectFolder)
    createdFolders.push(projectFolder)

    // Check for cancellation after main folder
    if (signal?.aborted) {
      return createStageFailure(
        ErrorKind.Cancelled,
        'Folder creation was cancelled',
        false,
        performance.now() - startTime
      )
    }

    // Step 2: Create support folders in parallel
    const supportFolders = await createSupportFolders(projectFolder)
    createdFolders.push(...supportFolders)

    // Step 3: Create camera subfolders (sequential to maintain order)
    if (numCameras > 0) {
      const cameraFolders = await createCameraFolders(projectFolder, numCameras, signal)
      createdFolders.push(...cameraFolders)
    }

    // Success
    const durationMs = performance.now() - startTime
    return createStageSuccess<FolderCreationData>(
      {
        createdFolders,
        projectRoot: projectFolder
      },
      durationMs
    )
  } catch (error) {
    const durationMs = performance.now() - startTime

    // Handle BuildProjectError (already well-typed)
    if (error instanceof BuildProjectError) {
      return createStageFailure(error.kind, error.message, error.recoverable, durationMs)
    }

    // Handle generic errors
    const message = error instanceof Error ? error.message : String(error)
    return createStageFailure(
      ErrorKind.IO,
      `Folder creation failed: ${message}`,
      true,
      durationMs
    )
  }
}

// =============================================================================
// XState v5 Actor Factory
// =============================================================================

/**
 * XState v5 fromPromise actor for folder creation stage
 *
 * Use this with XState machine's invoke configuration:
 *
 * @example
 * import { createFoldersActor } from './stages/folderCreation'
 *
 * const machine = setup({
 *   actors: {
 *     createFolders: createFoldersActor
 *   }
 * }).createMachine({
 *   // ...
 *   states: {
 *     creatingFolders: {
 *       invoke: {
 *         src: 'createFolders',
 *         input: ({ context }) => ({
 *           projectFolder: context.projectFolder,
 *           numCameras: context.numCameras
 *         }),
 *         onDone: { target: 'nextState' },
 *         onError: { target: 'error' }
 *       }
 *     }
 *   }
 * })
 */
export const createFoldersActor = fromPromise<FolderCreationData, FolderCreationInput>(
  async ({ input, signal }) => {
    const result = await createFolders({ ...input, signal })

    if (!result.ok) {
      // Throw error for XState to handle via onError
      throw new BuildProjectError(
        result.error.kind as ErrorKind,
        'folders',
        result.error.message,
        result.error.recoverable
      )
    }

    return result.data
  }
)

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validates folder creation input parameters
 *
 * @param input - Input parameters to validate
 * @returns Validation result with error message if invalid
 */
export function validateFolderCreationInput(input: FolderCreationInput): {
  valid: boolean
  error?: string
} {
  if (!input.projectFolder || input.projectFolder.trim() === '') {
    return { valid: false, error: 'Project folder path is required' }
  }

  if (input.numCameras < 0) {
    return { valid: false, error: 'Number of cameras cannot be negative' }
  }

  if (input.numCameras > 100) {
    return { valid: false, error: 'Number of cameras exceeds maximum (100)' }
  }

  return { valid: true }
}

/**
 * Gets the expected folder count for a given configuration
 *
 * @param numCameras - Number of cameras
 * @returns Total number of folders that will be created
 */
export function getExpectedFolderCount(numCameras: number): number {
  // Main folder + 5 support folders + camera folders
  return 1 + PROJECT_SUBFOLDERS.length + Math.max(0, numCameras)
}
