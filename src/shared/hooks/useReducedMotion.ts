/**
 * useReducedMotion Hook
 *
 * Detects if the user has requested reduced motion via their system preferences.
 * Used to ensure animations respect accessibility requirements (WCAG 2.1 Level AAA).
 *
 * @returns {boolean} true if user prefers reduced motion
 *
 * @example
 * ```tsx
 * const shouldReduceMotion = useReducedMotion()
 *
 * <motion.div
 *   animate={shouldReduceMotion ? {} : { x: 100 }}
 *   transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
 * >
 *   {content}
 * </motion.div>
 * ```
 */

import { useEffect, useState } from 'react'

export const useReducedMotion = (): boolean => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(() => {
    // Initialize with media query result
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      return mediaQuery?.matches || false
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Check if media query is valid
    if (!mediaQuery) {
      return
    }

    // Update state when preference changes
    const handleChange = (event: MediaQueryListEvent) => {
      setShouldReduceMotion(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      }
    }
  }, [])

  return shouldReduceMotion
}
