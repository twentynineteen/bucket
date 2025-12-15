/**
 * Component Test: BakerPage
 *
 * Tests for the Baker page component which handles folder scanning
 * and breadcrumbs management functionality.
 */

// Import after mocks
import { useBakerScan } from '@hooks/useBakerScan'
import BakerPage from '@pages/Baker/Baker'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock all the hooks used by BakerPage
vi.mock('@hooks/useBakerScan', () => ({
  useBakerScan: vi.fn(() => ({
    scanResult: null,
    isScanning: false,
    error: null,
    startScan: vi.fn(),
    cancelScan: vi.fn(),
    clearResults: vi.fn()
  }))
}))

vi.mock('@hooks/useBreadcrumbsManager', () => ({
  useBreadcrumbsManager: vi.fn(() => ({
    updateBreadcrumbs: vi.fn(),
    isUpdating: false,
    lastUpdateResult: null,
    clearResults: vi.fn()
  }))
}))

vi.mock('@hooks/useBakerPreferences', () => ({
  useBakerPreferences: vi.fn(() => ({
    preferences: {
      maxDepth: 3,
      includeHidden: false,
      createMissing: true,
      backupOriginals: true
    },
    updatePreferences: vi.fn(),
    resetToDefaults: vi.fn()
  }))
}))

vi.mock('@hooks/useLiveBreadcrumbsReader', () => ({
  useLiveBreadcrumbsReader: vi.fn(() => ({
    breadcrumbs: null,
    isLoading: false,
    error: null,
    readLiveBreadcrumbs: vi.fn(),
    clearBreadcrumbs: vi.fn()
  }))
}))

vi.mock('@hooks/useBreadcrumbsPreview', () => ({
  useBreadcrumbsPreview: vi.fn(() => ({
    previews: new Map(),
    isGenerating: false,
    error: null,
    generatePreview: vi.fn(),
    generateBatchPreviews: vi.fn(),
    clearPreviews: vi.fn(),
    getPreview: vi.fn(),
    hasPreview: vi.fn()
  }))
}))

vi.mock('hooks/useTrelloBoard', () => ({
  useTrelloBoard: vi.fn(() => ({
    apiKey: 'test-api-key',
    token: 'test-token',
    grouped: {},
    isLoading: false
  }))
}))

vi.mock('@hooks/useBakerTrelloIntegration', () => ({
  useBakerTrelloIntegration: vi.fn(() => ({
    updateTrelloCards: vi.fn().mockResolvedValue([])
  }))
}))

vi.mock('hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

// Helper to render with providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BakerPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering Tests', () => {
    test('should render page title', () => {
      renderWithProviders(<BakerPage />)
      expect(screen.getByText('Baker')).toBeInTheDocument()
    })

    test('should render folder selector', () => {
      renderWithProviders(<BakerPage />)
      expect(screen.getByText(/select.*folder/i)).toBeInTheDocument()
    })

    test('should render scan button', () => {
      renderWithProviders(<BakerPage />)
      expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument()
    })
  })

  describe('Scan State Tests', () => {
    test('should show cancel button when scanning', () => {
      vi.mocked(useBakerScan).mockReturnValue({
        scanResult: null,
        isScanning: true,
        error: null,
        startScan: vi.fn(),
        cancelScan: vi.fn(),
        clearResults: vi.fn()
      })

      renderWithProviders(<BakerPage />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    test('should show error message when scan fails', () => {
      vi.mocked(useBakerScan).mockReturnValue({
        scanResult: null,
        isScanning: false,
        error: 'Failed to scan folder',
        startScan: vi.fn(),
        cancelScan: vi.fn(),
        clearResults: vi.fn()
      })

      renderWithProviders(<BakerPage />)
      expect(screen.getByText(/failed to scan folder/i)).toBeInTheDocument()
    })
  })

  describe('Results Display Tests', () => {
    test('should display project count when results available', () => {
      vi.mocked(useBakerScan).mockReturnValue({
        scanResult: {
          projects: [
            {
              path: '/test/project1',
              name: 'Project 1',
              isValid: true,
              hasBreadcrumbs: true,
              staleBreadcrumbs: false,
              invalidBreadcrumbs: false,
              lastScanned: new Date().toISOString(),
              cameraCount: 2,
              validationErrors: []
            },
            {
              path: '/test/project2',
              name: 'Project 2',
              isValid: true,
              hasBreadcrumbs: false,
              staleBreadcrumbs: false,
              invalidBreadcrumbs: false,
              lastScanned: new Date().toISOString(),
              cameraCount: 1,
              validationErrors: []
            }
          ],
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          rootPath: '/test',
          totalFolders: 10,
          validProjects: 2,
          updatedBreadcrumbs: 0,
          createdBreadcrumbs: 0,
          totalFolderSize: 1024000,
          errors: []
        },
        isScanning: false,
        error: null,
        startScan: vi.fn(),
        cancelScan: vi.fn(),
        clearResults: vi.fn()
      })

      renderWithProviders(<BakerPage />)
      expect(screen.getByText(/2.*projects/i)).toBeInTheDocument()
    })

    test('should display project names in results', () => {
      vi.mocked(useBakerScan).mockReturnValue({
        scanResult: {
          projects: [
            {
              path: '/test/project1',
              name: 'Test Project Alpha',
              isValid: true,
              hasBreadcrumbs: true,
              staleBreadcrumbs: false,
              invalidBreadcrumbs: false,
              lastScanned: new Date().toISOString(),
              cameraCount: 2,
              validationErrors: []
            }
          ],
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          rootPath: '/test',
          totalFolders: 5,
          validProjects: 1,
          updatedBreadcrumbs: 0,
          createdBreadcrumbs: 0,
          totalFolderSize: 512000,
          errors: []
        },
        isScanning: false,
        error: null,
        startScan: vi.fn(),
        cancelScan: vi.fn(),
        clearResults: vi.fn()
      })

      renderWithProviders(<BakerPage />)
      expect(screen.getByText('Test Project Alpha')).toBeInTheDocument()
    })
  })
})
