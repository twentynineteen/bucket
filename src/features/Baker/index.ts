// Page
/** Main page for the Baker workflow -- drive scanning and breadcrumbs batch management */
export { default as BakerPage } from './BakerPage'

// Hooks (consumed by Trello module)
/** Utility for generating breadcrumbs JSON block from project metadata */
export { generateBreadcrumbsBlock } from './hooks/useAppendBreadcrumbs'
/** Hook for appending breadcrumbs data to project folders with validation */
export { useAppendBreadcrumbs } from './hooks/useAppendBreadcrumbs'
/** Utility for updating a Trello card description with breadcrumbs content */
export { updateTrelloCardWithBreadcrumbs } from './hooks/useAppendBreadcrumbs'
/** Hook for reading and watching project breadcrumbs with auto-refresh */
export { useProjectBreadcrumbs } from './hooks/useProjectBreadcrumbs'
/** Hook for reading raw breadcrumbs.json file content from a project path */
export { useBreadcrumbsReader } from './hooks/useBreadcrumbsReader'
/** Hook for extracting video link arrays from project breadcrumbs data */
export { useBreadcrumbsVideoLinks } from './hooks/useBreadcrumbsVideoLinks'

// Video-link orchestration hooks (moved from Trello in #308)
/** Hook for managing video links on a project -- add, upload, remove, reorder, poster frame, replace */
export { useVideoLinksManager } from './hooks/useVideoLinksManager'
/** Hook for setting a branded poster frame on an already-linked video */
export { useCardPosterFrame } from './hooks/useCardPosterFrame'
/** Hook for the replace-video flow -- Sprout transfer, poster frame, breadcrumbs, Trello comment */
export { useReplaceVideo } from './hooks/useReplaceVideo'
/** Poster frame choice for a replace: keep the current frame or set a new one */
export type { PosterMode } from './hooks/useReplaceVideo'
/** Props for the ReplaceVideoDialog, returned directly by useReplaceVideo */
export type { ReplaceVideoDialogProps } from './hooks/useReplaceVideo'
/** Upload state sub-props for ReplaceVideoDialog */
export type { ReplaceVideoUploadState } from './hooks/useReplaceVideo'
/** Trello comment state sub-props for ReplaceVideoDialog */
export type { ReplaceVideoTrelloState } from './hooks/useReplaceVideo'

// Types (consumed externally)
/** Parsed breadcrumbs.json file with all project metadata fields */
export type { BreadcrumbsFile } from './types'
/** Preview of pending breadcrumbs changes before applying */
export type { BreadcrumbsPreview } from './types'
/** Diff result comparing old and new breadcrumbs values */
export type { BreadcrumbsDiff } from './types'
/** Result of a batch breadcrumbs update operation across multiple folders */
export type { BatchUpdateResult } from './types'
/** File metadata with name, path, size, and modification date */
export type { FileInfo } from './types'
/** Single field-level change in a breadcrumbs diff */
export type { FieldChange } from './types'
/** Type of change for a breadcrumbs field -- added, removed, or modified */
export type { FieldChangeType } from './types'
/** Project folder discovered during drive scanning with validation status */
export type { ProjectFolder } from './types'
/** Error encountered during drive scanning with path and message */
export type { ScanError } from './types'
/** Options for configuring drive scan behavior -- depth, filters, patterns */
export type { ScanOptions } from './types'
/** Complete drive scan result with folders, errors, and statistics */
export type { ScanResult } from './types'
/** User preferences for scan behavior persisted across sessions */
export type { ScanPreferences } from './types'
/** Video link data structure with URL, title, and thumbnail */
export type { VideoLink } from './types'
/** Trello card reference stored in breadcrumbs with card ID and URL */
export type { TrelloCard } from './types'
/** Props for the BreadcrumbsViewer component with project path and display options */
export type { BreadcrumbsViewerProps } from './types'
/** Detailed field-level change with old/new values for breadcrumbs comparison */
export type { DetailedFieldChange } from './types'
/** Complete project change detail combining path, status, and field-level changes */
export type { ProjectChangeDetail } from './types'
