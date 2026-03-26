/**
 * BuildProject Stages - Barrel Export
 *
 * Re-exports all stage implementations from the build-project feature module.
 * Each stage is a discrete unit of work in the project creation workflow.
 *
 * Stage execution order:
 * 1. validation - Validate inputs before any file operations
 * 2. folders - Create project folder structure
 * 3. template - Copy Premiere Pro template
 * 4. breadcrumbs - Save project metadata
 * 5. file-transfer - Transfer files to camera folders
 *
 * @example
 * import {
 *   validateInputs,
 *   validationActor,
 *   validationStageConfig
 * } from '@/features/build-project/stages'
 */

// =============================================================================
// Validation Stage
// =============================================================================

export {
  // Main validation function
  validateInputs,

  // XState v5 actor
  validationActor,

  // Stage configuration
  validationStageConfig,

  // Utility functions
  isValidProjectName,
  areValidCameraAssignments,
  getInvalidCameraAssignments
} from './validation'

export type {
  // Input types
  FileWithCamera,
  ValidationInput,

  // Result types
  ValidationError,
  ValidationResultData
} from './validation'

// =============================================================================
// Folder Creation Stage
// =============================================================================

export {
  // Main function
  createFolders,

  // XState v5 actor
  createFoldersActor,

  // Stage configuration
  FOLDER_CREATION_CONFIG,

  // Utility functions
  validateFolderCreationInput,
  getExpectedFolderCount,

  // Constants
  PROJECT_SUBFOLDERS
} from './folderCreation'

export type { FolderCreationInput, FolderCreationData } from './folderCreation'

// =============================================================================
// Template Stage
// =============================================================================

export {
  // Main function
  copyTemplate,

  // XState v5 actor
  copyTemplateActor,

  // Stage configuration
  TEMPLATE_STAGE_CONFIG,

  // Utility functions
  isTemplateRetryable,
  getTemplatePath
} from './template'

export type { CopyTemplateInput, TemplateStageOptions } from './template'

// =============================================================================
// Breadcrumbs Stage
// =============================================================================

export {
  // Main function
  saveBreadcrumbs,

  // XState v5 actor
  saveBreadcrumbsActor,

  // Stage configuration
  BREADCRUMBS_STAGE_CONFIG,

  // Retry wrapper
  saveBreadcrumbsWithRetry
} from './breadcrumbs'

export type {
  BreadcrumbsFileData,
  BreadcrumbsJson,
  SaveBreadcrumbsInput,
  SaveBreadcrumbsOptions
} from './breadcrumbs'

// =============================================================================
// File Transfer Stage
// =============================================================================

export {
  // Main functions
  transferFiles,
  startTransfer,
  cancelTransfer,

  // XState v5 actor
  fileTransferActor,

  // Utility functions
  createTransferItems,
  estimateTransferSize,
  formatBytes,
  formatTimeRemaining
} from './fileTransfer'

export type {
  FileTransferItem,
  TransferRequest,
  TransferCompleteEvent,
  TransferFilesOptions,
  TransferOperationHandle,
  FileTransferActorInput
} from './fileTransfer'
