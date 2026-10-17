/**
 * BezierSpline keyframe conversion for Fusion .setting files (issue #330)
 *
 * Converts template keyframes with cubic-bezier easing into Fusion BezierSpline
 * KeyFrames entries with absolute RH (right handle) and LH (left handle) values.
 *
 * Per D4:
 *   RH = (t0 + x1 * dt, v0 + y1 * dv)
 *   LH = (t1 - (1 - x2) * dt, v1 - (1 - y2) * dv)
 *
 * Handle coordinates are absolute (time, value) positions in the spline.
 * Time is in frames (integer). Values are in the property's native unit.
 *
 * Source: Blackmagic Fusion scripting guide (BezierSpline KeyFrames format).
 * Handle format confirmed via:
 * - https://grokipedia.com/page/BezierSpline_DaVinci_Resolve_Fusion
 * - Fusion 8 Scripting Guide PDF (documents.blackmagicdesign.com)
 */

import type { Ease, Keyframe } from '../../../types'

export interface FusionKeyframe {
  frame: number
  value: number
  rh?: { time: number; value: number }
  lh?: { time: number; value: number }
}

/**
 * Compute the right handle for the outgoing key of a segment.
 * RH = (t0 + x1 * dt, v0 + y1 * dv)
 */
export function computeRH(
  t0: number,
  v0: number,
  t1: number,
  v1: number,
  ease: Ease
): { time: number; value: number } {
  const [x1, y1] = ease
  const dt = t1 - t0
  const dv = v1 - v0
  return {
    time: t0 + x1 * dt,
    value: v0 + y1 * dv
  }
}

/**
 * Compute the left handle for the incoming key of a segment.
 * LH = (t1 - (1-x2) * dt, v1 - (1-y2) * dv)
 */
export function computeLH(
  t0: number,
  v0: number,
  t1: number,
  v1: number,
  ease: Ease
): { time: number; value: number } {
  const [, , x2, y2] = ease
  const dt = t1 - t0
  const dv = v1 - v0
  return {
    time: t1 - (1 - x2) * dt,
    value: v1 - (1 - y2) * dv
  }
}

/**
 * Convert a track of template keyframes to Fusion BezierSpline keyframes.
 *
 * Each segment k -> k+1 uses the ease from key k. The ease governs handle
 * placement for both the outgoing (RH on key k) and incoming (LH on key k+1).
 *
 * Interior keys get both an LH from the incoming segment and an RH from
 * the outgoing segment.
 */
export function toFusionKeyframes(
  keyframes: Keyframe<number>[],
  fps: number
): FusionKeyframe[] {
  if (keyframes.length === 0) return []

  // Build the result array with one entry per keyframe
  const result: FusionKeyframe[] = keyframes.map(kf => ({
    frame: Math.round(kf.t * fps),
    value: kf.value
  }))

  // For each segment, compute handles
  for (let i = 0; i < keyframes.length - 1; i++) {
    const ease = keyframes[i].ease
    if (!ease) continue

    const frame0 = result[i].frame
    const frame1 = result[i + 1].frame
    const v0 = keyframes[i].value
    const v1 = keyframes[i + 1].value

    // RH on the outgoing key
    result[i].rh = computeRH(frame0, v0, frame1, v1, ease)

    // LH on the incoming key
    result[i + 1].lh = computeLH(frame0, v0, frame1, v1, ease)
  }

  return result
}
