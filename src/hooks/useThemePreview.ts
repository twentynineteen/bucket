/**
 * useThemePreview Hook
 *
 * Provides live theme preview functionality.
 * Temporarily applies a theme class to <html> on hover without persisting it.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ThemeId } from '@/constants/themes'

interface UseThemePreviewOptions {
  activeTheme: string
  debounceMs?: number
}

export function useThemePreview({
  activeTheme,
  debounceMs = 150
}: UseThemePreviewOptions) {
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isPreviewingRef = useRef(false)

  /**
   * Apply theme preview
   */
  const startPreview = useCallback(
    (themeId: ThemeId | string) => {
      // Clear any pending preview
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }

      // Don't preview the already active theme
      if (themeId === activeTheme) {
        return
      }

      // Debounce the preview application
      previewTimeoutRef.current = setTimeout(() => {
        const html = document.documentElement
        isPreviewingRef.current = true

        // Remove all theme classes
        html.classList.remove(
          'light',
          'dark',
          'dracula',
          'catppuccin-latte',
          'catppuccin-frappe',
          'catppuccin-macchiato',
          'catppuccin-mocha'
        )

        // Apply preview theme (skip 'system' as it's not a CSS class)
        if (themeId !== 'system') {
          html.classList.add(themeId)
        }
      }, debounceMs)
    },
    [activeTheme, debounceMs]
  )

  /**
   * Stop theme preview and restore active theme
   */
  const stopPreview = useCallback(() => {
    // Clear pending preview
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }

    if (!isPreviewingRef.current) {
      return
    }

    const html = document.documentElement

    // Remove all theme classes
    html.classList.remove(
      'light',
      'dark',
      'dracula',
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha'
    )

    // Restore active theme (skip 'system' as it's handled by next-themes)
    if (activeTheme !== 'system') {
      html.classList.add(activeTheme)
    }

    isPreviewingRef.current = false
  }, [activeTheme])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
      // Restore active theme on unmount if we were previewing
      if (isPreviewingRef.current) {
        stopPreview()
      }
    }
  }, [stopPreview])

  return {
    startPreview,
    stopPreview
  }
}
