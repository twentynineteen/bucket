/**
 * BuildProject API Layer
 *
 * Single I/O boundary for the whole feature: the page, its helper hooks, the
 * XState machine in `machine/`, and the stage functions in `stages/` all reach
 * Tauri exclusively through these wrappers. Nothing else in the module may
 * import `@tauri-apps` — `src/shared/lib/__contracts__/feature-api-boundary.contract.test.ts`
 * enforces that for every feature module, this one included (#208).
 *
 * The throttled `transfer_files_with_progress` command replaced the legacy
 * un-throttled move command and its copy-progress events, all deleted alongside
 * the Rust command in Phase 5. Do not reintroduce wrappers for them - the
 * contract test names them and fails if they reappear anywhere in the module.
 */

import { invoke } from '@tauri-apps/api/core'
import { confirm, open } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { listen } from '@tauri-apps/api/event'

import type {
  FileTransferProgress,
  TransferCompleteEvent,
  TransferRequest
} from './types'

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

/**
 * Starts a throttled, cancellable file transfer in the Rust backend.
 * Resolves with the operation id used to correlate progress and completion
 * events, not with the transfer result — the caller awaits the events.
 */
export async function transferFilesWithProgress(
  request: TransferRequest
): Promise<string> {
  return invoke<string>('transfer_files_with_progress', { request })
}

/**
 * Signals cancellation of an in-flight transfer.
 * Resolves false when the backend has no such operation.
 */
export async function cancelFileTransfer(operationId: string): Promise<boolean> {
  return invoke<boolean>('cancel_file_transfer', { operationId })
}

// --- Event Listeners ---

export async function listenFileTransferProgress(
  callback: (event: { payload: FileTransferProgress }) => void
): Promise<() => void> {
  return listen<FileTransferProgress>('file-transfer-progress', callback)
}

export async function listenFileTransferComplete(
  callback: (event: { payload: TransferCompleteEvent }) => void
): Promise<() => void> {
  return listen<TransferCompleteEvent>('file-transfer-complete', callback)
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

export async function removePath(
  path: string,
  options?: { recursive?: boolean }
): Promise<void> {
  return remove(path, options)
}
