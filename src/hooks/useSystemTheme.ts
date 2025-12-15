import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type SystemTheme = 'light' | 'dark' | null

/**
 * Hook to detect and respond to macOS system theme changes
 *
 * @returns The current system theme ('light' | 'dark' | null)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const theme = useSystemTheme()
 *
 *   useEffect(() => {
 *     if (theme) {
 *       console.log('System theme changed to:', theme)
 *     }
 *   }, [theme])
 * }
 * ```
 */
export function useSystemTheme() {
  const [theme, setTheme] = useState<SystemTheme>(null)

  useEffect(() => {
    const window = getCurrentWindow()

    // Get initial theme
    const getTheme = async () => {
      try {
        const currentTheme = await window.theme()
        setTheme(currentTheme)
      } catch {
        // Silently fail if theme can't be retrieved
      }
    }

    getTheme()

    // Listen for theme changes
    const setupListener = async () => {
      const unlisten = await window.onThemeChanged((event) => {
        setTheme(event.payload as SystemTheme)
      })

      return unlisten
    }

    let unlistenFn: (() => void) | null = null

    setupListener().then((fn) => {
      unlistenFn = fn
    })

    return () => {
      if (unlistenFn) {
        unlistenFn()
      }
    }
  }, [])

  return theme
}
