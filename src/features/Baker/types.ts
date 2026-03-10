/**
 * Baker Feature - TypeScript Type Definitions
 *
 * This file defines the TypeScript interfaces for the Baker folder scanning
 * and breadcrumbs management functionality.
 */

// Import and re-export media types for convenience
import type { TrelloCard, VideoLink } from '@shared/types/media'

export type { VideoLink, TrelloCard }

// Import breadcrumbs types for local use (BreadcrumbsViewerProps)
import type {
  BreadcrumbsFile,
  BreadcrumbsPreview
} from '@shared/types/breadcrumbs'

// Re-export breadcrumbs domain types from shared (canonical source)
export type {
  BreadcrumbsFile,
  FileInfo,
  FieldChangeType,
  FieldChange,
  BreadcrumbsDiff,
  DetailedFieldChange,
  ProjectChangeDetail,
  BreadcrumbsPreview
} from '@shared/types/breadcrumbs'

export interface ProjectFolder {
  path: string
  name: string
  isValid: boolean
  hasBreadcrumbs: boolean
  staleBreadcrumbs: boolean // true if breadcrumbs file differs from actual folder content
  invalidBreadcrumbs: boolean // true if breadcrumbs file exists but is corrupted/unparseable
  lastScanned: string // ISO timestamp
  cameraCount: number
  validationErrors: string[]
}

export interface ScanResult {
  startTime: string // ISO timestamp
  endTime?: string // ISO timestamp
  rootPath: string
  totalFolders: number
  validProjects: number
  updatedBreadcrumbs: number
  createdBreadcrumbs: number
  totalFolderSize: number // Total size in bytes of all scanned folders
  errors: ScanError[]
  projects: ProjectFolder[]
}

export interface ScanError {
  path: string
  type: 'permission' | 'structure' | 'filesystem' | 'corruption'
  message: string
  timestamp: string
}

export interface ScanOptions {
  maxDepth: number
  includeHidden: boolean
  createMissing: boolean
  backupOriginals: boolean
}

export interface ScanPreferences {
  autoUpdate: boolean
  createMissing: boolean
  backupOriginals: boolean
  maxDepth: number
  includeHidden: boolean
  confirmBulkOperations: boolean
}

export interface BatchUpdateResult {
  successful: string[] // Paths where update succeeded
  failed: Array<{
    path: string
    error: string
  }>
  created: string[] // Paths where new breadcrumbs were created
  updated: string[] // Paths where existing breadcrumbs were updated
}

// Event payload interfaces for Tauri events
export interface ScanProgressEvent {
  scanId: string
  foldersScanned: number
  totalFolders: number
  currentPath: string
  projectsFound: number
}

export interface ScanDiscoveryEvent {
  scanId: string
  projectPath: string
  isValid: boolean
  errors: string[]
}

export interface ScanCompleteEvent {
  scanId: string
  result: ScanResult
}

export interface ScanErrorEvent {
  scanId: string
  error: ScanError
}

// Component prop interfaces - using type alias instead of empty interface
export type BakerPageProps = Record<string, never>

export interface FolderSelectorProps {
  selectedFolder: string
  onSelect: (folderPath: string) => void
  disabled?: boolean
}

export interface ScanProgressProps {
  scanResult: ScanResult | null
  isScanning: boolean
}

export interface ProjectResultsProps {
  projects: ProjectFolder[]
  selectedProjects: string[]
  onSelectionChange: (selectedPaths: string[]) => void
  onPreviewBreadcrumbs: (projectPath: string) => void
}

export interface BatchActionsProps {
  selectedProjects: string[]
  onApplyChanges: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  disabled?: boolean
}

// Hook return type interfaces
export interface UseBakerScanResult {
  // State
  scanResult: ScanResult | null
  isScanning: boolean
  error: string | null

  // Actions
  startScan: (rootPath: string, options: ScanOptions) => Promise<void>
  cancelScan: () => void

  // Cleanup
  clearResults: () => void
}

export interface UseBreadcrumbsManagerResult {
  // Actions
  updateBreadcrumbs: (
    projectPaths: string[],
    options: {
      createMissing: boolean
      backupOriginals: boolean
    }
  ) => Promise<BatchUpdateResult>
  clearResults: () => void

  // State
  isUpdating: boolean
  lastUpdateResult: BatchUpdateResult | null
  error: string | null
}

export interface UseBakerPreferencesResult {
  // State
  preferences: ScanPreferences

  // Actions
  updatePreferences: (newPrefs: Partial<ScanPreferences>) => void
  resetToDefaults: () => void
}

export interface BreadcrumbsViewerProps {
  breadcrumbs: BreadcrumbsFile
  projectPath: string
  previewMode?: boolean
  preview?: BreadcrumbsPreview
  onTogglePreview?: () => void
  trelloApiKey?: string
  trelloApiToken?: string
}
