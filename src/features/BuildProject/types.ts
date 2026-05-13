/**
 * BuildProject Module Types
 *
 * Page-state and downstream-consumer types. The XState machine, file-transfer
 * payloads, and stage-error types now live in `@features/build-project`. The
 * types that remain here are the ones still imported by:
 *   - the legacy page's child components + helper hooks (FootageFile)
 *   - the Trello + Baker modules (VideoInfoData)
 */

// --- Core Data Types ---

export interface FootageFile {
  file: {
    path: string
    name: string
  }
  camera: number
}

export interface VideoInfoData {
  title: string
  duration: string
  uploaded: string
  thumbnail?: string
  url: string
}
