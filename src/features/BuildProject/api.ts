/**
 * BuildProject API Layer
 *
 * Single I/O boundary wrapping the external calls still consumed by the
 * BuildProject page and its remaining helper hooks. The file-transfer
 * pipeline now lives in `@features/build-project` (see
 * `src/features/build-project/stages/fileTransfer.ts`), which calls the
 * throttled `transfer_files_with_progress` Tauri command directly — the
 * legacy `move_files` + `copy_*` event wrappers were removed alongside the
 * Rust command in Phase 5.
 *
 * All hooks and components in this module must use these wrappers instead of
 * direct plugin imports (invoke, dialog, fs).
 */

import { invoke } from '@tauri-apps/api/core'
import { confirm, open } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs'

// --- Tauri Commands ---

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

export async function openFolderDialog(): Promise<string | null> {
  const result = await open({ directory: true })
  return result as string | null
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

export async function writeTextFileContents(
  path: string,
  content: string
): Promise<void> {
  return writeTextFile(path, content)
}
