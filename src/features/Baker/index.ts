// Page
export { default as BakerPage } from './BakerPage'

// Hooks (consumed by Trello module)
export {
  generateBreadcrumbsBlock,
  useAppendBreadcrumbs,
  updateTrelloCardWithBreadcrumbs
} from './hooks/useAppendBreadcrumbs'
export { useProjectBreadcrumbs } from './hooks/useProjectBreadcrumbs'
export { useBreadcrumbsReader } from './hooks/useBreadcrumbsReader'
export { useBreadcrumbsVideoLinks } from './hooks/useBreadcrumbsVideoLinks'

// Types (consumed externally)
export type {
  BreadcrumbsFile,
  BreadcrumbsPreview,
  BreadcrumbsDiff,
  BatchUpdateResult,
  FileInfo,
  FieldChange,
  FieldChangeType,
  ProjectFolder,
  ScanError,
  ScanOptions,
  ScanResult,
  ScanPreferences,
  VideoLink,
  TrelloCard
} from './types'
