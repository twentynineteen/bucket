/**
 * useMotionTicker - IntersectionObserver subscription and reduced-motion
 * handling for one Motion preview (issue #335).
 *
 * When the element is in view and the user does not prefer reduced motion,
 * subscribes to the shared ticker. Under reduced motion, shows a static
 * poster at t = inEnd and plays only on hover/focus.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { readTestClock } from '../internal/clock'
import { loopTime } from '../internal/loopTime'
import { subscribe } from '../internal/ticker'

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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  return mq.matches
}

export function useMotionTicker(options: UseMotionTickerOptions): UseMotionTickerResult {
  const { duration, inEnd, playing } = options

  const reducedMotion = prefersReducedMotion()
  const [tickerTime, setTickerTime] = useState<number | null>(null)
  const [isInView, setIsInView] = useState(false)
  const [interacting, setInteracting] = useState(false)

  const elementRef = useRef<HTMLElement | null>(null)
  const ioRef = useRef<IntersectionObserver | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const cleanupListenersRef = useRef<(() => void) | null>(null)

  // Determine if we should actually be playing
  const shouldPlay = playing && isInView && (!reducedMotion || interacting)
  const isPlaying = shouldPlay

  // Check for test clock - this is computed during render, not in an effect
  const testClock = readTestClock()

  // Compute the effective time:
  // - Test clock overrides everything
  // - Under reduced motion when not interacting: show poster at inEnd
  // - Otherwise: use ticker time
  let time: number | null
  if (testClock !== null) {
    time = testClock
  } else if (reducedMotion && !interacting) {
    time = inEnd
  } else {
    time = tickerTime
  }

  // Subscribe/unsubscribe to the ticker based on shouldPlay
  useEffect(() => {
    // Test clock: no subscription needed
    if (testClock !== null) return

    if (!shouldPlay) {
      // Unsubscribe if we were subscribed
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      return
    }

    const unsub = subscribe(elapsed => {
      const t = loopTime(elapsed, duration)
      setTickerTime(t)
    })
    unsubRef.current = unsub

    return () => {
      unsub()
      unsubRef.current = null
    }
  }, [shouldPlay, duration, testClock])

  // Set up hover/focus listeners when the element changes
  const setupListeners = useCallback(
    (el: HTMLElement | null) => {
      // Clean up previous listeners
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current()
        cleanupListenersRef.current = null
      }

      if (!el || !reducedMotion) return

      const onEnter = () => setInteracting(true)
      const onLeave = () => setInteracting(false)
      const onFocusIn = () => setInteracting(true)
      const onFocusOut = () => setInteracting(false)

      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      el.addEventListener('focusin', onFocusIn)
      el.addEventListener('focusout', onFocusOut)

      cleanupListenersRef.current = () => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
        el.removeEventListener('focusin', onFocusIn)
        el.removeEventListener('focusout', onFocusOut)
      }
    },
    [reducedMotion]
  )

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current()
        cleanupListenersRef.current = null
      }
    }
  }, [])

  // Ref callback for IntersectionObserver
  const containerRef = useCallback(
    (el: HTMLElement | null) => {
      // Clean up previous observer
      if (ioRef.current) {
        ioRef.current.disconnect()
        ioRef.current = null
      }

      elementRef.current = el

      // Set up hover/focus listeners on the new element
      setupListeners(el)

      if (!el) {
        setIsInView(false)
        return
      }

      // If IntersectionObserver is not available, treat as always in view
      if (typeof IntersectionObserver === 'undefined') {
        setIsInView(true)
        return
      }

      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.target === el) {
            setIsInView(entry.isIntersecting)
          }
        }
      })
      ioRef.current = observer
      observer.observe(el)
    },
    [setupListeners]
  )

  return {
    containerRef,
    time,
    isPlaying
  }
}
