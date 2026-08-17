/**
 * QC availability composition (issue #180, B8.5)
 *
 * QC needs three things before it can run: an ffmpeg toolchain, a watermark
 * reference pool and a sting reference pool. When more than one is missing the
 * page must report *one* reason, and it must be the one the user should act on
 * first — telling someone their sting pool is empty is noise if ffmpeg is not
 * installed at all.
 */

import type { FfmpegAvailability } from '../types'
import type { ReferencePoolState } from './referencePool'

export interface KavanaghAvailability {
  /** True only when every prerequisite is satisfied. */
  available: boolean
  /** The single reason to show, or null when QC can run. */
  reason: string | null
  /** True while a prerequisite check is still in flight, so nothing is claimed yet. */
  pending: boolean
}

/**
 * Composes the prerequisites into a single verdict.
 *
 * Order: ffmpeg before references (no toolchain makes the pools irrelevant),
 * and watermarks before stings (the watermark check runs first). Nothing is
 * claimed while a check it depends on is still pending.
 */
export function resolveKavanaghAvailability({
  ffmpeg,
  watermarks,
  stings
}: {
  ffmpeg: FfmpegAvailability | null
  watermarks: ReferencePoolState
  stings: ReferencePoolState
}): KavanaghAvailability {
  const poolPending = (pool: ReferencePoolState) =>
    pool.status === 'unknown' || pool.status === 'loading'

  // Nothing is claimed until every check has reported. Announcing "no sting
  // references" while that very listing is still in flight is the #166 defect.
  if (ffmpeg === null || poolPending(watermarks) || poolPending(stings)) {
    return { available: false, reason: null, pending: true }
  }

  if (ffmpeg.status !== 'ready') {
    return { available: false, reason: describeFfmpeg(ffmpeg), pending: false }
  }

  // Watermarks before stings: the watermark check runs first, so its
  // prerequisite is the one to fix first.
  for (const pool of [watermarks, stings]) {
    if (pool.status !== 'ready') {
      return {
        available: false,
        reason: pool.reason ?? 'QC reference images are unavailable.',
        pending: false
      }
    }
  }

  return { available: true, reason: null, pending: false }
}

/**
 * Turns an unusable toolchain into an instruction.
 *
 * The two failure modes get different wording on purpose: telling someone to
 * install ffmpeg when the binary is sitting there with the wrong permissions
 * sends them round a loop that cannot end.
 */
function describeFfmpeg(
  ffmpeg: Exclude<FfmpegAvailability, { status: 'ready' }>
): string {
  if (ffmpeg.status === 'notExecutable') {
    return `ffmpeg at ${ffmpeg.path} cannot be run. Check the file's permissions.`
  }

  const missing = ffmpeg.missing.join(' and ')
  const where =
    ffmpeg.searched.length > 0 ? ` Searched: ${ffmpeg.searched.join(', ')}.` : ''

  // Homebrew's ffmpeg formula provides both binaries, so "install ffmpeg" is the
  // right instruction even when only ffprobe is the one missing.
  return `Video QC needs ${missing}, which could not be found. Install ffmpeg (brew install ffmpeg), or set a custom location in Settings.${where}`
}
