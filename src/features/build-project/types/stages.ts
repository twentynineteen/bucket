/**
 * BuildProject Stage Type Definitions
 *
 * Defines types for the workflow stages in the BuildProject refactor.
 * Each stage represents a distinct phase of the project creation process.
 */

// ============================================================================
// Stage Name Types
// ============================================================================

/**
 * All possible stage names in the BuildProject workflow.
 * Stages execute in this order: validation -> folders -> template -> breadcrumbs -> file-transfer
 */
export type StageName =
  | 'validation'
  | 'folders'
  | 'template'
  | 'breadcrumbs'
  | 'file-transfer'

/**
 * Current execution status of a stage
 */
export type StageStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'

// ============================================================================
// Stage Result Types (Discriminated Union)
// ============================================================================

/**
 * Successful stage result with typed data payload
 */
export interface StageSuccess<T> {
  ok: true
  data: T
  durationMs: number
}

/**
 * Failed stage result with error information
 */
export interface StageFailure {
  ok: false
  error: {
    kind: string
    message: string
    recoverable: boolean
  }
  durationMs: number
}

/**
 * Discriminated union for stage execution results.
 * Use `result.ok` to narrow the type.
 *
 * @example
 * const result: StageResult<string> = await runStage()
 * if (result.ok) {
 *   console.log(result.data) // string
 * } else {
 *   console.error(result.error.message)
 * }
 */
export type StageResult<T> = StageSuccess<T> | StageFailure

// ============================================================================
// Stage Configuration
// ============================================================================

/**
 * Configuration options for stage execution behavior
 */
export interface StageConfig {
  /** Stage identifier */
  name: StageName

  /** Human-readable display name for UI */
  displayName: string

  /** Timeout in milliseconds (0 = no timeout) */
  timeout: number

  /** Whether this stage can be retried on failure */
  retryable: boolean

  /** Maximum retry attempts if retryable */
  maxRetries: number

  /** Whether cancellation is supported during this stage */
  cancellable: boolean

  /** Whether this stage should run in parallel with others */
  parallel: boolean

  /** Dependencies on other stages (must complete before this runs) */
  dependsOn: StageName[]
}

/**
 * Runtime state of a stage during workflow execution
 */
export interface StageState {
  /** Stage configuration */
  config: StageConfig

  /** Current execution status */
  status: StageStatus

  /** Number of retry attempts made */
  retryCount: number

  /** Timestamp when stage started (ISO 8601) */
  startedAt: string | null

  /** Timestamp when stage completed (ISO 8601) */
  completedAt: string | null

  /** Error message if status is 'error' */
  errorMessage: string | null

  /** Progress percentage for stages that support it (0-100) */
  progress: number | null
}

// ============================================================================
// Stage Data Types (per-stage typed results)
// ============================================================================

/**
 * Result data from validation stage
 */
export interface ValidationStageData {
  projectFolder: string
  isValid: boolean
  warnings: string[]
}

/**
 * Result data from folders creation stage
 */
export interface FoldersStageData {
  createdFolders: string[]
  projectRoot: string
}

/**
 * Result data from template stage
 */
export interface TemplateStageData {
  templatePath: string
  templateType: 'premiere' | 'generic'
}

/**
 * Result data from breadcrumbs stage
 */
export interface BreadcrumbsStageData {
  breadcrumbsPath: string
  projectTitle: string
  numberOfCameras: number
}

/**
 * Result data from file-transfer stage
 */
export interface FileTransferStageData {
  filesTransferred: number
  totalBytes: number
  destinationFolder: string
}

/**
 * Map of stage names to their result data types
 */
export interface StageDataMap {
  validation: ValidationStageData
  folders: FoldersStageData
  template: TemplateStageData
  breadcrumbs: BreadcrumbsStageData
  'file-transfer': FileTransferStageData
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default stage configurations for all workflow stages
 */
export const DEFAULT_STAGE_CONFIGS: Record<StageName, StageConfig> = {
  validation: {
    name: 'validation',
    displayName: 'Validating Project',
    timeout: 30000, // 30 seconds
    retryable: true,
    maxRetries: 3,
    cancellable: true,
    parallel: false,
    dependsOn: []
  },
  folders: {
    name: 'folders',
    displayName: 'Creating Folders',
    timeout: 60000, // 1 minute
    retryable: true,
    maxRetries: 2,
    cancellable: true,
    parallel: false,
    dependsOn: ['validation']
  },
  template: {
    name: 'template',
    displayName: 'Creating Template',
    timeout: 120000, // 2 minutes
    retryable: true,
    maxRetries: 2,
    cancellable: false,
    parallel: false,
    dependsOn: ['folders']
  },
  breadcrumbs: {
    name: 'breadcrumbs',
    displayName: 'Saving Breadcrumbs',
    timeout: 30000, // 30 seconds
    retryable: true,
    maxRetries: 3,
    cancellable: false,
    parallel: false,
    dependsOn: ['folders']
  },
  'file-transfer': {
    name: 'file-transfer',
    displayName: 'Transferring Files',
    timeout: 0, // No timeout for file transfer (can take a long time)
    retryable: false, // File transfer should not auto-retry
    maxRetries: 0,
    cancellable: true,
    parallel: false,
    dependsOn: ['breadcrumbs']
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a successful stage result
 */
export function createStageSuccess<T>(data: T, durationMs: number): StageSuccess<T> {
  return {
    ok: true,
    data,
    durationMs
  }
}

/**
 * Create a failed stage result
 */
export function createStageFailure(
  kind: string,
  message: string,
  recoverable: boolean,
  durationMs: number
): StageFailure {
  return {
    ok: false,
    error: { kind, message, recoverable },
    durationMs
  }
}

/**
 * Create initial stage state
 */
export function createInitialStageState(config: StageConfig): StageState {
  return {
    config,
    status: 'idle',
    retryCount: 0,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    progress: null
  }
}
