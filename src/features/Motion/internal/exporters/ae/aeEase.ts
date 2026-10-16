/**
 * AE KeyframeEase mapping from cubic-bezier (issue #329)
 *
 * Converts a cubic-bezier [x1, y1, x2, y2] ease into outgoing and incoming
 * KeyframeEase objects for After Effects' setTemporalEaseAtKey.
 *
 * Per-property ease dimension counts are enforced: Scale = 3,
 * unseparated Position = 1, Opacity = 1, Rotation = 1, Fill Color = 1,
 * Rectangle Size = 1, Text Animator Tracking Amount = 1,
 * Trim Paths End = 1, Trim Paths Offset = 1, Slider Control = 1.
 */

import type { Ease } from '../../../types'

export interface AEKeyframeEase {
  speed: number
  influence: number
}

export interface AEEasePair {
  outgoing: AEKeyframeEase[]
  incoming: AEKeyframeEase[]
}

/**
 * Number of ease dimensions for each AE property.
 * Scale needs 3 (x, y, z). Everything else is unseparated = 1.
 */
export const EASE_DIMENSIONS: Record<string, number> = {
  Scale: 3,
  Position: 1,
  Opacity: 1,
  Rotation: 1,
  'Fill Color': 1,
  'Rectangle Size': 1,
  'Tracking Amount': 1,
  'Trim Paths End': 1,
  'Trim Paths Offset': 1,
  Slider: 1
}

/** Clamp influence to [0.1, 100] as AE requires. */
function clampInfluence(v: number): number {
  return Math.min(100, Math.max(0.1, v))
}

/**
 * Map a cubic-bezier ease to AE outgoing and incoming KeyframeEase arrays.
 *
 * From the spec:
 *   Outgoing key: influence = x1 * 100, speed = (y1 / x1) * delta
 *   Incoming key: influence = (1 - x2) * 100, speed = ((1 - y2) / (1 - x2)) * delta
 *
 * Where delta is the average speed (value change / time change).
 * x1 and (1-x2) are clamped to 0.001 for speed computation when they are 0.
 * Influence is clamped to [0.1, 100].
 *
 * @param ease - [x1, y1, x2, y2] cubic-bezier control points
 * @param delta - the average speed (|value change| / time change)
 * @param dimensions - number of ease dimensions for this property
 */
export function mapEase(ease: Ease, delta: number, dimensions: number): AEEasePair {
  const [x1, y1, x2, y2] = ease

  const x1Clamped = Math.max(x1, 0.001)
  const outInfluence = clampInfluence(x1 * 100)
  const outSpeed = (y1 / x1Clamped) * delta

  const oneMinusX2 = 1 - x2
  const oneMinusX2Clamped = Math.max(oneMinusX2, 0.001)
  const inInfluence = clampInfluence(oneMinusX2 * 100)
  const inSpeed = ((1 - y2) / oneMinusX2Clamped) * delta

  const outEase: AEKeyframeEase = { speed: outSpeed, influence: outInfluence }
  const inEase: AEKeyframeEase = { speed: inSpeed, influence: inInfluence }

  const outgoing: AEKeyframeEase[] = []
  const incoming: AEKeyframeEase[] = []
  for (let d = 0; d < dimensions; d++) {
    outgoing.push({ ...outEase })
    incoming.push({ ...inEase })
  }

  return { outgoing, incoming }
}
