import React from 'react'

/**
 * Minimal centered spinner shown as Suspense fallback while lazy-loaded
 * route chunks are being fetched. Renders only in the content area --
 * the sidebar and title bar stay outside the Suspense boundary.
 */
export const RouteLoadingSpinner: React.FC = () => {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary"
        role="status"
        aria-label="Loading page"
      />
    </div>
  )
}
