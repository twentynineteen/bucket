/**
 * Quality Control I/O boundary (issue #180)
 *
 * Every Tauri invoke and plugin call for this feature lives here, per the module
 * conventions in CLAUDE.md. Hooks and components import from this file and never
 * from `@tauri-apps/*` directly, which is what the no-bypass contract test
 * enforces.
 */

import { invoke } from '@tauri-apps/api/core'
import { exists, readDir } from '@tauri-apps/plugin-fs'

import {
  filterReferenceImages,
  type ReferencePool,
  type ReferencePoolListing
} from './internal/referencePool'
import type { FfmpegAvailability } from './types'

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
  return invoke<FfmpegAvailability>('qc_detect_ffmpeg', {
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
  const poolPath = `${folder}/${pool}`

  // An existence probe rather than matching on readDir's rejection text: that
  // text is unversioned and locale-sensitive.
  try {
    if (!(await exists(poolPath))) return { status: 'missing' }
  } catch (error) {
    // A probe that cannot run is not evidence of absence.
    return { status: 'unreadable', detail: String(error) }
  }

  try {
    const entries = await readDir(poolPath)
    const files = filterReferenceImages(entries.map((entry) => entry.name || ''))
      .map((name) => `${poolPath}/${name}`)
      .sort()
    return { status: 'ok', files }
  } catch (error) {
    return { status: 'unreadable', detail: String(error) }
  }
}
