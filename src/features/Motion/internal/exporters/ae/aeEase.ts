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
 */
export const EASE_DIMENSIONS: Record<string, number> = {}

/**
 * Map a cubic-bezier ease to AE outgoing and incoming KeyframeEase arrays.
 *
 * @param ease - [x1, y1, x2, y2] cubic-bezier control points
 * @param delta - the average speed (value change / time change)
 * @param dimensions - number of ease dimensions for this property
 */
export function mapEase(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ease: Ease,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delta: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dimensions: number
): AEEasePair {
  throw new Error('Not implemented')
}
