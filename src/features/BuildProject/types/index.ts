/**
 * BuildProject Types - Barrel Export
 *
 * Re-exports every type in the BuildProject feature module. Import from here
 * rather than reaching into the individual files.
 *
 * @example
 * import {
 *   StageName,
 *   StageResult,
 *   FileTransferProgress,
 *   BuildProjectError,
 *   ErrorKind
 * } from '../types'
 */

// ============================================================================
// Page + Consumer Data Types
// ============================================================================

export type { FootageFile, VideoInfoData } from './project'

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
  FileTransferItem,
  FileTransferProgress,
  TransferCompleteEvent,
  TransferRequest,
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
