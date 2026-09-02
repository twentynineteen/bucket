import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

// Mock next-themes before importing App to avoid matchMedia errors
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark']
  })
}))

import App from './App'

// `mockReset: true` in vite.config.ts wipes the matchMedia implementation the
// shared setup installs, and the sidebar's useIsMobile calls
// matchMedia(...).addEventListener. Reinstall it per test.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// App composes the theme, query, error-boundary and router providers by hand.
// #206 removed AuthProvider from between them, and mis-nesting any of the rest
// leaves the app blank, so mount the real tree rather than a mocked stand-in.
it('mounts the real provider tree and renders the dashboard shell', async () => {
  render(<App />)

  expect(await screen.findByRole('navigation')).toBeInTheDocument()
})

// #278 moved the Suspense boundary from wrapping the whole AppRouter to inside
// the dashboard Page, around the routed Outlet. The navigation lives in the
// sidebar, outside that boundary, so it must mount immediately -- without waiting
// on the lazy route chunk. Asserting synchronously (getByRole, not findByRole)
// proves the shell is present on the same tick the routed chunk is still loading.
it('renders the navigation shell synchronously while the routed chunk loads', () => {
  render(<App />)

  // The sidebar is not lazy, so the nav is on the page before any chunk resolves.
  expect(screen.getByRole('navigation')).toBeInTheDocument()
  // ...and the routed content region shows the Suspense fallback in the meantime.
  expect(screen.getByRole('status', { name: /loading page/i })).toBeInTheDocument()
})
