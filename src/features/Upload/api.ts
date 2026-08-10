/**
 * Upload API Layer - Single I/O boundary for the Upload module
 *
 * All external calls (Tauri invoke, events, dialog, fs plugins)
 * are wrapped here. Mock this one file to isolate the entire module.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  exists,
  readDir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile
} from '@tauri-apps/plugin-fs'
import { appDataDir, fontDir } from '@tauri-apps/api/path'

import { isRateLimited } from '@shared/lib'
import type {
  GetFoldersResponse,
  SproutUploadResponse,
  SproutVideoDetails
} from '@shared/types'

import {
  recordBudget,
  recordRateLimited,
  runBrowseRequest
} from './internal/sproutRateBudget'

// --- Tauri Command Wrappers ---

export async function uploadVideo(
  filePath: string,
  apiKey: string,
  folderId: string | null,
  title?: string | null
): Promise<void> {
  return invoke('upload_video', { filePath, apiKey, folderId, title: title ?? null })
}

/** Probe a local MP4/MOV file for its duration in seconds (mvhd metadata) */
export async function getVideoDuration(filePath: string): Promise<number> {
  return invoke<number>('get_video_duration', { filePath })
}

/**
 * Lists the folders directly inside `parentId`, or the root folders for null.
 *
 * The argument key MUST be `parentId`. Tauri camelCases command arguments and
 * does no snake_case fallback, so a snake_case key silently binds the Rust
 * `Option` to `None` -- which is how every folder request returned the account
 * root for so long (#155 §2). `api.contract.test.ts` pins this.
 *
 * Routed through the browse guard: serialised, and refused when the account's
 * request budget is low so an in-flight upload keeps its headroom (#155 R6).
 */
export async function getFolders(
  apiKey: string,
  parentId: string | null
): Promise<GetFoldersResponse> {
  return runBrowseRequest(async () => {
    try {
      const page = await invoke<GetFoldersResponse>('get_folders', {
        apiKey,
        parentId
      })
      recordBudget(page.rate_limit_remaining, page.rate_limit_reset)
      return page
    } catch (error) {
      // A 429 opens a cooloff so queued submenu opens stop before the network.
      if (isRateLimited(error)) recordRateLimited()
      throw error
    }
  })
}

export async function fetchSproutVideoDetails(
  videoId: string,
  apiKey: string
): Promise<SproutVideoDetails> {
  return invoke<SproutVideoDetails>('fetch_sprout_video_details', {
    videoId,
    apiKey
  })
}

export async function openFolder(path: string): Promise<void> {
  return invoke('open_folder', { path })
}

/**
 * Sets a custom poster frame on an existing Sprout video (Issue #140).
 * Rejects with a `PosterFrameError` carrying Sprout's HTTP status.
 */
export async function setSproutPosterFrame(
  videoId: string,
  apiKey: string,
  imageBytes: Uint8Array,
  fileName?: string
): Promise<void> {
  return invoke('set_sprout_poster_frame', {
    videoId,
    apiKey,
    imageBytes: Array.from(imageBytes),
    fileName: fileName ?? null
  })
}

/**
 * Writes a copy of a poster frame into a project's Graphics/ folder,
 * creating the folder if needed and never overwriting an existing file.
 * Resolves with the path that was written.
 */
export async function savePosterFrameCopy(
  projectPath: string,
  fileStem: string,
  imageBytes: Uint8Array
): Promise<string> {
  return invoke<string>('save_poster_frame_copy', {
    projectPath,
    fileStem,
    imageBytes: Array.from(imageBytes)
  })
}

// --- Tauri Event Listener Wrappers ---

export async function listenUploadProgress(
  callback: (event: Event<number>) => void
): Promise<() => void> {
  return listen('upload_progress', callback)
}

export async function listenUploadComplete(
  callback: (event: Event<SproutUploadResponse>) => void
): Promise<() => void> {
  return listen('upload_complete', callback)
}

export async function listenUploadError(
  callback: (event: Event<string>) => void
): Promise<() => void> {
  return listen('upload_error', callback)
}

// --- Dialog Wrappers ---

export async function openFileDialog(options: {
  multiple: boolean
  filters?: Array<{ name: string; extensions: string[] }>
  directory?: boolean
}): Promise<string | string[] | null> {
  return open(options)
}

export async function openFolderDialog(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false })
  if (typeof result === 'string') {
    return result
  }
  return null
}

// --- File System Wrappers ---

export async function saveFile(path: string, data: Uint8Array): Promise<void> {
  await writeFile(path, data)
}

export async function readFileAsBytes(path: string): Promise<Uint8Array> {
  return readFile(path)
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.tiff',
  '.tif'
])

export async function listDirectory(folderPath: string): Promise<string[]> {
  const entries = await readDir(folderPath)
  const imageFiles = entries
    .filter((entry) => {
      const name = entry.name || ''
      const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
      return IMAGE_EXTENSIONS.has(ext)
    })
    .map((entry) => `${folderPath}/${entry.name}`)
    .sort()
  return imageFiles
}

export async function getFontDir(): Promise<string> {
  return fontDir()
}

export async function fileExists(path: string): Promise<boolean> {
  return exists(path)
}

/**
 * Whether the poster frame font (Cabrito.otf) is installed. Without it the
 * canvas renders the background but no title text, so callers gate the
 * poster frame option on this.
 */
export async function posterFrameFontAvailable(): Promise<boolean> {
  const dir = await fontDir()
  return exists(`${dir}/Cabrito.otf`)
}

// --- Saved folder index (issue #155, search) ---

/** File holding the crawled folder index. Rebuildable cache, not user data. */
const FOLDER_INDEX_FILE = 'sprout-folder-index.json'

async function folderIndexPath(): Promise<string> {
  return `${await appDataDir()}${FOLDER_INDEX_FILE}`
}

/**
 * Reads the saved folder index, or null when there is none.
 *
 * Never throws: a missing or corrupt index must fall back to "not indexed yet"
 * rather than break the picker, since the index is only ever a cache.
 */
export async function readFolderIndex(): Promise<unknown | null> {
  try {
    const path = await folderIndexPath()
    if (!(await exists(path))) return null
    return JSON.parse(await readTextFile(path))
  } catch {
    return null
  }
}

/** Writes the folder index. Rejects so the caller can report a failed save. */
export async function writeFolderIndex(index: unknown): Promise<void> {
  const path = await folderIndexPath()
  await writeTextFile(path, JSON.stringify(index))
}

/** Prompts for a location to write an exported index to. Null if cancelled. */
export async function saveFileDialog(defaultPath: string): Promise<string | null> {
  return save({
    defaultPath,
    filters: [{ name: 'Folder index', extensions: ['json'] }]
  })
}

/** Prompts for an exported index to import. Null if cancelled. */
export async function openJsonFileDialog(): Promise<string | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Folder index', extensions: ['json'] }]
  })
  return typeof picked === 'string' ? picked : null
}

/** Writes an index to an arbitrary path chosen by the user. */
export async function writeFolderIndexTo(path: string, index: unknown): Promise<void> {
  await writeTextFile(path, JSON.stringify(index, null, 2))
}

/** Reads an exported index from an arbitrary path. Rejects if unreadable. */
export async function readFolderIndexFrom(path: string): Promise<unknown> {
  return JSON.parse(await readTextFile(path))
}
