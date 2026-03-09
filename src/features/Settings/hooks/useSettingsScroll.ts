/**
 * useSettingsScroll Hook
 *
 * Hash-based scroll-to-section logic for Settings page.
 * Scrolls to the element matching location.hash, or to top when no hash.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useSettingsScroll(): void {
  const location = useLocation()

  useEffect(() => {
    // Small delay to ensure the page is rendered
    setTimeout(() => {
      if (location.hash) {
        const elementId = location.hash.slice(1) // Remove the '#'
        const element = document.getElementById(elementId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      } else {
        // No hash - scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 100)
  }, [location.hash, location.key])
}
