/**
 * useDebouncedFlag (issue #155, R2)
 *
 * Reports true only once `value` has stayed true for `delayMs`. Going false is
 * immediate -- there is no reason to keep a closed submenu "open" for anyone.
 *
 * Why this exists: Radix opens a submenu on pointer move after a 100ms timer
 * (`@radix-ui/react-menu` SubTrigger). Wiring a query's `enabled` straight to
 * the open state means sweeping the mouse down a 20-folder menu fires 20 folder
 * requests -- the crawl #155 exists to avoid, reintroduced by mouse movement.
 * Gating on a *dwell* leaves Radix's UX untouched (the menu still opens
 * instantly) while a hover-through costs nothing.
 */
import { useEffect, useState } from 'react'

export function useDebouncedFlag(value: boolean, delayMs: number): boolean {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!value) return

    const timer = setTimeout(() => setSettled(true), delayMs)
    // Reset on teardown rather than in the effect body: closing must not leave
    // `settled` true, or reopening would fire immediately and skip the dwell.
    return () => {
      clearTimeout(timer)
      setSettled(false)
    }
  }, [value, delayMs])

  // Falling back to false is immediate -- there is no reason to keep a closed
  // submenu "dwelling" while the reset settles.
  return value && settled
}
