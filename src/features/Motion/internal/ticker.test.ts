/**
 * Shared rAF ticker tests (issue #335)
 *
 * Uses fake timers and a rAF stub - no real time. Tests tear down through
 * the public API (unsubscribe all callbacks) rather than a private _reset.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribe } from './ticker'

// ---------------------------------------------------------------------------
// rAF stub: a manual rAF that we control
// ---------------------------------------------------------------------------

let rafCallbacks: Map<number, FrameRequestCallback>
let nextRafId: number
let currentTime: number

/** Track all unsubscribe functions so afterEach can clean up. */
let cleanups: (() => void)[]

function stubRaf(cb: FrameRequestCallback): number {
  const id = nextRafId++
  rafCallbacks.set(id, cb)
  return id
}

function stubCancelRaf(id: number): void {
  rafCallbacks.delete(id)
}

/** Fire all pending rAF callbacks at the given time. */
function flushRaf(time: number): void {
  currentTime = time
  const cbs = new Map(rafCallbacks)
  rafCallbacks.clear()
  for (const cb of cbs.values()) {
    cb(time)
  }
}

/** Simulate one second of 60 Hz frames. */
function simulateOneSecond60Hz(): void {
  const start = currentTime
  for (let i = 1; i <= 60; i++) {
    flushRaf(start + (i * 1000) / 60)
  }
}

beforeEach(() => {
  rafCallbacks = new Map()
  nextRafId = 1
  currentTime = 0
  cleanups = []

  vi.stubGlobal('requestAnimationFrame', stubRaf)
  vi.stubGlobal('cancelAnimationFrame', stubCancelRaf)

  // Reset visibility state to visible
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  // Unsubscribe everything through the public API
  for (const unsub of cleanups) {
    unsub()
  }
  cleanups = []
  vi.restoreAllMocks()
})

/** Subscribe and register the cleanup for automatic teardown. */
function trackedSubscribe(cb: Parameters<typeof subscribe>[0]) {
  const unsub = subscribe(cb)
  cleanups.push(unsub)
  return unsub
}

describe('ticker', () => {
  // P2.1: one rAF loop, not twelve
  it('p2_1_single_raf_loop_for_12_subscribers', () => {
    const callbacks = Array.from({ length: 12 }, () => vi.fn())
    callbacks.forEach(cb => trackedSubscribe(cb))

    // After subscribing 12, there should be at most 1 pending rAF
    expect(rafCallbacks.size).toBeLessThanOrEqual(1)

    // Run one frame
    flushRaf(16.67)

    // Still at most one pending rAF
    expect(rafCallbacks.size).toBeLessThanOrEqual(1)

    // All 12 were notified
    for (const cb of callbacks) {
      expect(cb).toHaveBeenCalled()
    }
  })

  // P2.2: 30 fps cap on 60 Hz display
  it('p2_2_30fps_cap_on_60hz_raf', () => {
    const cb = vi.fn()
    trackedSubscribe(cb)

    simulateOneSecond60Hz()

    // 30 fps cap: should be about 30 notifications (+-1)
    const calls = cb.mock.calls.length
    expect(calls).toBeGreaterThanOrEqual(29)
    expect(calls).toBeLessThanOrEqual(31)
  })

  // P2.3: last subscriber unsubscribes stops rAF
  it('p2_3_no_raf_after_last_unsubscribe', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = trackedSubscribe(cb1)
    const unsub2 = trackedSubscribe(cb2)

    // First frame so they get initial callbacks
    flushRaf(16.67)
    const calls1Before = cb1.mock.calls.length
    const calls2Before = cb2.mock.calls.length

    unsub1()

    // Fire another frame - cb1 should not receive it
    flushRaf(50)
    expect(cb1.mock.calls.length).toBe(calls1Before)
    expect(cb2.mock.calls.length).toBeGreaterThan(calls2Before)

    unsub2()

    // No pending rAF after both unsubscribed
    flushRaf(100)
    expect(rafCallbacks.size).toBe(0)
  })

  // P2.4: visibilitychange pauses and resumes
  it('p2_4_visibility_pause_and_resume', () => {
    const cb = vi.fn()
    trackedSubscribe(cb)

    // One frame while visible
    flushRaf(16.67)
    const callsBefore = cb.mock.calls.length

    // Go hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // Frames while hidden should not notify
    flushRaf(1000)
    flushRaf(2000)
    expect(cb.mock.calls.length).toBe(callsBefore)

    // No pending rAF while hidden
    expect(rafCallbacks.size).toBe(0)

    // Go visible again
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // Should resume - the next frame should notify
    flushRaf(2016.67)
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore)

    // Verify no time jump larger than one frame (~33ms at 30fps)
    const lastElapsed = cb.mock.calls[cb.mock.calls.length - 1][0]
    const prevElapsed =
      cb.mock.calls.length > 1 ? cb.mock.calls[cb.mock.calls.length - 2][0] : 0
    // The gap should be at most ~34ms (one 30fps frame)
    expect(lastElapsed - prevElapsed).toBeLessThanOrEqual(0.04)
  })
})
