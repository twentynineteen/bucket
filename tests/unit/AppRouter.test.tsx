import { AppRouter } from '@/AppRouter'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn()
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn()
}))

// Mock all page components
vi.mock('@/app/dashboard/page', () => ({
  default: () => <div data-testid="page-layout">Page Layout</div>
}))

vi.mock('@pages/AI/ExampleEmbeddings/ExampleEmbeddings', () => ({
  ExampleEmbeddings: () => <div>Example Embeddings</div>
}))

vi.mock('@pages/AI/ScriptFormatter/ScriptFormatter', () => ({
  default: () => <div>Script Formatter</div>
}))

vi.mock('@pages/auth/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}))

vi.mock('@pages/auth/Register', () => ({
  default: () => <div data-testid="register-page">Register Page</div>
}))

vi.mock('@pages/Baker/Baker', () => ({
  default: () => <div>Baker</div>
}))

vi.mock('@pages/BuildProject/BuildProject', () => ({
  default: () => <div data-testid="build-project">Build Project</div>
}))

vi.mock('@pages/ConnectedApps', () => ({
  default: () => <div>Connected Apps</div>
}))

vi.mock('@pages/IngestHistory', () => ({
  default: () => <div>Ingest History</div>
}))

vi.mock('@pages/Posterframe', () => ({
  default: () => <div>Posterframe</div>
}))

vi.mock('@pages/Settings', () => ({
  default: () => <div>Settings</div>
}))

vi.mock('@pages/UploadOtter', () => ({
  default: () => <div>Upload Otter</div>
}))

vi.mock('@pages/UploadSprout', () => ({
  default: () => <div>Upload Sprout</div>
}))

vi.mock('@pages/UploadTrello', () => ({
  default: () => <div>Upload Trello</div>
}))

describe('AppRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set NODE_ENV to test to skip update logic
    process.env.NODE_ENV = 'test'
  })

  describe('routing behavior', () => {
    it('should redirect to /ingest/build when authenticated and accessing root', async () => {
      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(window.location.pathname).toBe('/ingest/build')
      })
    })

    it('should render Page layout component when on protected routes', async () => {
      window.history.pushState({}, 'Test page', '/ingest/build')

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument()
      })
    })
  })

  describe('auto-updater logic', () => {
    it('should skip update check in development mode', async () => {
      process.env.NODE_ENV = 'development'
      const { check } = await import('@tauri-apps/plugin-updater')

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(check).not.toHaveBeenCalled()
      })
    })

    it('should check for updates in production mode', async () => {
      process.env.NODE_ENV = 'production'
      const { check } = await import('@tauri-apps/plugin-updater')
      vi.mocked(check).mockResolvedValue(null as any)

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(check).toHaveBeenCalled()
      })
    })

    it('should handle update available with download and install', async () => {
      process.env.NODE_ENV = 'production'
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')

      const mockDownloadAndInstall = vi.fn(async callback => {
        // Simulate download events
        callback({ event: 'Started', data: { contentLength: 1000 } })
        callback({ event: 'Progress', data: { chunkLength: 500 } })
        callback({ event: 'Progress', data: { chunkLength: 500 } })
        callback({ event: 'Finished' })
      })

      vi.mocked(check).mockResolvedValue({
        version: '1.2.3',
        downloadAndInstall: mockDownloadAndInstall
      } as any)

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(mockDownloadAndInstall).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(relaunch).toHaveBeenCalled()
      })
    })

    it('should handle update check errors gracefully', async () => {
      process.env.NODE_ENV = 'production'
      const { check } = await import('@tauri-apps/plugin-updater')

      vi.mocked(check).mockRejectedValue(new Error('Network error'))

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(check).toHaveBeenCalled()
      })

      // Should not crash the app - page layout should still render
      expect(screen.getByTestId('page-layout')).toBeInTheDocument()
    })

    it('should handle no update available', async () => {
      process.env.NODE_ENV = 'production'
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')

      vi.mocked(check).mockResolvedValue({} as any) // No version means no update

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(check).toHaveBeenCalled()
      })

      // Should not attempt relaunch
      expect(relaunch).not.toHaveBeenCalled()
    })

    it('should handle download progress events correctly', async () => {
      process.env.NODE_ENV = 'production'
      const { check } = await import('@tauri-apps/plugin-updater')

      let progressCallback: any

      const mockDownloadAndInstall = vi.fn(async callback => {
        progressCallback = callback
        callback({ event: 'Started', data: { contentLength: 1000 } })
        callback({ event: 'Progress', data: { chunkLength: 250 } })
        callback({ event: 'Progress', data: { chunkLength: 250 } })
        callback({ event: 'Progress', data: { chunkLength: 250 } })
        callback({ event: 'Progress', data: { chunkLength: 250 } })
        callback({ event: 'Finished' })
      })

      vi.mocked(check).mockResolvedValue({
        version: '1.2.3',
        downloadAndInstall: mockDownloadAndInstall
      } as any)

      render(
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(mockDownloadAndInstall).toHaveBeenCalled()
      })

      // Verify all progress events were handled without errors
      expect(progressCallback).toBeDefined()
    })
  })
})
