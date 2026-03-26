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
  folderId: string | null
): Promise<void> {
  return invoke('upload_video', { filePath, apiKey, folderId })
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
