/**
 * Baker API Layer
 *
 * Single I/O boundary wrapping ALL external calls for the Baker module.
 * All hooks and components must use these wrappers instead of direct
 * plugin imports (invoke, listen, dialog, shell, opener, fs).
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { ask, confirm, open as openDialog } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'
import { open as openShell } from '@tauri-apps/plugin-shell'

import type {
  BatchUpdateResult,
  BreadcrumbsFile,
  FileInfo,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanOptions,
  ScanProgressEvent,
  VideoLink
} from './types'

// --- Tauri Commands ---

export async function bakerStartScan(
  rootPath: string,
  options: ScanOptions
): Promise<string> {
  return invoke<string>('baker_start_scan', { rootPath, options })
}

export async function bakerCancelScan(scanId: string): Promise<void> {
  return invoke('baker_cancel_scan', { scanId })
}

export async function bakerReadBreadcrumbs(
  projectPath: string
): Promise<BreadcrumbsFile | null> {
  return invoke<BreadcrumbsFile | null>('baker_read_breadcrumbs', {
    projectPath
  })
}

export async function bakerReadRawBreadcrumbs(
  projectPath: string
): Promise<string | null> {
  return invoke<string | null>('baker_read_raw_breadcrumbs', { projectPath })
}

export async function bakerScanCurrentFiles(projectPath: string): Promise<FileInfo[]> {
  return invoke<FileInfo[]>('baker_scan_current_files', { projectPath })
}

export async function bakerUpdateBreadcrumbs(
  projectPaths: string[],
  createMissing: boolean,
  backupOriginals: boolean
): Promise<BatchUpdateResult> {
  return invoke<BatchUpdateResult>('baker_update_breadcrumbs', {
    projectPaths,
    createMissing,
    backupOriginals
  })
}

export async function bakerGetVideoLinks(projectPath: string): Promise<VideoLink[]> {
  return invoke<VideoLink[]>('baker_get_video_links', { projectPath })
}

export async function bakerAssociateVideoLink(
  projectPath: string,
  videoLink: VideoLink
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_associate_video_link', {
    projectPath,
    videoLink
  })
}

export async function bakerRemoveVideoLink(
  projectPath: string,
  videoIndex: number
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_remove_video_link', {
    projectPath,
    videoIndex
  })
}

export async function bakerUpdateVideoLink(
  projectPath: string,
  videoIndex: number,
  updatedLink: VideoLink
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_update_video_link', {
    projectPath,
    videoIndex,
    updatedLink
  })
}

export async function bakerReorderVideoLinks(
  projectPath: string,
  fromIndex: number,
  toIndex: number
): Promise<BreadcrumbsFile> {
  return invoke<BreadcrumbsFile>('baker_reorder_video_links', {
    projectPath,
    fromIndex,
    toIndex
  })
}

export async function getFolderSize(folderPath: string): Promise<number> {
  return invoke<number>('get_folder_size', { folderPath })
}

// --- Event Listeners ---

export async function listenScanProgress(
  callback: (event: Event<ScanProgressEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_progress', callback)
}

export async function listenScanComplete(
  callback: (event: Event<ScanCompleteEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_complete', callback)
}

export async function listenScanError(
  callback: (event: Event<ScanErrorEvent>) => void
): Promise<() => void> {
  return listen('baker_scan_error', callback)
}

// --- Dialog ---

export async function openFolderDialog(title: string): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title
  })
  return typeof selected === 'string' ? selected : null
}

export async function openJsonFileDialog(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  return typeof selected === 'string' ? selected : null
}

export async function askDialog(
  message: string,
  options?: { title?: string; okLabel?: string; cancelLabel?: string }
): Promise<boolean> {
  return ask(message, options)
}

export async function confirmDialog(
  message: string,
  options?: { title?: string; okLabel?: string; cancelLabel?: string }
): Promise<boolean> {
  return confirm(message, options)
}

// --- Shell / Opener ---

export async function openInShell(path: string): Promise<void> {
  return openShell(path)
}

export async function openExternalUrl(url: string): Promise<void> {
  return openUrl(url)
}

// --- File System ---

export async function readTextFileContents(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeTextFileContents(
  path: string,
  content: string
): Promise<void> {
  return writeTextFile(path, content)
}

// --- External API (Trello REST) ---

export async function updateTrelloCardDesc(
  cardId: string,
  desc: string,
  apiKey: string,
  token: string
): Promise<Response> {
  return fetch(`https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desc })
  })
}

export async function addTrelloCardComment(
  cardId: string,
  text: string,
  apiKey: string,
  token: string
): Promise<Response> {
  return fetch(
    `https://api.trello.com/1/cards/${cardId}/actions/comments?key=${apiKey}&token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }
  )
}
