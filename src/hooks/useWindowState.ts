import { useEffect } from 'react'
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window'

interface WindowState {
  x: number
  y: number
  width: number
  height: number
}

const STORAGE_KEY = 'bucket-window-state'
const THROTTLE_MS = 500 // Maximum 1 save per 500ms during window movement

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
    const window = getCurrentWindow()

    // Restore saved position/size
    const restoreWindowState = async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (!saved) return

        const state: WindowState = JSON.parse(saved)
        await window.setPosition(new LogicalPosition(state.x, state.y))
        await window.setSize(new LogicalSize(state.width, state.height))
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
