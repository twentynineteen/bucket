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

// App wraps the whole router in AuthProvider (issue #199 cut that provider back
// to a logout action). If the provider stops rendering standalone, the app is
// blank, so mount the real tree rather than a mocked stand-in.
it('mounts the real provider tree and renders the dashboard shell', async () => {
  render(<App />)

  expect(await screen.findByRole('navigation')).toBeInTheDocument()
})
