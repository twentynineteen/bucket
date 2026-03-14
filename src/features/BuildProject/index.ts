/** Main page for the BuildProject workflow -- file selection, camera assignment, project creation */
export { default as BuildProjectPage } from './BuildProjectPage'
/** Hook for reading and caching video metadata blocks from project breadcrumbs */
export { useVideoInfoBlock } from './hooks/useVideoInfoBlock'
/** Video metadata and footage file types used across project workflows */
export type { VideoInfoData, FootageFile } from './types'
