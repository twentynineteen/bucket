/**
 * Kavanagh I/O boundary (issue #180)
 *
 * Every Tauri invoke and plugin call for this feature lives here, per the module
 * conventions in CLAUDE.md. Hooks and components import from this file and never
 * from `@tauri-apps/*` directly, which is what the no-bypass contract test
 * enforces.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Event } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { exists, readDir } from '@tauri-apps/plugin-fs'

import {
  filterReferenceImages,
  matchesPoolFolder,
  type ReferencePool,
  type ReferencePoolListing
} from './internal/referencePool'
import type {
  FfmpegAvailability,
  KavanaghProgressEvent,
  KavanaghThumbnail,
  KavanaghWatermarkReport
} from './types'

/**
 * Asks the backend where the ffmpeg toolchain is.
 *
 * `customDir` is the directory configured in Settings; omit it to search the
 * standard locations. Discovery happens in Rust because it must probe absolute
 * paths — a Finder-launched app has no Homebrew directory on its PATH.
 */
export async function detectFfmpeg(
  customDir?: string | null
): Promise<FfmpegAvailability> {
  return invoke<FfmpegAvailability>('kavanagh_detect_ffmpeg', {
    customDir: customDir ?? null
  })
}

/**
 * Lists one reference pool subfolder under the configured QC folder.
 *
 * Returns a tagged result rather than throwing, so the caller can tell "the
 * folder is not there" from "the folder is there and empty" — the distinction
 * issue #166 was caused by losing.
 */
export async function listReferencePool(
  folder: string,
  pool: ReferencePool
): Promise<ReferencePoolListing> {
  // Resolved by listing the root and matching case-insensitively, rather than
  // joining a lowercase literal: the folders on disk are `Watermarks` and
  // `Stings`, which only resolves by luck on a case-insensitive volume.
  let poolPath: string
  try {
    if (!(await exists(folder))) return { status: 'missing' }
    const rootEntries = await readDir(folder)
    const match = rootEntries.find(
      (entry) => entry.isDirectory && matchesPoolFolder(entry.name || '', pool)
    )
    if (!match) return { status: 'missing' }
    poolPath = `${folder}/${match.name}`
  } catch (error) {
    // A listing that cannot run is not evidence of absence.
    return { status: 'unreadable', detail: String(error) }
  }

  try {
    const files = await collectReferenceImages(poolPath)
    return { status: 'ok', files: files.sort() }
  } catch (error) {
    return { status: 'unreadable', detail: String(error) }
  }
}

/** What to check, and with what. */
export interface WatermarkCheckRequest {
  videoPath: string
  /** The watermark pool's files, from `listReferencePool`. */
  referenceFiles: string[]
  /** The Settings ffmpeg directory, when one is configured. */
  ffmpegDirectory?: string | null
  /** An advanced override; omit for the calibrated default (B13.1). */
  matchThreshold?: number
}

/**
 * Runs the watermark check over one video.
 *
 * Long-running: the promise settles when the analysis finishes, while progress
 * arrives on the `kavanagh-progress` event. Rejects with a `KavanaghError` - including a
 * `busy` rejection when a run is already in flight (D19).
 */
export async function runWatermarkCheck(
  request: WatermarkCheckRequest
): Promise<KavanaghWatermarkReport> {
  return invoke<KavanaghWatermarkReport>('kavanagh_run_watermark_check', {
    request: {
      videoPath: request.videoPath,
      referenceFiles: request.referenceFiles,
      ffmpegDirectory: request.ffmpegDirectory ?? null,
      // Omitted rather than null when there is no override: the Rust side treats
      // `None` as "use the calibrated default".
      matchThreshold: request.matchThreshold ?? null
    }
  })
}

/**
 * Cancels the run in flight, returning whether there was one to cancel.
 *
 * No argument: only one run can exist at a time, so asking the caller to track an
 * operation id would be asking it to hold state that cannot disagree with the
 * backend's.
 */
export async function cancelKavanaghRun(): Promise<boolean> {
  return invoke<boolean>('kavanagh_cancel_run')
}

/**
 * Subscribes to progress for the run in flight. Resolves to an unsubscribe.
 */
export async function listenKavanaghProgress(
  callback: (event: Event<KavanaghProgressEvent>) => void
): Promise<() => void> {
  return listen<KavanaghProgressEvent>('kavanagh-progress', callback)
}

/**
 * Writes a report's failure thumbnails into a folder, returning the paths written.
 *
 * Existing files are never overwritten (B10.3).
 */
export async function saveKavanaghEvidence(
  folder: string,
  prefix: string,
  thumbnails: KavanaghThumbnail[]
): Promise<string[]> {
  return invoke<string[]>('kavanagh_save_evidence', {
    folder,
    prefix,
    items: thumbnails.map((thumbnail) => ({
      label: thumbnail.label,
      jpeg: thumbnail.jpeg
    }))
  })
}

/**
 * Asks the operator for a video to check.
 *
 * No extension allowlist (D17): ffprobe decides what it can decode, and reporting
 * a precise reason beats guessing from a filename.
 */
export async function pickVideoFile(): Promise<string | null> {
  const selected = await openDialog({
    directory: false,
    multiple: false,
    title: 'Choose a render to check'
  })
  return typeof selected === 'string' ? selected : null
}

/** Asks the operator where to save evidence. */
export async function pickEvidenceFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: 'Where should the evidence be saved?'
  })
  return typeof selected === 'string' ? selected : null
}

/**
 * Depth of subfolder nesting searched inside a pool.
 *
 * Resolution variants are kept in subfolders in practice — the real watermark
 * pool has a `4K Watermarks/` directory inside it, which a flat listing misses
 * entirely. Bounded rather than unlimited so a reference folder pointed at
 * something enormous by mistake cannot walk a whole drive.
 */
const MAX_POOL_DEPTH = 3

/** Collects reference images from a pool folder and its subfolders. */
async function collectReferenceImages(dir: string, depth = 0): Promise<string[]> {
  const entries = await readDir(dir)

  const files = filterReferenceImages(
    entries.filter((e) => !e.isDirectory).map((e) => e.name || '')
  ).map((name) => `${dir}/${name}`)

  if (depth >= MAX_POOL_DEPTH) return files

  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory && entry.name)
      .map(async (entry) => {
        try {
          return await collectReferenceImages(`${dir}/${entry.name}`, depth + 1)
        } catch {
          // One unreadable subfolder must not empty the whole pool.
          return []
        }
      })
  )

  return [...files, ...nested.flat()]
}
