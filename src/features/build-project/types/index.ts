/**
 * BuildProject Types - Barrel Export
 *
 * Re-exports all types from the build-project feature module.
 * Import from this file for convenient access to all types.
 *
 * @example
 * import {
 *   StageName,
 *   StageResult,
 *   FileTransferProgress,
 *   BuildProjectError,
 *   ErrorKind
 * } from '@/features/build-project/types'
 */

// ============================================================================
// Stage Types
// ============================================================================

export type {
  StageName,
  StageStatus,
  StageSuccess,
  StageFailure,
  StageResult,
  StageConfig,
  StageState,
  ValidationStageData,
  FoldersStageData,
  TemplateStageData,
  BreadcrumbsStageData,
  FileTransferStageData,
  StageDataMap
} from './stages'

export {
  DEFAULT_STAGE_CONFIGS,
  createStageSuccess,
  createStageFailure,
  createInitialStageState
} from './stages'

// ============================================================================
// Event Types
// ============================================================================

export type {
  FileTransferProgress,
  StageStartEvent,
  StageCompleteEvent,
  StageErrorEvent,
  StageProgressEvent,
  StageCancelledEvent,
  StageRetryEvent,
  StageEvent,
  WorkflowStartEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  WorkflowCancelledEvent,
  WorkflowProgressEvent,
  WorkflowStateChangeEvent,
  BuildProjectEvent,
  TauriEventName,
  StageEventHandler,
  WorkflowEventHandler,
  FileTransferProgressHandler,
  UnsubscribeFn
} from './events'

export {
  TAURI_EVENTS,
  createStageStartEvent,
  createStageCompleteEvent,
  createStageErrorEvent,
  createStageProgressEvent,
  createWorkflowStartEvent,
  createWorkflowCompleteEvent
} from './events'

// ============================================================================
// Error Types
// ============================================================================

export type { StageError } from './errors'

export {
  ErrorKind,
  BuildProjectError,
  isBuildProjectError,
  isStageError,
  isRecoverableError,
  createValidationError,
  createIOError,
  createPermissionError,
  createTimeoutError,
  createCancellationError,
  createAlreadyExistsError,
  createNotFoundError,
  getUserFriendlyErrorMessage,
  getErrorKindDisplayName
} from './errors'
