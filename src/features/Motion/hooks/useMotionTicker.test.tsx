/**
 * useMotionTicker tests (issue #335)
 *
 * Tests IntersectionObserver subscription, reduced-motion handling,
 * and test clock override.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribe } from '../internal/ticker'
import { useMotionTicker } from './useMotionTicker'

// Mock the ticker module
vi.mock('../internal/ticker', () => ({
  subscribe: vi.fn(() => vi.fn()),
  subscriberCount: vi.fn(() => 0)
}))

// Mock the loopTime module
vi.mock('../internal/loopTime', () => ({
  loopTime: vi.fn((elapsed: number) => elapsed),
  LOOP_GAP: 0.5
}))

// Mock the clock module
vi.mock('../internal/clock', () => ({
  readTestClock: vi.fn(() => null)
}))

const mockSubscribe = vi.mocked(subscribe)

const BASE_OPTIONS = {
  duration: 4,
  inEnd: 1,
  playing: true
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset matchMedia to non-reduced motion
  ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation(
    (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  )

  // Reset IO entries
  delete (window as unknown as Record<string, unknown>).__BUCKET_IO_ENTRIES__
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMotionTicker', () => {
  // P2.5: IntersectionObserver-based subscription
  it('p2_5_subscribes_when_in_view', () => {
    const unsubFn = vi.fn()
    mockSubscribe.mockReturnValue(unsubFn)

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))

    // Set up a container element
    const el = document.createElement('div')
    act(() => {
      result.current.containerRef(el)
    })

    // Default IO stub reports everything as intersecting
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('p2_5_unsubscribes_when_out_of_view', () => {
    const unsubFn = vi.fn()
    mockSubscribe.mockReturnValue(unsubFn)

    // Configure IO to report as not intersecting
    const ioEntries = new Map()
    ;(window as unknown as Record<string, unknown>).__BUCKET_IO_ENTRIES__ = ioEntries

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))
    const el = document.createElement('div')
    ioEntries.set(el, false)

    act(() => {
      result.current.containerRef(el)
    })

    // Should NOT be subscribed when out of view
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('p2_5_no_throw_when_IntersectionObserver_undefined', () => {
    // Temporarily remove IO
    const origIO = global.IntersectionObserver
    // @ts-expect-error - deliberately removing for test
    delete global.IntersectionObserver

    const unsubFn = vi.fn()
    mockSubscribe.mockReturnValue(unsubFn)

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))
    const el = document.createElement('div')

    // Should not throw and should treat as in-view (subscribe)
    expect(() => {
      act(() => {
        result.current.containerRef(el)
      })
    }).not.toThrow()

    expect(mockSubscribe).toHaveBeenCalled()

    // Restore
    global.IntersectionObserver = origIO
  })

  // P4.1: reduced motion shows poster at inEnd
  it('p4_1_reduced_motion_shows_poster_at_inEnd', () => {
    // Configure matchMedia to report reduced motion
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    )

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))
    const el = document.createElement('div')
    act(() => {
      result.current.containerRef(el)
    })

    // Should show poster at inEnd, not subscribe to ticker
    expect(result.current.time).toBe(1) // inEnd
    expect(result.current.isPlaying).toBe(false)
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  // P4.2: hover/focus plays under reduced motion
  it('p4_2_hover_plays_under_reduced_motion', () => {
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    )

    const unsubFn = vi.fn()
    mockSubscribe.mockReturnValue(unsubFn)

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))
    const el = document.createElement('div')
    act(() => {
      result.current.containerRef(el)
    })

    // Initially not playing
    expect(result.current.isPlaying).toBe(false)

    // Simulate hover - the element dispatches mouseenter
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseenter'))
    })

    // Now should be subscribed and playing
    expect(mockSubscribe).toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)

    // Simulate mouse leave
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseleave'))
    })

    // Should return to poster
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.time).toBe(1) // inEnd
    expect(unsubFn).toHaveBeenCalled()
  })

  it('p4_2_focus_plays_under_reduced_motion', () => {
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    )

    const unsubFn = vi.fn()
    mockSubscribe.mockReturnValue(unsubFn)

    const { result } = renderHook(() => useMotionTicker(BASE_OPTIONS))
    const el = document.createElement('div')
    act(() => {
      result.current.containerRef(el)
    })

    // Initially poster
    expect(result.current.isPlaying).toBe(false)

    // Simulate focus
    act(() => {
      el.dispatchEvent(new FocusEvent('focusin'))
    })

    expect(mockSubscribe).toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)

    // Simulate blur
    act(() => {
      el.dispatchEvent(new FocusEvent('focusout'))
    })

    expect(result.current.isPlaying).toBe(false)
    expect(unsubFn).toHaveBeenCalled()
  })
})
