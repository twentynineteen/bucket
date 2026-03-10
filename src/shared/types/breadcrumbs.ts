/**
 * Breadcrumbs Domain Types
 *
 * Core types for breadcrumbs file comparison, diffing, and preview generation.
 * Used by both @features/Baker and @shared/utils/breadcrumbs.
 */

import type { TrelloCard, VideoLink } from './media'

export interface FileInfo {
  camera: number
  name: string
  path: string
}

export interface BreadcrumbsFile {
  projectTitle: string
  numberOfCameras: number
  files: FileInfo[]
  parentFolder: string
  createdBy: string
  creationDateTime: string
  folderSizeBytes?: number
  lastModified?: string
  scannedBy?: string

  // === DEPRECATED FIELD (keep for backward compatibility) ===
  trelloCardUrl?: string

  // === NEW FIELDS (Phase 004) ===
  /** Array of video links associated with this project */
  videoLinks?: VideoLink[]

  /** Array of Trello cards associated with this project */
  trelloCards?: TrelloCard[]
}

export type FieldChangeType = 'added' | 'modified' | 'removed' | 'unchanged'

export interface FieldChange {
  type: FieldChangeType
  field: string
  oldValue?: unknown
  newValue?: unknown
}

export interface BreadcrumbsDiff {
  hasChanges: boolean
  changes: FieldChange[]
  summary: {
    added: number
    modified: number
    removed: number
    unchanged: number
  }
}

export interface DetailedFieldChange extends FieldChange {
  fieldDisplayName: string
  formattedOldValue: string
  formattedNewValue: string
  category: 'content' | 'metadata' | 'maintenance'
  impact: 'high' | 'medium' | 'low'
}

export interface ProjectChangeDetail {
  projectPath: string
  projectName: string
  hasChanges: boolean
  changeCategories: {
    content: DetailedFieldChange[]
    metadata: DetailedFieldChange[]
    maintenance: DetailedFieldChange[]
  }
  summary: {
    contentChanges: number
    metadataChanges: number
    maintenanceChanges: number
    totalChanges: number
  }
}

export interface BreadcrumbsPreview {
  current: BreadcrumbsFile | null
  updated: BreadcrumbsFile
  diff: BreadcrumbsDiff
  meaningfulDiff?: BreadcrumbsDiff
  detailedChanges?: ProjectChangeDetail
}
