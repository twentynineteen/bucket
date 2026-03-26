/**
 * BuildProject Module Types
 *
 * Shared types extracted from machine and hooks to avoid circular imports.
 * All files within the module import types from here.
 */

// --- Core Data Types ---

export interface FootageFile {
  file: {
    path: string
    name: string
  }
  camera: number
}

// --- State Machine Types ---

export interface BuildProjectContext {
  title: string
  numCameras: number
  files: FootageFile[]
  selectedFolder: string
  username: string
  copyProgress: number
  projectFolder: string | null
  error: string | null
}

export type BuildProjectEvent =
  | { type: 'START_PROJECT' }
  | { type: 'VALIDATION_SUCCESS'; projectFolder: string }
  | { type: 'VALIDATION_ERROR'; error: string }
  | { type: 'FOLDERS_CREATED' }
  | { type: 'FOLDERS_ERROR'; error: string }
  | { type: 'BREADCRUMBS_SAVED' }
  | { type: 'BREADCRUMBS_ERROR'; error: string }
  | { type: 'FILES_MOVING' }
  | { type: 'COPY_PROGRESS'; progress: number }
  | { type: 'COPY_COMPLETE' }
  | { type: 'COPY_ERROR'; error: string }
  | { type: 'TEMPLATE_COMPLETE' }
  | { type: 'TEMPLATE_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'UPDATE_CONFIG'; config: Partial<BuildProjectContext> }

// --- Event Payload Types ---

export interface CopyFileError {
  file: string
  error: string
}

export interface CopyCompleteWithErrors {
  successful_files: string[]
  failed_files: CopyFileError[]
  failure_count: number
  success_count: number
  total_files: number
}

// --- Hook Result Types ---

export interface ValidationResult {
  isValid: boolean
  error?: string
  userCancelled?: boolean
  trimmedTitle?: string
  projectFolder?: string
  folderExists?: boolean
}

export interface FolderCreationResult {
  success: boolean
  error?: string
}

export interface MoveFilesResult {
  success: boolean
  unlisten?: () => void
  error?: string
}

export interface VideoInfoData {
  title: string
  duration: string
  uploaded: string
  thumbnail?: string
  url: string
}
