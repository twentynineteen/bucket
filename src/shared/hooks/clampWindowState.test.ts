/**
 * clampWindowState — window geometry validation
 *
 * Written after the app launched with an invisible window. Two bugs combined:
 * geometry was saved in physical pixels but restored as logical (so every launch
 * on a 2x display doubled it), and nothing checked the result was on-screen.
 *
 * The real saved values at the time are used as fixtures below, so the specific
 * failure that wasted a debugging session cannot come back quietly.
 */
import { describe, expect, it } from 'vitest'

import { clampWindowState } from './useWindowState'

/** A 2560x1440 display at the origin — the machine this bug was found on. */
const MONITOR = { position: { x: 0, y: 0 }, size: { width: 2560, height: 1440 } }

/** A second display to the right, as in a two-monitor desk setup. */
const RIGHT_MONITOR = {
  position: { x: 2560, y: 0 },
  size: { width: 1920, height: 1080 }
}

describe('rejecting state that should not be restored', () => {
  it('rejects the degenerate geometry that hid the window', () => {
    // Verbatim from localStorage when the window could not be found: a 226px
    // tall sliver. Restoring it is worse than ignoring it.
    expect(
      clampWindowState({ x: 1029, y: 490, width: 1001, height: 226 }, MONITOR)
    ).toBeNull()
  })

  it('rejects a window narrower than the minimum', () => {
    expect(clampWindowState({ x: 0, y: 0, width: 300, height: 800 }, MONITOR)).toBeNull()
  })

  it('rejects non-numeric, missing and non-finite values', () => {
    expect(clampWindowState(null, MONITOR)).toBeNull()
    expect(clampWindowState('nonsense', MONITOR)).toBeNull()
    expect(clampWindowState({}, MONITOR)).toBeNull()
    expect(clampWindowState({ x: 0, y: 0, width: 1200 }, MONITOR)).toBeNull()
    expect(
      clampWindowState({ x: Number.NaN, y: 0, width: 1200, height: 800 }, MONITOR)
    ).toBeNull()
    expect(
      clampWindowState({ x: 0, y: 0, width: Infinity, height: 800 }, MONITOR)
    ).toBeNull()
  })

  it('does not restore when monitor bounds are unknown', () => {
    // Guessing without knowing the display is what put the window off-screen.
    expect(
      clampWindowState({ x: 100, y: 100, width: 1200, height: 800 }, null)
    ).toBeNull()
  })

  it('does not restore when monitor bounds are malformed', () => {
    expect(
      clampWindowState(
        { x: 100, y: 100, width: 1200, height: 800 },
        {
          position: { x: 0, y: 0 },
          size: { width: Number.NaN, height: 1440 }
        }
      )
    ).toBeNull()
  })
})

describe('geometry already on screen is preserved', () => {
  it('leaves a sensible window untouched', () => {
    const state = { x: 200, y: 120, width: 1200, height: 800 }
    expect(clampWindowState(state, MONITOR)).toEqual(state)
  })

  it('preserves a window on a second monitor to the right', () => {
    const state = { x: 2700, y: 100, width: 1400, height: 900 }
    expect(clampWindowState(state, RIGHT_MONITOR)).toEqual(state)
  })
})

describe('oversized geometry is capped to the display', () => {
  it('caps a window larger than the monitor', () => {
    // The doubling bug produced exactly this: 2002x2408 on a 1440px-tall screen.
    const result = clampWindowState(
      { x: 2058, y: 50, width: 2002, height: 2408 },
      MONITOR
    )

    expect(result).not.toBeNull()
    expect(result!.width).toBeLessThanOrEqual(MONITOR.size.width)
    expect(result!.height).toBe(MONITOR.size.height)
  })
})

describe('off-screen geometry is pulled back into view', () => {
  it('pulls back a window pushed off the right edge', () => {
    const result = clampWindowState(
      { x: 9000, y: 100, width: 1200, height: 800 },
      MONITOR
    )

    expect(result).not.toBeNull()
    // Some of the window must remain on the monitor to be grabbable.
    expect(result!.x).toBeLessThan(MONITOR.size.width)
    expect(result!.x + result!.width).toBeGreaterThan(MONITOR.position.x)
  })

  it('pulls back a window pushed off the left edge', () => {
    const result = clampWindowState(
      { x: -5000, y: 100, width: 1200, height: 800 },
      MONITOR
    )

    expect(result).not.toBeNull()
    expect(result!.x + result!.width).toBeGreaterThan(MONITOR.position.x)
  })

  it('never places the title bar above the monitor', () => {
    // A negative y hides the title bar under the menu bar, leaving the window
    // impossible to drag back.
    const result = clampWindowState(
      { x: 100, y: -400, width: 1200, height: 800 },
      MONITOR
    )

    expect(result).not.toBeNull()
    expect(result!.y).toBeGreaterThanOrEqual(MONITOR.position.y)
  })

  it('keeps the title bar reachable when pushed below the monitor', () => {
    const result = clampWindowState(
      { x: 100, y: 9000, width: 1200, height: 800 },
      MONITOR
    )

    expect(result).not.toBeNull()
    expect(result!.y).toBeLessThan(MONITOR.position.y + MONITOR.size.height)
  })
})

describe('restoring is idempotent', () => {
  it('clamping a clamped result changes nothing', () => {
    // The old bug compounded because each launch re-saved a value the previous
    // launch had already distorted. A stable fixed point prevents that class.
    const first = clampWindowState(
      { x: 9000, y: 9000, width: 4000, height: 4000 },
      MONITOR
    )
    expect(first).not.toBeNull()

    const second = clampWindowState(first, MONITOR)
    expect(second).toEqual(first)
  })
})
