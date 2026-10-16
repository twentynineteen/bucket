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
 * Source: Blackmagic Fusion scripting guide (BezierSpline KeyFrames format),
 * Grokipedia BezierSpline reference.
 */

import type { Ease, Keyframe } from '../../../types'

export interface FusionKeyframe {
  frame: number
  value: number
  rh?: { time: number; value: number }
  lh?: { time: number; value: number }
}

/** Convert a track of template keyframes to Fusion BezierSpline keyframes. */
export function toFusionKeyframes(
  keyframes: Keyframe<number>[],
  fps: number
): FusionKeyframe[] {
  void [keyframes, fps]
  throw new Error('Not implemented')
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
  void [t0, v0, t1, v1, ease]
  throw new Error('Not implemented')
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
  void [t0, v0, t1, v1, ease]
  throw new Error('Not implemented')
}
