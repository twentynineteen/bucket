/**
 * Motion feature I/O boundary.
 *
 * Every Tauri plugin call, invoke, listen and navigator.clipboard use in the
 * module lives here. Internal modules import this file; nothing else under
 * Motion/ imports @tauri-apps/* directly.
 */
import { posterFrameFontPath } from '@features/Upload'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { appDataDir, join } from '@tauri-apps/api/path'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile
} from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import type { MotionRenderProgress, MotionRenderRequest } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a filename inside the app data directory. */
async function resolveAppDataFile(filename: string): Promise<string> {
  return join(await appDataDir(), filename)
}

// ---------------------------------------------------------------------------
// Motion prefs (motion_prefs.json in the app data dir)
// ---------------------------------------------------------------------------

/** Read the raw text of motion_prefs.json, or null when the file is absent. */
export async function readMotionPrefsText(): Promise<string | null> {
  const path = await resolveAppDataFile('motion_prefs.json')
  if (!(await exists(path))) return null
  return readTextFile(path)
}

/** Overwrite motion_prefs.json with the given text. */
export async function writeMotionPrefsText(text: string): Promise<void> {
  const path = await resolveAppDataFile('motion_prefs.json')
  await writeTextFile(path, text)
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/** Open a folder picker. Returns the chosen path or null if cancelled. */
export async function pickFolder(options?: {
  defaultPath?: string
  title?: string
}): Promise<string | null> {
  const result = await openDialog({
    directory: true,
    multiple: false,
    defaultPath: options?.defaultPath,
    title: options?.title
  })
  return typeof result === 'string' ? result : null
}

/** Open a file picker filtered to PNG images. Returns the path or null. */
export async function pickPngImage(): Promise<string | null> {
  const result = await openDialog({
    directory: false,
    multiple: false,
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })
  return typeof result === 'string' ? result : null
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

/** List a folder (non-recursive). */
export async function listFolder(
  path: string
): Promise<{ name: string; isFile: boolean }[]> {
  const entries = await readDir(path)
  return entries.map(e => ({
    name: e.name ?? '',
    isFile: e.isFile ?? false
  }))
}

/** Read a text file. */
export async function readText(path: string): Promise<string> {
  return readTextFile(path)
}

/** Read a file as bytes. */
export async function readBytes(path: string): Promise<Uint8Array> {
  return readFile(path)
}

/** Whether a path exists on disk. */
export async function pathExists(path: string): Promise<boolean> {
  return exists(path)
}

/** Create a directory (recursive). */
export async function makeDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

/** Write a text file. */
export async function writeText(path: string, text: string): Promise<void> {
  await writeTextFile(path, text)
}

/** Write a binary file. */
export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, bytes)
}

/** Rename (move) a path. */
export async function renamePath(from: string, to: string): Promise<void> {
  await rename(from, to)
}

/** Remove a directory and all its contents. */
export async function removeDirRecursive(path: string): Promise<void> {
  await remove(path, { recursive: true })
}

/** Join path segments. */
export async function joinPath(...parts: string[]): Promise<string> {
  return join(...parts)
}

// ---------------------------------------------------------------------------
// Font (Cabrito Semi Norm Bold, shared with Posterframe)
// ---------------------------------------------------------------------------

/** Whether the motion font (Cabrito.otf) is installed. */
export async function motionFontAvailable(): Promise<boolean> {
  return exists(await posterFrameFontPath())
}

/** Read the motion font bytes. */
export async function readMotionFont(): Promise<Uint8Array> {
  return readFile(await posterFrameFontPath())
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

/**
 * Copy text to the clipboard. The writeText call is the first statement so
 * the user gesture is preserved in WKWebView.
 */
export async function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

// ---------------------------------------------------------------------------
// File operations for export
// ---------------------------------------------------------------------------

/** Copy a file from one path to another. */
export async function copyFileTo(from: string, to: string): Promise<void> {
  await copyFile(from, to)
}

/** Reveal a path in the system file explorer. */
export async function revealInFinder(path: string): Promise<void> {
  await revealItemInDir(path)
}

// ---------------------------------------------------------------------------
// Rust render pipeline
// ---------------------------------------------------------------------------

/** Start a video render. Returns the render id. */
export async function startRender(request: MotionRenderRequest): Promise<string> {
  return invoke('motion_render_start', { request })
}

/**
 * Send one PNG frame to an active render. The bytes are passed as a raw
 * body with the render id in the headers, matching the Rust command's
 * `tauri::ipc::Request` signature.
 */
export async function sendRenderFrame(renderId: string, png: Uint8Array): Promise<void> {
  await invoke('motion_render_frame', png, {
    headers: { 'motion-render-id': renderId }
  })
}

/** Finish a render and get back the output path. */
export async function finishRender(renderId: string): Promise<string> {
  return invoke('motion_render_finish', { renderId })
}

/** Cancel an active render. */
export async function cancelRender(renderId: string): Promise<void> {
  await invoke('motion_render_cancel', { renderId })
}

/** Subscribe to render progress events. Returns an unsubscribe function. */
export async function onRenderProgress(
  cb: (p: MotionRenderProgress) => void
): Promise<() => void> {
  return listen<MotionRenderProgress>('motion-render-progress', event =>
    cb(event.payload)
  )
}
