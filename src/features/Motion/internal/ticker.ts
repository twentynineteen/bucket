/**
 * Shared rAF ticker for Motion preview (issue #335)
 *
 * One requestAnimationFrame loop drives every visible preview card.
 * Subscribers are notified at most 30 fps. The loop pauses when the
 * document is hidden (visibilitychange) and resumes without a time jump.
 */

export type TickerCallback = (elapsed: number) => void

/** Subscribe to the shared ticker. Returns an unsubscribe function. */
export function subscribe(cb: TickerCallback): () => void {
  void cb
  throw new Error('not implemented')
}

/** How many subscribers are currently registered. For testing only. */
export function subscriberCount(): number {
  throw new Error('not implemented')
}
