/**
 * Loop time calculator for Motion preview (issue #335)
 *
 * Converts elapsed time into template time, implementing the
 * in -> hold -> out -> 0.5 s gap loop.
 *
 * Returns null during the gap (nothing should be drawn).
 */

/** The gap duration after the out phase before looping. */
export const LOOP_GAP = 0.5

/**
 * Convert elapsed wall-clock time into a template time.
 * Returns null during the gap between loops.
 *
 * @param elapsed - wall-clock seconds since the animation started
 * @param duration - the resolved template duration (with hold applied)
 */
export function loopTime(elapsed: number, duration: number): number | null {
  const period = duration + LOOP_GAP
  const t = elapsed % period
  if (t >= duration) return null
  return t
}
