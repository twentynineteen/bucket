/**
 * BuildProject API Layer
 *
 * Single I/O boundary wrapping ALL external calls for the BuildProject module.
 * All hooks and components must use these wrappers instead of direct
 * plugin imports (invoke, listen, dialog, fs).
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { confirm, open } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs'

import type { CopyCompleteWithErrors, CopyFileError } from './types'

// --- Tauri Commands ---

export async function moveFiles(
  files: [string, number][],
  baseDest: string
): Promise<void> {
  return invoke('move_files', { files, baseDest })
}

export async function getFolderSize(folderPath: string): Promise<number> {
  return invoke<number>('get_folder_size', { folderPath })
}

export async function copyPremiereProject(
  destinationFolder: string,
  newTitle: string
): Promise<void> {
  return invoke('copy_premiere_project', { destinationFolder, newTitle })
}

export async function showConfirmationDialog(
  message: string,
  title: string,
  destination: string
): Promise<void> {
  return invoke('show_confirmation_dialog', { message, title, destination })
}

// --- Event Listeners ---

export async function listenCopyProgress(
  callback: (event: Event<number>) => void
): Promise<() => void> {
  return listen('copy_progress', callback)
}

export async function listenCopyComplete(
  callback: (event: Event<string[]>) => void
): Promise<() => void> {
  return listen('copy_complete', callback)
}

export async function listenCopyFileError(
  callback: (event: Event<CopyFileError>) => void
): Promise<() => void> {
  return listen('copy_file_error', callback)
}

export async function listenCopyCompleteWithErrors(
  callback: (event: Event<CopyCompleteWithErrors>) => void
): Promise<() => void> {
  return listen('copy_complete_with_errors', callback)
}

// --- Dialog ---

export async function openFileDialog(): Promise<string | string[] | null> {
  return open({
    multiple: true,
    defaultPath: '/Volumes',
    filters: [
      { name: 'Videos', extensions: ['braw', 'mp4', 'mov', 'mxf'] },
      { name: 'Images', extensions: ['jpeg', 'jpg', 'png', 'gif'] }
    ]
  })
}

export async function confirmDialog(message: string): Promise<boolean> {
  return confirm(message)
}

// --- File System ---

export async function createDirectory(
  path: string,
  options?: { recursive?: boolean }
): Promise<void> {
  return mkdir(path, options)
}

export async function pathExists(path: string): Promise<boolean> {
  return exists(path)
}

export async function removePath(
  path: string,
  options?: { recursive?: boolean }
): Promise<void> {
  return remove(path, options)
}

export async function writeTextFileContents(
  path: string,
  content: string
): Promise<void> {
  return writeTextFile(path, content)
}
