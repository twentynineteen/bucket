/**
 * Validation Stage Module
 *
 * Validates all inputs before project creation begins. This is the first stage
 * in the BuildProject workflow and must pass before any file system operations occur.
 *
 * Compatible with XState v5 fromPromise actors.
 */

import { exists } from '@tauri-apps/plugin-fs'
import { fromPromise } from 'xstate'

import {
  createStageFailure,
  createStageSuccess,
  createValidationError,
  type StageConfig,
  type StageResult,
  type ValidationStageData
} from '../types'

// =============================================================================
// Input Types
// =============================================================================

/**
 * File with camera assignment for validation
 */
export interface FileWithCamera {
  file: {
    path: string
    name: string
  }
  camera: number
}

/**
 * Input parameters for the validation stage
 */
export interface ValidationInput {
  /** Array of files with camera assignments */
  files: FileWithCamera[]

  /** Project name/title */
  projectName: string

  /** Output directory path */
  outputPath: string

  /** Number of cameras configured for the project */
  numCameras: number
}

// =============================================================================
// Validation Error Types
// =============================================================================

/**
 * Represents a single validation error
 */
export interface ValidationError {
  /** Field or area that failed validation */
  field: 'files' | 'projectName' | 'outputPath' | 'cameraAssignments'

  /** Error message describing the validation failure */
  message: string

  /** Optional additional context */
  context?: Record<string, unknown>
}

/**
 * Extended validation result data including any validation errors
 */
export interface ValidationResultData extends ValidationStageData {
  /** List of validation errors if any */
  validationErrors: ValidationError[]
}

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * Pattern for valid project name characters.
 * Allows alphanumeric, spaces, hyphens, underscores, and common punctuation.
 * Disallows characters that are problematic for file systems: / \ : * ? " < > |
 */
const VALID_PROJECT_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.,()[\]'&!@#$%^+=]+$/

/**
 * Reserved names that cannot be used as project names (Windows compatibility)
 */
const RESERVED_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
]

/**
 * Maximum project name length (for cross-platform compatibility)
 */
const MAX_PROJECT_NAME_LENGTH = 200

// =============================================================================
// Individual Validators
// =============================================================================

/**
 * Validates that the files array is not empty
 */
function validateFilesNotEmpty(files: FileWithCamera[]): ValidationError | null {
  if (!files || files.length === 0) {
    return {
      field: 'files',
      message: 'At least one file must be selected for the project.'
    }
  }
  return null
}

/**
 * Validates that the project name is valid
 */
function validateProjectName(projectName: string): ValidationError | null {
  // Check for empty or whitespace-only names
  const trimmedName = projectName?.trim()
  if (!trimmedName) {
    return {
      field: 'projectName',
      message: 'Project name is required and cannot be empty.'
    }
  }

  // Check for maximum length
  if (trimmedName.length > MAX_PROJECT_NAME_LENGTH) {
    return {
      field: 'projectName',
      message: `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less.`,
      context: { length: trimmedName.length, maxLength: MAX_PROJECT_NAME_LENGTH }
    }
  }

  // Check for invalid characters
  if (!VALID_PROJECT_NAME_PATTERN.test(trimmedName)) {
    return {
      field: 'projectName',
      message:
        'Project name contains invalid characters. Avoid using: / \\ : * ? " < > |',
      context: { projectName: trimmedName }
    }
  }

  // Check for reserved names (Windows compatibility)
  const upperName = trimmedName.toUpperCase()
  if (RESERVED_NAMES.includes(upperName)) {
    return {
      field: 'projectName',
      message: `"${trimmedName}" is a reserved name and cannot be used as a project name.`,
      context: { reservedName: trimmedName }
    }
  }

  // Check for names that start or end with spaces or periods
  if (projectName.startsWith(' ') || projectName.endsWith(' ')) {
    return {
      field: 'projectName',
      message: 'Project name cannot start or end with spaces.'
    }
  }

  if (trimmedName.endsWith('.')) {
    return {
      field: 'projectName',
      message: 'Project name cannot end with a period.'
    }
  }

  return null
}

/**
 * Validates that the output path exists
 * This is an async operation that checks the file system
 */
async function validateOutputPath(outputPath: string): Promise<ValidationError | null> {
  // Check for empty path
  if (!outputPath?.trim()) {
    return {
      field: 'outputPath',
      message: 'Output path is required. Please select a destination folder.'
    }
  }

  // Check if the path exists
  try {
    const pathExists = await exists(outputPath)
    if (!pathExists) {
      return {
        field: 'outputPath',
        message: `Output path does not exist: ${outputPath}`,
        context: { path: outputPath }
      }
    }
  } catch (error) {
    return {
      field: 'outputPath',
      message: `Unable to access output path: ${outputPath}`,
      context: {
        path: outputPath,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  return null
}

/**
 * Validates that all camera assignments are within valid range (1 to numCameras)
 */
function validateCameraAssignments(
  files: FileWithCamera[],
  numCameras: number
): ValidationError | null {
  if (!files || files.length === 0 || numCameras < 1) {
    return null // Skip if no files or invalid numCameras
  }

  const invalidAssignments: Array<{ fileName: string; camera: number }> = []

  for (const file of files) {
    if (file.camera < 1 || file.camera > numCameras) {
      invalidAssignments.push({
        fileName: file.file.name,
        camera: file.camera
      })
    }
  }

  if (invalidAssignments.length > 0) {
    const fileNames = invalidAssignments.map((a) => a.fileName).join(', ')
    return {
      field: 'cameraAssignments',
      message: `Invalid camera assignments found. Camera must be between 1 and ${numCameras}. Invalid files: ${fileNames}`,
      context: {
        invalidAssignments,
        numCameras,
        validRange: { min: 1, max: numCameras }
      }
    }
  }

  return null
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validates all inputs before project creation.
 *
 * @param input - The validation input parameters
 * @param config - Optional stage configuration for timeout/retries
 * @returns A StageResult containing validation data or errors
 */
export async function validateInputs(
  input: ValidationInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config?: Partial<StageConfig>
): Promise<StageResult<ValidationResultData>> {
  const startTime = performance.now()
  const errors: ValidationError[] = []
  const warnings: string[] = []

  try {
    // Run synchronous validations first
    const filesError = validateFilesNotEmpty(input.files)
    if (filesError) {
      errors.push(filesError)
    }

    const projectNameError = validateProjectName(input.projectName)
    if (projectNameError) {
      errors.push(projectNameError)
    }

    const cameraError = validateCameraAssignments(input.files, input.numCameras)
    if (cameraError) {
      errors.push(cameraError)
    }

    // Run async validations
    const outputPathError = await validateOutputPath(input.outputPath)
    if (outputPathError) {
      errors.push(outputPathError)
    }

    // Calculate duration
    const durationMs = performance.now() - startTime

    // If there are validation errors, return failure
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ')
      return createStageFailure('Validation', errorMessages, true, durationMs)
    }

    // Compute the project folder path
    const projectFolder = `${input.outputPath}/${input.projectName.trim()}`

    // Check for potential warnings (non-blocking)
    if (input.files.length === 0) {
      warnings.push(
        'No files selected. Project will be created with empty camera folders.'
      )
    }

    // Return success with validation data
    return createStageSuccess<ValidationResultData>(
      {
        projectFolder,
        isValid: true,
        warnings,
        validationErrors: []
      },
      durationMs
    )
  } catch (error) {
    const durationMs = performance.now() - startTime
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during validation'

    return createStageFailure('Validation', message, true, durationMs)
  }
}

// =============================================================================
// XState v5 Actor (fromPromise)
// =============================================================================

/**
 * XState v5 compatible actor for the validation stage.
 *
 * Usage with XState:
 * ```typescript
 * import { setup } from 'xstate'
 * import { validationActor } from './stages/validation'
 *
 * const machine = setup({
 *   actors: {
 *     validateInputs: validationActor
 *   }
 * }).createMachine({
 *   // ...
 *   states: {
 *     validating: {
 *       invoke: {
 *         src: 'validateInputs',
 *         input: ({ context }) => ({
 *           files: context.files,
 *           projectName: context.projectName,
 *           outputPath: context.destinationPath,
 *           numCameras: context.numCameras
 *         }),
 *         onDone: { target: 'nextState' },
 *         onError: { target: 'error' }
 *       }
 *     }
 *   }
 * })
 * ```
 */
export const validationActor = fromPromise<
  StageResult<ValidationResultData>,
  ValidationInput
>(async ({ input }) => {
  const result = await validateInputs(input)

  // If validation failed, throw to trigger onError in XState
  if (!result.ok) {
    throw createValidationError('validation', result.error.message, {
      errors: result.error
    })
  }

  return result
})

// =============================================================================
// Default Stage Configuration
// =============================================================================

/**
 * Default configuration for the validation stage
 */
export const validationStageConfig: StageConfig = {
  name: 'validation',
  displayName: 'Validating Project',
  timeout: 30000, // 30 seconds
  retryable: true,
  maxRetries: 3,
  cancellable: true,
  parallel: false,
  dependsOn: []
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Check if a project name is valid (synchronous check only)
 */
export function isValidProjectName(projectName: string): boolean {
  return validateProjectName(projectName) === null
}

/**
 * Check if camera assignments are valid
 */
export function areValidCameraAssignments(
  files: FileWithCamera[],
  numCameras: number
): boolean {
  return validateCameraAssignments(files, numCameras) === null
}

/**
 * Get invalid camera assignments from a list of files
 */
export function getInvalidCameraAssignments(
  files: FileWithCamera[],
  numCameras: number
): FileWithCamera[] {
  return files.filter((file) => file.camera < 1 || file.camera > numCameras)
}
