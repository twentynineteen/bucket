// Components
/** Page for uploading videos to Sprout Video with progress tracking */
export { default as UploadSprout } from './components/UploadSprout'
/** Page for generating and customizing video poster frames */
export { default as Posterframe } from './components/Posterframe'
/** Page for uploading transcripts to Otter.ai integration */
export { default as UploadOtter } from './components/UploadOtter'
/** Folder tree component for navigating Sprout Video folder hierarchy */
export { default as FolderTreeSprout } from './components/FolderTreeSprout'

// Hooks
/** Hook for managing file upload state, progress, and completion callbacks */
export { useFileUpload } from './hooks/useFileUpload'
/** Hook for listening to Tauri upload progress events with cleanup */
export { useUploadEvents } from './hooks/useUploadEvents'
/** Hook for forcing image cache refresh after posterframe updates */
export { useImageRefresh } from './hooks/useImageRefresh'
/** Hook for Sprout Video API operations -- folder listing, video details, uploads */
export { useSproutVideoApi } from './hooks/useSproutVideoApi'
/** Hook for processing and transforming Sprout Video API responses */
export { useSproutVideoProcessor } from './hooks/useSproutVideoProcessor'
/** Hook for managing the posterframe canvas -- drawing, text overlay, export */
export { usePosterframeCanvas } from './hooks/usePosterframeCanvas'
/** Hook for automatically redrawing the posterframe when inputs change */
export { usePosterframeAutoRedraw } from './hooks/usePosterframeAutoRedraw'
/** Hook for file selection dialog and selected file state management */
export { useFileSelection } from './hooks/useFileSelection'
/** Hook for canvas zoom and pan controls with mouse and keyboard support */
export { useZoomPan } from './hooks/useZoomPan'

// Types (re-export for consumers)
/** Sprout Video upload response with video ID, embed code, and status */
export type { SproutUploadResponse } from './types'
/** Response shape from the Sprout Video folders API endpoint */
export type { GetFoldersResponse } from './types'
/** Sprout Video folder with id, name, and parent hierarchy */
export type { SproutFolder } from './types'
/** Detailed Sprout Video metadata including duration, dimensions, and assets */
export type { SproutVideoDetails } from './types'
