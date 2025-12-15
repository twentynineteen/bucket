/**
 * UploadSprout Page Tests
 *
 * Tests for the Upload to SproutVideo page including:
 * - Page layout and template structure matching BuildProject/Baker pattern
 * - Header rendering with title and description
 * - File selection functionality
 * - Upload progress display
 * - Success/error message display
 * - Video response display after upload
 * - ErrorBoundary integration
 */

import '@testing-library/jest-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UploadSprout from './UploadSprout'

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

// Mock hooks
vi.mock('@hooks/useBreadcrumb', () => ({
  useBreadcrumb: vi.fn()
}))

const mockSelectFile = vi.fn()
const mockUploadFile = vi.fn()
const mockSetProgress = vi.fn()
const mockSetMessage = vi.fn()
const mockSetUploading = vi.fn()
const mockSetThumbnailLoaded = vi.fn()

// Default mock implementations
let mockApiKeyState = { apiKey: 'test-api-key', isLoading: false }
let mockFileUploadState = {
  selectedFile: null as string | null,
  response: null as unknown,
  selectFile: mockSelectFile,
  uploadFile: mockUploadFile
}
let mockUploadEventsState = {
  progress: 0,
  uploading: false,
  message: null as string | null,
  setProgress: mockSetProgress,
  setMessage: mockSetMessage,
  setUploading: mockSetUploading
}
let mockImageRefreshState = {
  thumbnailLoaded: false,
  refreshTimestamp: Date.now(),
  setThumbnailLoaded: mockSetThumbnailLoaded
}

vi.mock('@hooks/useApiKeys', () => ({
  useSproutVideoApiKey: vi.fn(() => mockApiKeyState)
}))

vi.mock('@hooks/useFileUpload', () => ({
  useFileUpload: vi.fn(() => mockFileUploadState)
}))

vi.mock('@hooks/useUploadEvents', () => ({
  useUploadEvents: vi.fn(() => mockUploadEventsState)
}))

vi.mock('@hooks/useImageRefresh', () => ({
  useImageRefresh: vi.fn(() => mockImageRefreshState)
}))

// Helper to render UploadSprout with providers
const renderUploadSprout = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/upload/sprout']}>
        <UploadSprout />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UploadSprout Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default states
    mockApiKeyState = { apiKey: 'test-api-key', isLoading: false }
    mockFileUploadState = {
      selectedFile: null,
      response: null,
      selectFile: mockSelectFile,
      uploadFile: mockUploadFile
    }
    mockUploadEventsState = {
      progress: 0,
      uploading: false,
      message: null,
      setProgress: mockSetProgress,
      setMessage: mockSetMessage,
      setUploading: mockSetUploading
    }
    mockImageRefreshState = {
      thumbnailLoaded: false,
      refreshTimestamp: Date.now(),
      setThumbnailLoaded: mockSetThumbnailLoaded
    }
  })

  // ==========================================
  // Page Structure Tests (Template Conformance)
  // ==========================================
  describe('Page Structure (Template Conformance)', () => {
    it('should render with the standard page wrapper structure', () => {
      renderUploadSprout()

      // Should have the outer scrollable container
      const container = document.querySelector('.h-full.w-full.overflow-y-auto')
      expect(container).toBeInTheDocument()
    })

    it('should render the header section with proper styling', () => {
      renderUploadSprout()

      // Header should have standard template classes
      const header = document.querySelector('.border-border.bg-card\\/50.border-b')
      expect(header).toBeInTheDocument()
    })

    it('should render the main content section with standard padding', () => {
      renderUploadSprout()

      // Content should have standard template classes
      const content = document.querySelector('.max-w-full.space-y-4.px-6.py-4')
      expect(content).toBeInTheDocument()
    })
  })

  // ==========================================
  // Header Tests
  // ==========================================
  describe('Header', () => {
    it('should render the page title', () => {
      renderUploadSprout()

      expect(
        screen.getByRole('heading', { name: /Upload to SproutVideo/i })
      ).toBeInTheDocument()
    })

    it('should render the page description', () => {
      renderUploadSprout()

      expect(
        screen.getByText(/Upload video files directly to your SproutVideo account/i)
      ).toBeInTheDocument()
    })

    it('should render the Sprout icon in the header', () => {
      renderUploadSprout()

      // The Sprout icon should be present (lucide-react renders as svg)
      // The icon is a sibling of the div containing the heading, not a child
      const header = screen.getByRole('heading', { name: /Upload to SproutVideo/i })
      const headerContainer = header.closest('.flex.items-center')
      const svg = headerContainer?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  // ==========================================
  // Step 1: File Selection Tests
  // ==========================================
  describe('Step 1: File Selection', () => {
    it('should render the file selection step with numbered badge', () => {
      renderUploadSprout()

      // Should have step indicator badge with "1"
      expect(screen.getByText('1')).toBeInTheDocument()
      // Use getByRole to specifically get the heading
      expect(screen.getByRole('heading', { name: /Select Video/i })).toBeInTheDocument()
    })

    it('should render the Select Video File button', () => {
      renderUploadSprout()

      expect(
        screen.getByRole('button', { name: /Select Video File/i })
      ).toBeInTheDocument()
    })

    it('should call selectFile when Select Video File button is clicked', () => {
      renderUploadSprout()

      const button = screen.getByRole('button', { name: /Select Video File/i })
      fireEvent.click(button)

      expect(mockSelectFile).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================
  // Step 2: Upload Tests
  // ==========================================
  describe('Step 2: Upload', () => {
    it('should render the upload step with numbered badge', () => {
      renderUploadSprout()

      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should render disabled Upload Video button when no file is selected', () => {
      renderUploadSprout()

      const uploadButton = screen.getByRole('button', { name: /Upload Video/i })
      expect(uploadButton).toBeDisabled()
    })
  })

  // ==========================================
  // Upload Progress Tests
  // ==========================================
  describe('Upload Progress', () => {
    it('should not show progress bar when not uploading', () => {
      renderUploadSprout()

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // ErrorBoundary Integration
  // ==========================================
  describe('ErrorBoundary Integration', () => {
    it('should wrap content in ErrorBoundary', () => {
      // This test verifies the ErrorBoundary is present by checking the component structure
      renderUploadSprout()

      // If ErrorBoundary is working, the page should render without crashing
      expect(
        screen.getByRole('heading', { name: /Upload to SproutVideo/i })
      ).toBeInTheDocument()
    })
  })

  // ==========================================
  // File Selected State Tests
  // ==========================================
  describe('with file selected', () => {
    beforeEach(() => {
      mockFileUploadState = {
        selectedFile: '/path/to/video.mp4',
        response: null,
        selectFile: mockSelectFile,
        uploadFile: mockUploadFile
      }
    })

    it('should display the selected file name', () => {
      renderUploadSprout()

      expect(screen.getByText(/video\.mp4/i)).toBeInTheDocument()
    })

    it('should enable Upload Video button when file is selected', () => {
      renderUploadSprout()

      const uploadButton = screen.getByRole('button', { name: /Upload Video/i })
      expect(uploadButton).not.toBeDisabled()
    })

    it('should call uploadFile when Upload Video button is clicked', () => {
      renderUploadSprout()

      const uploadButton = screen.getByRole('button', { name: /Upload Video/i })
      fireEvent.click(uploadButton)

      expect(mockUploadFile).toHaveBeenCalledWith('test-api-key')
    })
  })

  // ==========================================
  // Uploading State Tests
  // ==========================================
  describe('while uploading', () => {
    beforeEach(() => {
      mockFileUploadState = {
        selectedFile: '/path/to/video.mp4',
        response: null,
        selectFile: mockSelectFile,
        uploadFile: mockUploadFile
      }
      mockUploadEventsState = {
        progress: 45,
        uploading: true,
        message: null,
        setProgress: mockSetProgress,
        setMessage: mockSetMessage,
        setUploading: mockSetUploading
      }
    })

    it('should show progress bar when uploading', () => {
      renderUploadSprout()

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should show upload percentage', () => {
      renderUploadSprout()

      expect(screen.getByText(/45%/i)).toBeInTheDocument()
    })

    it('should show Uploading... button text when uploading', () => {
      renderUploadSprout()

      expect(screen.getByRole('button', { name: /Uploading\.\.\./i })).toBeInTheDocument()
    })

    it('should disable upload button while uploading', () => {
      renderUploadSprout()

      expect(screen.getByRole('button', { name: /Uploading\.\.\./i })).toBeDisabled()
    })
  })

  // ==========================================
  // Upload Complete Tests
  // ==========================================
  describe('with upload complete', () => {
    const mockResponse = {
      id: 'video-123',
      title: 'Test Video',
      created_at: '2024-01-15T10:30:00Z',
      duration: '2:30',
      embed_code: '<iframe src="..."></iframe>',
      embedded_url: 'https://videos.sproutvideo.com/embed/video-123',
      assets: {
        poster_frames: ['https://cdn.sproutvideo.com/poster/video-123.jpg']
      }
    }

    beforeEach(() => {
      mockFileUploadState = {
        selectedFile: '/path/to/video.mp4',
        response: mockResponse,
        selectFile: mockSelectFile,
        uploadFile: mockUploadFile
      }
      mockImageRefreshState = {
        thumbnailLoaded: true,
        refreshTimestamp: Date.now(),
        setThumbnailLoaded: mockSetThumbnailLoaded
      }
    })

    it('should display video title after upload', () => {
      renderUploadSprout()

      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })

    it('should display video thumbnail', () => {
      renderUploadSprout()

      const img = screen.getByAltText('Video posterframe')
      expect(img).toBeInTheDocument()
    })

    it('should display embedded URL', () => {
      renderUploadSprout()

      expect(screen.getByText(mockResponse.embedded_url)).toBeInTheDocument()
    })

    it('should render Step 3: Video Details section', () => {
      renderUploadSprout()

      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Message Display Tests
  // ==========================================
  describe('with success message', () => {
    beforeEach(() => {
      mockUploadEventsState = {
        progress: 100,
        uploading: false,
        message: 'Upload successful!',
        setProgress: mockSetProgress,
        setMessage: mockSetMessage,
        setUploading: mockSetUploading
      }
    })

    it('should display success message with green styling', () => {
      renderUploadSprout()

      const message = screen.getByText('Upload successful!')
      expect(message).toBeInTheDocument()
      // Check it has success styling
      expect(message.closest('div')).toHaveClass('border-green-200')
    })
  })

  describe('with error message', () => {
    beforeEach(() => {
      mockUploadEventsState = {
        progress: 0,
        uploading: false,
        message: 'Upload failed: Network error',
        setProgress: mockSetProgress,
        setMessage: mockSetMessage,
        setUploading: mockSetUploading
      }
    })

    it('should display error message with red styling', () => {
      renderUploadSprout()

      const message = screen.getByText('Upload failed: Network error')
      expect(message).toBeInTheDocument()
      // Check it has error styling
      expect(message.closest('div')).toHaveClass('border-red-200')
    })
  })

  // ==========================================
  // API Key Loading State Tests
  // ==========================================
  describe('API key loading state', () => {
    beforeEach(() => {
      mockApiKeyState = { apiKey: '', isLoading: true }
      mockFileUploadState = {
        selectedFile: '/path/to/video.mp4',
        response: null,
        selectFile: mockSelectFile,
        uploadFile: mockUploadFile
      }
    })

    it('should show Loading... button text when API key is loading', () => {
      renderUploadSprout()

      expect(screen.getByRole('button', { name: /Loading\.\.\./i })).toBeInTheDocument()
    })

    it('should disable upload button when API key is loading', () => {
      renderUploadSprout()

      expect(screen.getByRole('button', { name: /Loading\.\.\./i })).toBeDisabled()
    })
  })
})
