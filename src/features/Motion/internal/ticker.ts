/**
 * Shared rAF ticker for Motion preview (issue #335)
 *
 * One requestAnimationFrame loop drives every visible preview card.
 * Subscribers are notified at most 30 fps. The loop pauses when the
 * document is hidden (visibilitychange) and resumes without a time jump.
 */

export type TickerCallback = (elapsed: number) => void

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const subscribers = new Set<TickerCallback>()
let rafId: number | null = null
let lastNotifyTimestamp = 0
/** The rAF timestamp at which the ticker started (or resumed). */
let startTimestamp = -1
/** Accumulated elapsed seconds before the last pause. */
let elapsedAtPause = 0
let isHidden = false

/**
 * Minimum interval between notifications: ~33.3ms = 30 fps.
 * Subtract a small epsilon to avoid floating-point edge cases where
 * exactly-spaced 60 Hz frames miss the 30 fps gate.
 */
const MIN_INTERVAL_MS = 1000 / 30 - 0.01

// ---------------------------------------------------------------------------
// Internal reset for tests
// ---------------------------------------------------------------------------

/** Reset all module state. Exported for tests only. */
export function _reset(): void {
  for (const cb of [...subscribers]) {
    subscribers.delete(cb)
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  lastNotifyTimestamp = 0
  startTimestamp = -1
  elapsedAtPause = 0
  isHidden = false
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

function tick(timestamp: number): void {
  rafId = null

  if (isHidden || subscribers.size === 0) return

  // Initialise start timestamp on first frame - always notify immediately
  if (startTimestamp < 0) {
    startTimestamp = timestamp
    lastNotifyTimestamp = timestamp
    // Notify immediately on the first frame
    for (const cb of subscribers) {
      cb(elapsedAtPause)
    }
    if (subscribers.size > 0) {
      rafId = requestAnimationFrame(tick)
    }
    return
  }

  const dt = timestamp - lastNotifyTimestamp
  if (dt >= MIN_INTERVAL_MS) {
    lastNotifyTimestamp = timestamp
    // Elapsed in seconds since the ticker started, excluding paused time
    const elapsed = elapsedAtPause + (timestamp - startTimestamp) / 1000
    for (const cb of subscribers) {
      cb(elapsed)
    }
  }

  // Schedule the next frame
  if (subscribers.size > 0) {
    rafId = requestAnimationFrame(tick)
  }
}

function startLoop(): void {
  if (rafId !== null || isHidden) return
  rafId = requestAnimationFrame(tick)
}

function stopLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

function handleVisibility(): void {
  if (document.visibilityState === 'hidden') {
    isHidden = true
    // Record accumulated elapsed before pausing
    if (startTimestamp >= 0) {
      // We cannot get the current rAF timestamp here, but lastNotifyTimestamp
      // is close enough (within one frame).
      elapsedAtPause += (lastNotifyTimestamp - startTimestamp) / 1000
    }
    stopLoop()
  } else {
    isHidden = false
    // Reset start timestamp so the next tick picks up from zero offset
    startTimestamp = -1
    lastNotifyTimestamp = 0
    if (subscribers.size > 0) {
      startLoop()
    }
  }
}

// Listen for visibility changes (safe in both browser and test environments)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibility)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Subscribe to the shared ticker. Returns an unsubscribe function. */
export function subscribe(cb: TickerCallback): () => void {
  const wasEmpty = subscribers.size === 0
  subscribers.add(cb)

  // Start the loop if this is the first subscriber
  if (wasEmpty) {
    startTimestamp = -1
    lastNotifyTimestamp = 0
    elapsedAtPause = 0
    startLoop()
  }

  return () => {
    subscribers.delete(cb)
    if (subscribers.size === 0) {
      stopLoop()
    }
  }
}

/** How many subscribers are currently registered. For testing only. */
export function subscriberCount(): number {
  return subscribers.size
}
