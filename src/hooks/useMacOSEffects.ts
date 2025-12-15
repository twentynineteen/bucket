import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSystemTheme } from './useSystemTheme'

export type MacOSEffect =
  | 'Sidebar'
  | 'ContentBackground'
  | 'UnderWindowBackground'
  | 'WindowBackground'
  | 'HeaderView'
  | 'Menu'
  | 'Popover'
  | 'Tooltip'
  | 'Sheet'
  | 'HudWindow'
  | 'FullScreenUI'

interface UseMacOSEffectsOptions {
  effects?: MacOSEffect[]
  enabled?: boolean
  adjustForTheme?: boolean
}

/**
 * Apply native macOS vibrancy effects to the window
 *
 * @example
 * ```tsx
 * function Sidebar() {
 *   useMacOSEffects({ effects: ['Sidebar'], adjustForTheme: true })
 *   return <div>...</div>
 * }
 * ```
 */
export function useMacOSEffects({
  effects = ['Sidebar'],
  enabled = true,
  adjustForTheme = false
}: UseMacOSEffectsOptions = {}) {
  const theme = useSystemTheme()

  useEffect(() => {
    if (!enabled) return

    const applyEffects = async () => {
      // Only apply on macOS
      if (!navigator.platform.includes('Mac')) return

      try {
        const window = getCurrentWindow()

        // Optionally adjust effects based on theme
        let activeEffects = effects
        if (adjustForTheme && theme === 'dark') {
          // Could use different effects for dark mode if desired
          // For now, using the same effects
          activeEffects = effects
        }

        await window.setEffects({
          effects: activeEffects,
          state: 'active',
          radius: 0
        })
      } catch {
        // Silently fail if effects can't be applied
      }
    }

    applyEffects()

    // Cleanup function to remove effects
    return () => {
      const removeEffects = async () => {
        if (!navigator.platform.includes('Mac')) return

        try {
          const window = getCurrentWindow()
          await window.clearEffects()
        } catch {
          // Silently fail if effects can't be cleared
        }
      }
      removeEffects()
    }
  }, [effects, enabled, theme, adjustForTheme])
}
