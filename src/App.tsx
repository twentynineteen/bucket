import { useWindowState } from '@shared/hooks/useWindowState'
import {
  createQueryClient,
  initializePerformanceMonitor,
  initializePrefetchManager
} from '@shared/lib'
import { initializeCacheService } from '@shared/services'
import { logger } from '@shared/utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import React from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import AppRouter from './AppRouter'
import { QueryErrorBoundary } from './shared/ui/layout/ErrorBoundary'
import { TitleBar } from './shared/ui/layout/TitleBar'
import { Toaster } from './shared/ui/sonner'

// The app component acts as the main routing generator for the application.
// AppRouter wraps the app routes to make use of the useLocation method within react-router-dom
// The top level component, Page, acts as the provider for the layout
// subsequent components are loaded within the page window via the Outlet component.

const queryClient = createQueryClient()

// Initialize performance and cache management services
initializeCacheService(queryClient)
const prefetchManager = initializePrefetchManager(queryClient)
initializePerformanceMonitor(queryClient)

// Prefetch essential app data on startup (non-blocking)
prefetchManager.prefetchAppStartupData().catch(error => {
  logger.warn('Startup prefetching failed:', error)
  // Non-critical - app continues to work normally
})

const App: React.FC = () => {
  // Persist window position and size across sessions
  useWindowState()

  // next-themes renders an inline anti-flash script meant for server rendering. This app
  // renders only on the client, where React never runs it, and React 19.3 logs an error for
  // it. scriptProps marks it a data block, which keeps it inert and silent.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      scriptProps={{ type: 'application/json' }}
      themes={[
        'system',
        'light',
        'dark',
        'dracula',
        'tokyo-night',
        'catppuccin-latte',
        'catppuccin-frappe',
        'catppuccin-macchiato',
        'catppuccin-mocha',
        'solarized-light',
        'github-light',
        'nord-light',
        'one-light'
      ]}
      enableSystem
      storageKey="theme"
    >
      <QueryClientProvider client={queryClient}>
        <QueryErrorBoundary>
          <Router>
            <TitleBar />
            {/* The Suspense + chunk-error boundary now live inside the dashboard
                Page, around the routed Outlet (#278), so the navigation shell
                stays mounted while a lazy route chunk loads. */}
            <AppRouter />
          </Router>
        </QueryErrorBoundary>
        <Toaster />
        {/* React Query DevTools - only shows in development */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
