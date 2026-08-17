/**
 * BuildProject Page + Consumer Types
 *
 * Page-state types and the two shapes other modules import. Workflow types
 * (stages, events, errors) are siblings of this file; the machine's own context
 * types live with the machine.
 *
 * Imported by:
 *   - the page's child components + helper hooks (FootageFile)
 *   - the Trello + Baker modules, via the barrel (VideoInfoData, FootageFile)
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
