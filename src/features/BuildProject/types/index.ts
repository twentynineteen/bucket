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
  StageResult,
  StageConfig,
  ValidationStageData,
  FoldersStageData,
  TemplateStageData,
  BreadcrumbsStageData,
  FileTransferStageData
} from './stages'

export { DEFAULT_STAGE_CONFIGS, createStageSuccess, createStageFailure } from './stages'

// ============================================================================
// Event Types
// ============================================================================

export type {
  FileTransferItem,
  FileTransferProgress,
  TransferCompleteEvent,
  TransferRequest,
  FileTransferProgressHandler
} from './events'

// ============================================================================
// Error Types
// ============================================================================

export { ErrorKind, BuildProjectError } from './errors'
