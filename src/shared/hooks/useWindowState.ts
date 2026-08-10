// Target: @features/AppShell
import { useEffect } from 'react'
import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize
} from '@tauri-apps/api/window'

import { isTauriRuntime } from '@shared/utils'

/**
 * Persisted window geometry, in **physical** pixels.
 *
 * The unit matters. `outerPosition()` / `outerSize()` report physical pixels, so
 * these values are physical. Restoring them through `LogicalPosition` /
 * `LogicalSize` -- as this hook used to -- makes Tauri multiply them by the
 * display's scale factor, so on a 2x screen every launch doubled x, y, width and
 * height. The window drifted off-screen or grew past the display until it could
 * not be found. Save and restore must use the same unit.
 */
interface WindowState {
  x: number
  y: number
  width: number
  height: number
}

interface MonitorBounds {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

/**
 * Storage key. Deliberately v2: values written by the buggy version may already
 * be doubled or degenerate, and silently reinterpreting them would reproduce the
 * invisible window on the first launch after the fix. A new key starts everyone
 * from the configured default; the legacy key is cleaned up on save.
 */
const STORAGE_KEY = 'bucket-window-state-v2'
const LEGACY_STORAGE_KEY = 'bucket-window-state'
const THROTTLE_MS = 500 // Maximum 1 save per 500ms during window movement

/**
 * Smallest geometry worth restoring. Anything under this is treated as corrupt
 * rather than intentional -- a 1001x226 window is what the doubling bug left
 * behind, and it is close to unusable.
 */
const MIN_RESTORABLE_WIDTH = 400
const MIN_RESTORABLE_HEIGHT = 300

/** How much of the window must remain on the monitor to stay grabbable. */
const MIN_VISIBLE_PX = 120

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Validates saved geometry and forces it back onto a monitor.
 *
 * Returns null when the state should not be restored at all, leaving the
 * window at the size and position `tauri.conf.json` configured. Pure, so the
 * rules can be tested without a window or a display.
 */
export function clampWindowState(
  raw: unknown,
  monitor: MonitorBounds | null
): WindowState | null {
  if (!raw || typeof raw !== 'object') return null

  const { x, y, width, height } = raw as Record<string, unknown>
  if (![x, y, width, height].every(isFiniteNumber)) return null

  let nextWidth = width as number
  let nextHeight = height as number
  if (nextWidth < MIN_RESTORABLE_WIDTH || nextHeight < MIN_RESTORABLE_HEIGHT) {
    return null
  }

  // Without monitor bounds we cannot prove the state is visible, and guessing
  // is what produced the original bug.
  if (!monitor) return null

  const { position, size } = monitor
  if (
    !isFiniteNumber(position?.x) ||
    !isFiniteNumber(position?.y) ||
    !isFiniteNumber(size?.width) ||
    !isFiniteNumber(size?.height)
  ) {
    return null
  }

  // Never larger than the display it is being restored onto.
  nextWidth = Math.min(nextWidth, size.width)
  nextHeight = Math.min(nextHeight, size.height)

  // Keep a grabbable strip on screen horizontally...
  const minX = position.x - nextWidth + MIN_VISIBLE_PX
  const maxX = position.x + size.width - MIN_VISIBLE_PX
  const nextX = Math.min(Math.max(x as number, minX), maxX)

  // ...and keep the title bar reachable vertically, which means the top edge
  // can never sit above the monitor.
  const minY = position.y
  const maxY = position.y + size.height - MIN_VISIBLE_PX
  const nextY = Math.min(Math.max(y as number, minY), maxY)

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight }
}

/**
 * Creates a throttled version of a function that only executes at most once per wait period
 */
function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastCallTime = 0

  return function throttled(...args: Parameters<T>) {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    const executeFunction = () => {
      lastCallTime = Date.now()
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }

    if (timeSinceLastCall >= wait) {
      // If enough time has passed, execute immediately
      executeFunction()
    } else {
      // Otherwise, schedule execution for the remaining wait time
      timeout = setTimeout(executeFunction, wait - timeSinceLastCall)
    }
  }
}

/**
 * Hook to persist window position and size across sessions
 *
 * @example
 * ```tsx
 * function App() {
 *   useWindowState()  // Automatically saves and restores window state
 *   return <div>...</div>
 * }
 * ```
 */
export function useWindowState() {
  useEffect(() => {
    // Nothing to persist outside the desktop app, and getCurrentWindow()
    // would throw here and unmount the whole tree (Issue #144)
    if (!isTauriRuntime()) return

    const window = getCurrentWindow()

    // Restore saved position/size
    const restoreWindowState = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return

        const parsed: unknown = JSON.parse(saved)
        // currentMonitor() can legitimately be null (no monitor reported), in
        // which case we cannot verify the state is on-screen -- so we don't
        // restore it rather than risk placing the window where it can't be seen.
        const monitor = await currentMonitor().catch(() => null)
        const state = clampWindowState(parsed, monitor)
        if (!state) return

        // PHYSICAL, to match what saveWindowState writes. Restoring physical
        // values as logical multiplied them by the scale factor on every launch,
        // walking the window off-screen. See the note on WindowState.
        await window.setPosition(new PhysicalPosition(state.x, state.y))
        await window.setSize(new PhysicalSize(state.width, state.height))
      } catch {
        // Silently fail if window state can't be restored
      }
    }

    restoreWindowState()

    // Save position/size on changes
    const saveWindowState = async () => {
      try {
        const position = await window.outerPosition()
        const size = await window.outerSize()

        const state: WindowState = {
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        // Drop the pre-fix key so a downgrade cannot resurrect a doubled value.
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      } catch {
        // Silently fail if window state can't be saved
      }
    }

    // Create throttled version of saveWindowState to prevent excessive saves during drag
    const throttledSaveWindowState = throttle(saveWindowState, THROTTLE_MS)

    // Listen for changes
    const setupListeners = async () => {
      const unlistenResize = await window.onResized(() => throttledSaveWindowState())
      const unlistenMove = await window.onMoved(() => throttledSaveWindowState())

      return () => {
        unlistenResize()
        unlistenMove()
      }
    }

    let cleanup: (() => void) | null = null

    setupListeners().then((fn) => {
      cleanup = fn
    })

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [])
}
