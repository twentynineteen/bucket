/**
 * Template Stage Module
 *
 * Handles copying the Adobe Premiere Pro project template to the project folder.
 * This stage is executed after folder creation and before breadcrumbs generation.
 *
 * The template copy operation:
 * 1. Invokes the Tauri backend `copy_premiere_project` command
 * 2. Backend reads the bundled template from resources
 * 3. Writes to Projects/ folder with sync_all() for file integrity
 * 4. Returns the path to the created template file
 */

import { invoke } from '@tauri-apps/api/core'
import { fromPromise } from 'xstate'

import {
  BuildProjectError,
  createStageFailure,
  createStageSuccess,
  DEFAULT_STAGE_CONFIGS,
  ErrorKind,
  type StageConfig,
  type StageResult,
  type TemplateStageData
} from '../types'

// =============================================================================
// Types
// =============================================================================

/**
 * Input parameters for the template copy operation
 */
export interface CopyTemplateInput {
  /** Path to the project root folder (e.g., /Volumes/Drive/MyProject) */
  projectFolder: string

  /** Project title used as the template filename (e.g., "MyProject.prproj") */
  projectTitle: string
}

/**
 * Options for configuring template stage behavior
 */
export interface TemplateStageOptions {
  /** Custom stage configuration (uses defaults if not provided) */
  config?: Partial<StageConfig>

  /** Callback for progress updates (0-100) */
  onProgress?: (progress: number) => void
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default configuration for the template stage
 */
export const TEMPLATE_STAGE_CONFIG: StageConfig = DEFAULT_STAGE_CONFIGS.template

/**
 * Template file extension
 */
const PREMIERE_EXTENSION = '.prproj'

// =============================================================================
// Error Helpers
// =============================================================================

/**
 * Parse Tauri backend error and convert to BuildProjectError
 */
function parseBackendError(error: unknown): BuildProjectError {
  const errorMessage = String(error)

  // Check for common error patterns from the Rust backend
  if (errorMessage.includes('File not found')) {
    return new BuildProjectError(
      ErrorKind.NotFound,
      'template',
      'Premiere Pro template file not found. Please reinstall the application.',
      false,
      {
        code: 'TEMPLATE_NOT_FOUND',
        context: { originalError: errorMessage }
      }
    )
  }

  if (errorMessage.includes('already exists')) {
    return new BuildProjectError(
      ErrorKind.AlreadyExists,
      'template',
      errorMessage,
      true, // User can choose to overwrite
      {
        code: 'TEMPLATE_EXISTS',
        context: { originalError: errorMessage }
      }
    )
  }

  if (
    errorMessage.includes('Permission denied') ||
    errorMessage.includes('PermissionDenied')
  ) {
    return new BuildProjectError(
      ErrorKind.Permission,
      'template',
      'Permission denied when copying template. Check folder permissions.',
      false,
      {
        code: 'TEMPLATE_PERMISSION_DENIED',
        context: { originalError: errorMessage }
      }
    )
  }

  if (
    errorMessage.includes('Failed to write') ||
    errorMessage.includes('Failed to create')
  ) {
    return new BuildProjectError(
      ErrorKind.IO,
      'template',
      'Failed to write template file. Check disk space and permissions.',
      true,
      {
        code: 'TEMPLATE_WRITE_FAILED',
        context: { originalError: errorMessage }
      }
    )
  }

  if (errorMessage.includes('Failed to sync')) {
    return new BuildProjectError(
      ErrorKind.IO,
      'template',
      'Failed to sync template to disk. The file may be corrupted.',
      true,
      {
        code: 'TEMPLATE_SYNC_FAILED',
        context: { originalError: errorMessage }
      }
    )
  }

  if (errorMessage.includes('Resource directory not available')) {
    return new BuildProjectError(
      ErrorKind.NotFound,
      'template',
      'Application resources not found. Please reinstall the application.',
      false,
      {
        code: 'RESOURCES_NOT_FOUND',
        context: { originalError: errorMessage }
      }
    )
  }

  // Default to unknown error
  return new BuildProjectError(
    ErrorKind.Unknown,
    'template',
    `Template copy failed: ${errorMessage}`,
    true,
    {
      code: 'TEMPLATE_COPY_FAILED',
      context: { originalError: errorMessage }
    }
  )
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Copy Adobe Premiere Pro template to the project's Projects/ folder.
 *
 * This function invokes the Tauri backend `copy_premiere_project` command,
 * which handles:
 * - Reading the bundled template from the app resources
 * - Writing to the destination with the project title as filename
 * - Calling sync_all() to ensure file integrity (prevents corruption)
 *
 * @param input - Template copy input parameters
 * @param options - Optional configuration and callbacks
 * @returns StageResult containing template path on success, error info on failure
 *
 * @example
 * const result = await copyTemplate({
 *   projectFolder: '/Volumes/Drive/MyProject',
 *   projectTitle: 'My Video Project'
 * })
 *
 * if (result.ok) {
 *   console.log(`Template created at: ${result.data.templatePath}`)
 * } else {
 *   console.error(`Failed: ${result.error.message}`)
 * }
 */
export async function copyTemplate(
  input: CopyTemplateInput,
  options?: TemplateStageOptions
): Promise<StageResult<TemplateStageData>> {
  const startTime = performance.now()

  const { projectFolder, projectTitle } = input
  const config = { ...TEMPLATE_STAGE_CONFIG, ...options?.config }

  // Validate inputs
  if (!projectFolder?.trim()) {
    return createStageFailure(
      ErrorKind.Validation,
      'Project folder path is required',
      false,
      performance.now() - startTime
    )
  }

  if (!projectTitle?.trim()) {
    return createStageFailure(
      ErrorKind.Validation,
      'Project title is required',
      false,
      performance.now() - startTime
    )
  }

  // Construct destination folder path (Projects/ subfolder)
  const destinationFolder = `${projectFolder}/Projects/`
  const templatePath = `${destinationFolder}${projectTitle.trim()}${PREMIERE_EXTENSION}`

  // Report initial progress
  options?.onProgress?.(10)

  try {
    // Create a promise that wraps the invoke call with optional timeout
    const invokePromise = invoke('copy_premiere_project', {
      destinationFolder,
      newTitle: projectTitle.trim()
    })

    // Apply timeout if configured
    if (config.timeout > 0) {
      await Promise.race([
        invokePromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Template copy timed out after ${config.timeout}ms`)),
            config.timeout
          )
        )
      ])
    } else {
      await invokePromise
    }

    // Report completion progress
    options?.onProgress?.(100)

    const durationMs = performance.now() - startTime

    // Return successful result with template data
    return createStageSuccess<TemplateStageData>(
      {
        templatePath,
        templateType: 'premiere'
      },
      durationMs
    )
  } catch (error) {
    const durationMs = performance.now() - startTime

    // Check for timeout error
    if (error instanceof Error && error.message.includes('timed out')) {
      return createStageFailure(
        ErrorKind.Timeout,
        `Template copy operation timed out after ${config.timeout}ms`,
        true, // Timeout errors are retryable
        durationMs
      )
    }

    // Parse backend error into appropriate type
    const buildError = parseBackendError(error)

    return createStageFailure(
      buildError.kind,
      buildError.message,
      buildError.recoverable,
      durationMs
    )
  }
}

// =============================================================================
// XState v5 Actor
// =============================================================================

/**
 * XState v5 fromPromise actor for the template copy stage.
 *
 * Compatible with XState v5's actor pattern and can be used directly
 * in state machine definitions with proper type inference.
 *
 * @example
 * // In a state machine setup:
 * import { setup } from 'xstate'
 * import { copyTemplateActor } from './stages/template'
 *
 * const machine = setup({
 *   actors: {
 *     copyTemplate: copyTemplateActor
 *   }
 * }).createMachine({
 *   // ...
 *   states: {
 *     copyingTemplate: {
 *       invoke: {
 *         src: 'copyTemplate',
 *         input: ({ context }) => ({
 *           projectFolder: context.projectFolder,
 *           projectTitle: context.projectName
 *         }),
 *         onDone: { target: 'nextState' },
 *         onError: { target: 'error' }
 *       }
 *     }
 *   }
 * })
 */
export const copyTemplateActor = fromPromise<TemplateStageData, CopyTemplateInput>(
  async ({ input }) => {
    const result = await copyTemplate(input)

    if (result.ok) {
      return result.data
    }

    // Throw error for XState to catch in onError
    // Result is StageFailure at this point (ok === false)
    const { error } = result as {
      error: { kind: string; message: string; recoverable: boolean }
    }
    throw new BuildProjectError(
      error.kind as ErrorKind,
      'template',
      error.message,
      error.recoverable
    )
  }
)

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a template operation can be retried based on the error
 */
export function isTemplateRetryable(error: unknown): boolean {
  if (error instanceof BuildProjectError) {
    return error.recoverable
  }

  const errorMessage = String(error)

  // These errors are generally retryable
  const retryablePatterns = [
    'timed out',
    'Failed to write',
    'Failed to sync',
    'already exists' // User can choose to overwrite
  ]

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern))
}

/**
 * Get the expected template path for a project
 */
export function getTemplatePath(projectFolder: string, projectTitle: string): string {
  return `${projectFolder}/Projects/${projectTitle.trim()}${PREMIERE_EXTENSION}`
}
