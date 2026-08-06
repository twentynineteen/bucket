/**
 * Upload API Layer - Single I/O boundary for the Upload module
 *
 * All external calls (Tauri invoke, events, dialog, fs plugins)
 * are wrapped here. Mock this one file to isolate the entire module.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { exists, readDir, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { fontDir } from '@tauri-apps/api/path'

import type {
  GetFoldersResponse,
  SproutUploadResponse,
  SproutVideoDetails
} from '@shared/types'

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

export async function getFolders(
  apiKey: string,
  parentId: string | null
): Promise<GetFoldersResponse> {
  return invoke<GetFoldersResponse>('get_folders', {
    apiKey,
    parent_id: parentId
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
