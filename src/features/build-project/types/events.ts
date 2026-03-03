/**
 * BuildProject Event Type Definitions
 *
 * Defines event types for stage progress, workflow communication,
 * and Tauri event payloads used in the BuildProject feature.
 */

import type { StageName, StageStatus } from './stages'

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

// ============================================================================
// Stage Events (Discriminated Union)
// ============================================================================

/**
 * Event emitted when a stage starts execution
 */
export interface StageStartEvent {
  type: 'stage:start'
  stage: StageName
  timestamp: string
}

/**
 * Event emitted when a stage completes successfully
 */
export interface StageCompleteEvent {
  type: 'stage:complete'
  stage: StageName
  timestamp: string
  durationMs: number
}

/**
 * Event emitted when a stage encounters an error
 */
export interface StageErrorEvent {
  type: 'stage:error'
  stage: StageName
  timestamp: string
  error: {
    kind: string
    message: string
    recoverable: boolean
  }
}

/**
 * Event emitted for stage progress updates
 */
export interface StageProgressEvent {
  type: 'stage:progress'
  stage: StageName
  timestamp: string
  progress: number // 0-100
  message: string
}

/**
 * Event emitted when a stage is cancelled
 */
export interface StageCancelledEvent {
  type: 'stage:cancelled'
  stage: StageName
  timestamp: string
}

/**
 * Event emitted when a stage retry occurs
 */
export interface StageRetryEvent {
  type: 'stage:retry'
  stage: StageName
  timestamp: string
  attempt: number
  maxAttempts: number
  reason: string
}

/**
 * Discriminated union of all stage events.
 * Use `event.type` to narrow the type.
 *
 * @example
 * function handleEvent(event: StageEvent) {
 *   switch (event.type) {
 *     case 'stage:start':
 *       console.log(`Stage ${event.stage} started`)
 *       break
 *     case 'stage:complete':
 *       console.log(`Stage ${event.stage} completed in ${event.durationMs}ms`)
 *       break
 *   }
 * }
 */
export type StageEvent =
  | StageStartEvent
  | StageCompleteEvent
  | StageErrorEvent
  | StageProgressEvent
  | StageCancelledEvent
  | StageRetryEvent

// ============================================================================
// BuildProject Workflow Events
// ============================================================================

/**
 * Event emitted when the entire workflow starts
 */
export interface WorkflowStartEvent {
  type: 'workflow:start'
  timestamp: string
  projectTitle: string
  totalStages: number
}

/**
 * Event emitted when the entire workflow completes successfully
 */
export interface WorkflowCompleteEvent {
  type: 'workflow:complete'
  timestamp: string
  projectFolder: string
  totalDurationMs: number
}

/**
 * Event emitted when the workflow fails
 */
export interface WorkflowErrorEvent {
  type: 'workflow:error'
  timestamp: string
  failedStage: StageName
  error: {
    kind: string
    message: string
    recoverable: boolean
  }
}

/**
 * Event emitted when the workflow is cancelled by user
 */
export interface WorkflowCancelledEvent {
  type: 'workflow:cancelled'
  timestamp: string
  cancelledAtStage: StageName
}

/**
 * Event emitted for overall workflow progress
 */
export interface WorkflowProgressEvent {
  type: 'workflow:progress'
  timestamp: string
  currentStage: StageName
  stagesCompleted: number
  totalStages: number
  overallProgress: number // 0-100
}

/**
 * Event emitted when workflow state changes
 */
export interface WorkflowStateChangeEvent {
  type: 'workflow:state-change'
  timestamp: string
  previousState: string
  currentState: string
  stage: StageName
  stageStatus: StageStatus
}

/**
 * Discriminated union of all workflow events.
 * Use `event.type` to narrow the type.
 */
export type BuildProjectEvent =
  | WorkflowStartEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent
  | WorkflowCancelledEvent
  | WorkflowProgressEvent
  | WorkflowStateChangeEvent
  | StageEvent

// ============================================================================
// Tauri Event Names
// ============================================================================

/**
 * Tauri event channel names for BuildProject feature
 */
export const TAURI_EVENTS = {
  /** File transfer progress updates */
  FILE_TRANSFER_PROGRESS: 'build-project:file-transfer-progress',

  /** Stage lifecycle events */
  STAGE_EVENT: 'build-project:stage-event',

  /** Workflow lifecycle events */
  WORKFLOW_EVENT: 'build-project:workflow-event',

  /** Cancellation request */
  CANCEL_REQUEST: 'build-project:cancel'
} as const

/**
 * Type for Tauri event names
 */
export type TauriEventName = (typeof TAURI_EVENTS)[keyof typeof TAURI_EVENTS]

// ============================================================================
// Event Listener Types
// ============================================================================

/**
 * Handler function for stage events
 */
export type StageEventHandler = (event: StageEvent) => void

/**
 * Handler function for workflow events
 */
export type WorkflowEventHandler = (event: BuildProjectEvent) => void

/**
 * Handler function for file transfer progress
 */
export type FileTransferProgressHandler = (progress: FileTransferProgress) => void

/**
 * Unsubscribe function returned by event listeners
 */
export type UnsubscribeFn = () => void

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Create an ISO timestamp for the current time
 */
function createTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Create a stage start event
 */
export function createStageStartEvent(stage: StageName): StageStartEvent {
  return {
    type: 'stage:start',
    stage,
    timestamp: createTimestamp()
  }
}

/**
 * Create a stage complete event
 */
export function createStageCompleteEvent(
  stage: StageName,
  durationMs: number
): StageCompleteEvent {
  return {
    type: 'stage:complete',
    stage,
    timestamp: createTimestamp(),
    durationMs
  }
}

/**
 * Create a stage error event
 */
export function createStageErrorEvent(
  stage: StageName,
  kind: string,
  message: string,
  recoverable: boolean
): StageErrorEvent {
  return {
    type: 'stage:error',
    stage,
    timestamp: createTimestamp(),
    error: { kind, message, recoverable }
  }
}

/**
 * Create a stage progress event
 */
export function createStageProgressEvent(
  stage: StageName,
  progress: number,
  message: string
): StageProgressEvent {
  return {
    type: 'stage:progress',
    stage,
    timestamp: createTimestamp(),
    progress,
    message
  }
}

/**
 * Create a workflow start event
 */
export function createWorkflowStartEvent(
  projectTitle: string,
  totalStages: number
): WorkflowStartEvent {
  return {
    type: 'workflow:start',
    timestamp: createTimestamp(),
    projectTitle,
    totalStages
  }
}

/**
 * Create a workflow complete event
 */
export function createWorkflowCompleteEvent(
  projectFolder: string,
  totalDurationMs: number
): WorkflowCompleteEvent {
  return {
    type: 'workflow:complete',
    timestamp: createTimestamp(),
    projectFolder,
    totalDurationMs
  }
}
