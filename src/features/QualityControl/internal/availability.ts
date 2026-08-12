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

export interface QcAvailability {
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
export function resolveQcAvailability(input: {
  ffmpeg: FfmpegAvailability | null
  watermarks: ReferencePoolState
  stings: ReferencePoolState
}): QcAvailability {
  void input
  throw new Error('not implemented')
}
