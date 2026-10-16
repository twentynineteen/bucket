/**
 * useMotionTicker - IntersectionObserver subscription and reduced-motion
 * handling for one Motion preview (issue #335).
 *
 * When the element is in view and the user does not prefer reduced motion,
 * subscribes to the shared ticker. Under reduced motion, shows a static
 * poster at t = inEnd and plays only on hover/focus.
 */

export interface UseMotionTickerOptions {
  /** The resolved template duration (with hold). */
  duration: number
  /** The resolved inEnd time (poster frame for reduced motion). */
  inEnd: number
  /** Whether the preview should be playing. */
  playing: boolean
}

export interface UseMotionTickerResult {
  /** Ref to attach to the container element for IntersectionObserver. */
  containerRef: React.RefCallback<HTMLElement>
  /** Current template time, or null during the loop gap. */
  time: number | null
  /** Whether the preview is actually playing (may be paused by reduced motion). */
  isPlaying: boolean
}

export function useMotionTicker(options: UseMotionTickerOptions): UseMotionTickerResult {
  void options
  throw new Error('not implemented')
}
