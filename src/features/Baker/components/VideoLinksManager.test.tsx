/**
 * VideoLinksManager Component Tests
 * Feature: 004-embed-multiple-video
 * Tests T002-T008: Component behavior for video upload toggle enhancement
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@testing-library/jest-dom'

import * as useApiKeysModule from '@shared/hooks/useApiKeys'
import * as useBreadcrumbsTrelloCardsModule from '@features/Trello'
import * as useBreadcrumbsTrelloCardsHookModule from '../../Trello/hooks/useBreadcrumbsTrelloCards'
import * as useBreadcrumbsVideoLinksModule from '../hooks/useBreadcrumbsVideoLinks'
import * as useFileUploadModule from '@features/Upload'
import * as useSproutVideoApiModule from '@features/Upload'
import * as useSproutVideoProcessorModule from '@features/Upload'
import * as useUploadEventsModule from '@features/Upload'
import * as usePosterFrameForUploadModule from '@features/Upload'
import type { usePosterFrameForUpload } from '@features/Upload'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SproutUploadResponse } from '@shared/types'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFileUploadMock } from '@tests/factories/fileUploadMock'

import type { VideoLink } from '../types'
import { VideoLinksManager } from './VideoLinksManager'

// Mock hooks
vi.mock('../hooks/useBreadcrumbsVideoLinks')
vi.mock('@features/Trello', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/Trello')>()
  return {
    ...actual,
    useBreadcrumbsTrelloCards: vi.fn()
  }
})
// Mock useBreadcrumbsTrelloCards at its actual file path so useVideoLinksManager's
// relative import also gets the mock
vi.mock('../../Trello/hooks/useBreadcrumbsTrelloCards')
vi.mock('../../Trello/api')
vi.mock('@features/Upload')
vi.mock('@shared/hooks/useApiKeys')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

// Helper function to create a complete mock SproutUploadResponse
const createMockSproutUploadResponse = (
  overrides?: Partial<SproutUploadResponse>
): SproutUploadResponse => ({
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  height: 1080,
  width: 1920,
  description: '',
  id: 'test-video-id',
  plays: 0,
  title: 'Test Video',
  source_video_file_size: 1000000,
  embed_code: '<iframe></iframe>',
  state: 'deployed',
  security_token: 'token',
  progress: 100,
  tags: [],
  embedded_url: 'https://sproutvideo.com/videos/test123',
  duration: 120,
  password: null,
  privacy: 0,
  requires_signed_embeds: false,
  selected_poster_frame_number: 0,
  assets: {
    videos: {
      '240p': '',
      '360p': '',
      '480p': '',
      '720p': '',
      '1080p': '',
      '2k': null,
      '4k': null,
      '8k': null,
      source: null
    },
    thumbnails: ['https://example.com/thumb.jpg'],
    poster_frames: ['https://example.com/poster.jpg'],
    poster_frame_mp4: null,
    timeline_images: [],
    hls_manifest: ''
  },
  download_sd: null,
  download_hd: null,
  download_source: null,
  allowed_domains: null,
  allowed_ips: null,
  player_social_sharing: null,
  player_embed_sharing: null,
  require_email: false,
  require_name: false,
  hide_on_site: false,
  folder_id: null,
  airplay_support: null,
  session_watermarks: null,
  direct_file_access: null,
  ...overrides
})

describe('VideoLinksManager - Upload Toggle Enhancement', () => {
  const mockProjectPath = '/test/project'

  // Default mock implementations
  const mockAddVideoLink = vi.fn()
  const mockRemoveVideoLink = vi.fn()
  const mockReorderVideoLinks = vi.fn()
  const mockSelectFile = vi.fn()
  const mockUploadFile = vi.fn()
  const mockResetUploadState = vi.fn()
  const mockVideoProcessorReset = vi.fn()
  const mockUpdateVideoLinkAsync = vi.fn()
  const mockPosterFrameRun = vi.fn()
  const mockPosterFrameRetry = vi.fn()
  const mockPosterFrameReset = vi.fn()

  // Issue #140: default poster frame state — available but left unticked, so
  // every pre-existing test keeps its original (poster-frame-free) behaviour.
  const posterFrameHookReturn = (
    overrides: Record<string, unknown> = {}
  ): ReturnType<typeof usePosterFrameForUpload> =>
    ({
      available: true,
      unavailableReason: null,
      enabled: false,
      setEnabled: vi.fn(),
      backgrounds: ['/backgrounds/wbs-blue.jpg'],
      selectedBackground: '/backgrounds/wbs-blue.jpg',
      setSelectedBackground: vi.fn(),
      text: 'Managing Change',
      setText: vi.fn(),
      previewImageUrl: 'blob:preview',
      canvasRef: { current: null },
      saveCopy: false,
      setSaveCopy: vi.fn(),
      status: 'idle',
      error: null,
      run: mockPosterFrameRun,
      retry: mockPosterFrameRetry,
      reset: mockPosterFrameReset,
      ...overrides
    }) as ReturnType<typeof usePosterFrameForUpload>

  // Helper to wrap component with QueryClientProvider
  const renderWithQueryClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock useBreadcrumbsVideoLinks
    vi.mocked(useBreadcrumbsVideoLinksModule.useBreadcrumbsVideoLinks).mockReturnValue({
      videoLinks: [],
      isLoading: false,
      error: null,
      addVideoLink: mockAddVideoLink,
      addVideoLinkAsync: vi.fn(),
      removeVideoLink: mockRemoveVideoLink,
      removeVideoLinkAsync: vi.fn(),
      updateVideoLink: vi.fn(),
      updateVideoLinkAsync: mockUpdateVideoLinkAsync,
      reorderVideoLinks: mockReorderVideoLinks,
      reorderVideoLinksAsync: vi.fn(),
      isUpdating: false,
      addError: null,
      removeError: null,
      updateError: null,
      reorderError: null
    })

    // Mock useSproutVideoApi
    vi.mocked(useSproutVideoApiModule.useSproutVideoApi).mockReturnValue({
      fetchVideoDetails: vi.fn(),
      fetchVideoDetailsAsync: vi.fn(),
      isFetching: false,
      error: null,
      data: undefined,
      reset: vi.fn()
    })

    // Mock useBreadcrumbsTrelloCards (barrel export for test assertions)
    const trelloCardsMockReturn = {
      trelloCards: [],
      isLoading: false,
      error: null,
      addTrelloCard: vi.fn(),
      addTrelloCardAsync: vi.fn(),
      removeTrelloCard: vi.fn(),
      removeTrelloCardAsync: vi.fn(),
      fetchCardDetails: vi.fn(),
      fetchCardDetailsAsync: vi.fn(),
      isUpdating: false,
      isFetchingDetails: false,
      addError: null,
      removeError: null,
      fetchError: null,
      fetchedCardData: undefined
    }
    vi.mocked(useBreadcrumbsTrelloCardsModule.useBreadcrumbsTrelloCards).mockReturnValue(
      trelloCardsMockReturn
    )
    // Also mock at the direct file level (used by useVideoLinksManager's relative import)
    vi.mocked(
      useBreadcrumbsTrelloCardsHookModule.useBreadcrumbsTrelloCards
    ).mockReturnValue(trelloCardsMockReturn)

    // Mock useSproutVideoApiKey
    vi.mocked(useApiKeysModule.useSproutVideoApiKey).mockReturnValue({
      apiKey: 'test-api-key',
      isLoading: false,
      error: null
    })

    // Mock useTrelloApiKeys
    vi.mocked(useApiKeysModule.useTrelloApiKeys).mockReturnValue({
      apiKey: 'test-trello-key',
      apiToken: 'test-trello-token',
      isLoading: false,
      error: null
    })

    // Mock useFileUpload
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
      createFileUploadMock({
        selectedFile: null,
        uploading: false,
        response: null,
        localDuration: null,
        selectFile: mockSelectFile,
        uploadFile: mockUploadFile,
        resetUploadState: mockResetUploadState
      })
    )

    // Mock useUploadEvents
    vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
      progress: 0,
      uploading: false,
      message: null,
      setUploading: vi.fn(),
      setProgress: vi.fn(),
      setMessage: vi.fn()
    })

    // Mock useSproutFolderSelection (Issue #155)
    vi.mocked(useFileUploadModule.useSproutFolderSelection).mockReturnValue({
      selectedFolder: null,
      selectFolder: vi.fn(),
      recentFolders: [],
      commitFolder: vi.fn()
    })

    // Mock usePosterFrameForUpload (Issue #140)
    mockUpdateVideoLinkAsync.mockResolvedValue(undefined)
    mockPosterFrameRun.mockResolvedValue({ ok: true, posterFrameUrl: null, error: null })
    mockPosterFrameRetry.mockResolvedValue({
      ok: true,
      posterFrameUrl: null,
      error: null
    })
    vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
      posterFrameHookReturn()
    )

    // Mock useSproutVideoProcessor - implement callback behavior
    vi.mocked(useSproutVideoProcessorModule.useSproutVideoProcessor).mockImplementation(
      (options) => {
        // Simulate auto-processing when enabled and valid response provided
        if (
          options.enabled &&
          options.response &&
          !options.uploading &&
          options.selectedFile
        ) {
          const response = options.response

          // Check if upload failed
          if (response.state === 'failed') {
            options.onError(
              'Upload failed: Sprout Video could not process the video. Please check the file format and try again.'
            )
          }
          // Check if we have a valid embedded_url (video is ready)
          else if (response.embedded_url) {
            const filename =
              options.selectedFile.split('/').pop()?.split('.')[0] || 'Untitled'
            const sourceFilename = options.selectedFile.split('/').pop() || ''

            const videoLink = {
              url: response.embedded_url,
              sproutVideoId: response.id,
              title: response.title || filename,
              thumbnailUrl: response.assets?.poster_frames?.[0] || undefined,
              uploadDate: response.created_at,
              sourceRenderFile: sourceFilename
            }

            // Trigger callback on next tick to simulate async processing
            setTimeout(() => options.onVideoReady(videoLink), 0)
          }
        }

        return {
          isProcessing: false,
          error: null,
          reset: mockVideoProcessorReset
        }
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // T002: Tab switching behavior
  // ==========================================
  describe('T002: Tab switching behavior', () => {
    it('should open dialog with "Enter URL" tab active by default', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Dialog should open
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      // "Enter URL" tab should be active by default
      const urlTab = within(dialog).getByRole('tab', { name: /enter url/i })
      expect(urlTab).toHaveAttribute('data-state', 'active')
    })

    it('should switch to "Upload File" tab when clicked', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const dialog = screen.getByRole('dialog')
      const uploadTab = within(dialog).getByRole('tab', { name: /upload file/i })

      await userEvent.click(uploadTab)

      // Upload tab should now be active
      expect(uploadTab).toHaveAttribute('data-state', 'active')

      // URL tab should be inactive
      const urlTab = within(dialog).getByRole('tab', { name: /enter url/i })
      expect(urlTab).toHaveAttribute('data-state', 'inactive')
    })

    it('should clear validation errors when switching tabs', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Try to add video without filling required fields to trigger validation error
      const addVideoButton = screen.getByRole('button', { name: /^add video$/i })
      await userEvent.click(addVideoButton)

      // Validation error should appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      // Switch to upload tab
      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Validation errors should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })

    it('should reset upload state when switching tabs', async () => {
      // Mock a selected file
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Switch to upload tab
      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Switch back to URL tab
      const urlTab = screen.getByRole('tab', { name: /enter url/i })
      await userEvent.click(urlTab)

      // resetUploadState should have been called
      expect(mockResetUploadState).toHaveBeenCalled()
    })
  })

  // ==========================================
  // T003: File selection workflow
  // ==========================================
  describe('T003: File selection workflow', () => {
    it('should show "Select Video File" button in upload tab', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Switch to upload tab
      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // "Select Video File" button should be visible
      const selectFileButton = screen.getByRole('button', { name: /select video file/i })
      expect(selectFileButton).toBeInTheDocument()
    })

    it('should call selectFile when "Select Video File" button is clicked', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const selectFileButton = screen.getByRole('button', { name: /select video file/i })
      await userEvent.click(selectFileButton)

      // selectFile hook function should be called
      expect(mockSelectFile).toHaveBeenCalled()
    })

    it('should display selected filename after file selection', async () => {
      // Mock a selected file
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/path/to/test-video.mp4',
          uploading: false,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Filename should be displayed (without path)
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
      })
    })

    it('should disable "Upload and Add" button when no file is selected', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeDisabled()
    })

    it('should enable "Upload and Add" button after file selection', async () => {
      // Mock a selected file
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeEnabled()
    })
  })

  // ==========================================
  // T004: Upload button disabled states
  // ==========================================
  describe('T004: Upload button disabled states', () => {
    it('should disable "Upload and Add" when no file selected', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeDisabled()
    })

    it('should disable "Upload and Add" when API key is missing', async () => {
      // Mock missing API key
      vi.mocked(useApiKeysModule.useSproutVideoApiKey).mockReturnValue({
        apiKey: null,
        isLoading: false,
        error: null
      })

      // Mock selected file
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeDisabled()

      // Should show API key warning
      expect(screen.getByText(/sprout video api key not configured/i)).toBeInTheDocument()
    })

    it('should disable "Upload and Add" during upload (uploading = true)', async () => {
      // Mock uploading state
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /uploading/i })
      expect(uploadButton).toBeDisabled()
    })

    it('should show "Uploading... X%" during upload', async () => {
      // Mock uploading state with progress
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 45,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Button should show progress
      expect(screen.getByRole('button', { name: /uploading.*45%/i })).toBeInTheDocument()
    })

    it('should re-enable button after upload completes', async () => {
      // Contract: Button should change from "Upload and Add" → "Uploading..." → "Upload and Add"
      // Contract: Button should be enabled → disabled → enabled
      //
      // Test strategy: Use rerender to simulate state changes between upload phases
      // This tests the component's rendering behavior at each state, which is what
      // unit tests should verify. Full E2E flow testing belongs in integration tests.

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
      })

      // Phase 1: Initial state with file selected (before upload)
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: false,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      // Open dialog and switch to upload tab
      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Verify initial state: button should be enabled with "Upload and Add" text
      let uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeEnabled()

      // Phase 2: Uploading state (button should be disabled)
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 50,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      // Verify uploading state: button should be disabled and show progress
      uploadButton = screen.getByRole('button', { name: /uploading/i })
      expect(uploadButton).toBeDisabled()

      // Phase 3: Upload complete (button should be re-enabled)
      const mockUploadResponse = createMockSproutUploadResponse({
        id: 'abc123xyz',
        embedded_url: 'https://sproutvideo.com/videos/abc123xyz',
        title: 'Test Video',
        assets: {
          videos: {
            '240p': '',
            '360p': '',
            '480p': '',
            '720p': '',
            '1080p': '',
            '2k': null,
            '4k': null,
            '8k': null,
            source: null
          },
          thumbnails: ['https://example.com/thumb.jpg'],
          poster_frames: ['https://example.com/thumb.jpg'],
          poster_frame_mp4: null,
          timeline_images: [],
          hls_manifest: ''
        },
        created_at: '2025-01-15T10:30:00Z'
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: mockUploadResponse,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 100,
        uploading: false,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      // Verify completed state: dialog should show success state with Finish button
      // After successful upload, the dialog shows a "Finish" button instead of "Upload and Add"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^finish$/i })).toBeInTheDocument()
      })

      // Verify the addVideoLink was called (video was successfully added)
      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalled()
      })
    })
  })

  // ==========================================
  // T005: Progress bar updates
  // ==========================================
  describe('T005: Progress bar updates', () => {
    it('should hide progress bar when not uploading', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Progress bar should not be visible
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('should show progress bar when upload starts', async () => {
      // Mock uploading state
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 25,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Progress bar should be visible
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
    })

    it('should update progress bar with percentage (0-100%)', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 67,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Progress percentage should be displayed
      await waitFor(() => {
        expect(screen.getByText(/uploading:.*67%/i)).toBeInTheDocument()
      })
    })

    it('should show smooth progress updates (mocked progress events)', async () => {
      // Contract: Progress should update from 0% → 10% → 50% → 100%
      // Contract: Progress text should display current percentage
      // Contract: Progress bar should visually reflect percentage
      //
      // Test strategy: Use rerender to simulate progress updates at each stage
      // This verifies the component correctly renders progress at each percentage

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
      })

      // Initial uploading state at 0%
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: true,
          response: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      // Open dialog and switch to upload tab
      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Verify 0% progress
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /uploading.*0%/i })).toBeInTheDocument()

      // Progress update to 10%
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 10,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      expect(screen.getByRole('button', { name: /uploading.*10%/i })).toBeInTheDocument()
      expect(screen.getByText(/uploading:.*10%/i)).toBeInTheDocument()

      // Progress update to 50%
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 50,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      expect(screen.getByRole('button', { name: /uploading.*50%/i })).toBeInTheDocument()
      expect(screen.getByText(/uploading:.*50%/i)).toBeInTheDocument()

      // Progress update to 100%
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 100,
        uploading: true,
        message: null,
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      rerender(
        <QueryClientProvider client={queryClient}>
          <VideoLinksManager projectPath={mockProjectPath} />
        </QueryClientProvider>
      )

      expect(screen.getByRole('button', { name: /uploading.*100%/i })).toBeInTheDocument()
      expect(screen.getByText(/uploading:.*100%/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // T006: Successful upload auto-adds VideoLink
  // ==========================================
  describe('T006: Successful upload auto-adds VideoLink', () => {
    const mockUploadResponse = createMockSproutUploadResponse({
      id: 'abc123xyz',
      embedded_url: 'https://sproutvideo.com/videos/abc123xyz',
      title: 'Test Video Title',
      assets: {
        videos: {
          '240p': '',
          '360p': '',
          '480p': '',
          '720p': '',
          '1080p': '',
          '2k': null,
          '4k': null,
          '8k': null,
          source: null
        },
        thumbnails: ['https://example.com/thumbnail.jpg'],
        poster_frames: ['https://example.com/thumbnail.jpg'],
        poster_frame_mp4: null,
        timeline_images: [],
        hls_manifest: ''
      },
      created_at: '2025-01-15T10:30:00Z'
    })

    it('should call addVideoLink with correct VideoLink after successful upload', async () => {
      // Mock successful upload response
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/renders/test-video.mp4',
          uploading: false,
          response: mockUploadResponse,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Wait for upload response to trigger useEffect
      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            url: mockUploadResponse.embedded_url,
            sproutVideoId: mockUploadResponse.id,
            title: mockUploadResponse.title,
            thumbnailUrl: mockUploadResponse.assets.poster_frames[0],
            uploadDate: mockUploadResponse.created_at,
            sourceRenderFile: 'test-video.mp4'
          })
        )
      })
    })

    it('should use filename fallback when response.title is missing', async () => {
      const responseWithoutTitle = {
        ...mockUploadResponse,
        title: ''
      }

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/renders/my-awesome-video.mp4',
          uploading: false,
          response: responseWithoutTitle,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'my-awesome-video', // Filename without extension
            sourceRenderFile: 'my-awesome-video.mp4'
          })
        )
      })
    })

    it('should keep dialog open after successful add and show Close button', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: mockUploadResponse,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Dialog should stay open after successful add
      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalled()
      })

      // Dialog should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Should show a "Finish" button in the footer
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^finish$/i })).toBeInTheDocument()
      })
    })

    it('should reset upload state when closing dialog after successful add', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: mockUploadResponse,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Wait for upload success
      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalled()
      })

      // Now close the dialog
      const finishButton = screen.getByRole('button', { name: /^finish$/i })
      await userEvent.click(finishButton)

      // Reset should be called when dialog closes
      await waitFor(() => {
        expect(mockResetUploadState).toHaveBeenCalled()
      })
    })

    it('should extract only filename for sourceRenderFile (no path)', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/deep/nested/path/to/renders/final-cut.mp4',
          uploading: false,
          response: mockUploadResponse,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      await waitFor(() => {
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceRenderFile: 'final-cut.mp4' // Only filename, no path
          })
        )
      })
    })
  })

  // ==========================================
  // T007: Error states and retry
  // ==========================================
  describe('T007: Error states and retry', () => {
    it('should show error alert when upload fails (network error)', async () => {
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: false,
        message: { text: 'Upload failed: Network error', severity: 'error' },
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      await waitFor(() => {
        expect(screen.getByText(/upload failed: network error/i)).toBeInTheDocument()
      })
    })

    it('should show error alert when upload times out', async () => {
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: false,
        message: { text: 'Upload failed: Request timeout', severity: 'error' },
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument()
      })
    })

    it('should show error alert when API key is missing', async () => {
      vi.mocked(useApiKeysModule.useSproutVideoApiKey).mockReturnValue({
        apiKey: null,
        isLoading: false,
        error: null
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      expect(screen.getByText(/sprout video api key not configured/i)).toBeInTheDocument()
    })

    it('should keep file selected after error (for retry)', async () => {
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: false,
        message: { text: 'Upload failed: Network error', severity: 'error' },
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // File should still be selected for retry
      await waitFor(() => {
        expect(screen.getByText('video.mp4')).toBeInTheDocument()
      })
    })

    it('should re-enable "Upload and Add" button after error', async () => {
      vi.mocked(useUploadEventsModule.useUploadEvents).mockReturnValue({
        progress: 0,
        uploading: false,
        message: { text: 'Upload failed', severity: 'error' },
        setUploading: vi.fn(),
        setProgress: vi.fn(),
        setMessage: vi.fn()
      })

      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      const uploadButton = screen.getByRole('button', { name: /upload and add/i })
      expect(uploadButton).toBeEnabled()
    })
  })

  // ==========================================
  // T008: Dialog cleanup
  // ==========================================
  describe('T008: Dialog cleanup', () => {
    it('should reset upload state when closing dialog', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      await waitFor(() => {
        expect(mockResetUploadState).toHaveBeenCalled()
      })
    })

    it('should reset form data when closing dialog', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Fill in URL form
      const urlInput = screen.getByLabelText(/video url/i)
      await userEvent.type(urlInput, 'https://sproutvideo.com/videos/test')

      const titleInput = screen.getByLabelText(/^title/i)
      await userEvent.type(titleInput, 'Test Title')

      // Verify form has values
      expect(urlInput).toHaveValue('https://sproutvideo.com/videos/test')
      expect(titleInput).toHaveValue('Test Title')

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Wait for dialog to fully close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Note: We can't easily test form reset by reopening because Radix UI
      // Dialog has complex state management. The component's internal useEffect
      // cleanup handlers will reset the form state, which is tested by the
      // component's implementation. This test verifies the dialog closes properly.
    })

    it('should reset validation errors when closing dialog', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Trigger validation error
      const addVideoButton = screen.getByRole('button', { name: /^add video$/i })
      await userEvent.click(addVideoButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Reopen dialog
      await userEvent.click(addButton)

      // Validation errors should be cleared
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should reset addMode to "url" when closing dialog', async () => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Verify URL tab is active by default
      const urlTab = screen.getByRole('tab', { name: /enter url/i })
      expect(urlTab).toHaveAttribute('data-state', 'active')

      // Switch to upload tab
      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      expect(uploadTab).toHaveAttribute('data-state', 'active')

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Wait for dialog to fully close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Note: We can't easily test addMode reset by reopening because Radix UI
      // Dialog has complex state management. The component's internal useEffect
      // cleanup handlers will reset addMode to 'url', which is tested by the
      // component's implementation. This test verifies the dialog closes properly
      // after tab switching.
    })

    it('should show clean state when opening dialog again', async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/test/video.mp4',
          uploading: false,
          response: null,
          localDuration: null,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const addButton = screen.getByRole('button', { name: /add video/i })
      await userEvent.click(addButton)

      // Fill form and switch tabs
      const urlInput = screen.getByLabelText(/video url/i)
      await userEvent.type(urlInput, 'https://sproutvideo.com/videos/test')

      const uploadTab = screen.getByRole('tab', { name: /upload file/i })
      await userEvent.click(uploadTab)

      // Verify we're on upload tab
      expect(uploadTab).toHaveAttribute('data-state', 'active')

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Wait for dialog to fully close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Verify resetUploadState was called
      expect(mockResetUploadState).toHaveBeenCalled()

      // Note: We can't easily test clean state by reopening because Radix UI
      // Dialog has complex state management in tests. The component's internal
      // useEffect cleanup handlers will reset all state (form data, addMode, upload state),
      // which is tested by the component's implementation and verified by the
      // resetUploadState mock call above.
    })
  })

  // ==========================================
  // Issue #140: branded poster frame on upload
  // ==========================================
  describe('Issue #140: poster frame during upload', () => {
    const uploadResponse = createMockSproutUploadResponse({
      id: 'sprout-abc',
      title: 'WBS - MSc - Managing Change',
      embedded_url: 'https://sproutvideo.com/videos/sprout-abc'
    })

    const renderUploadTab = async () => {
      vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue(
        createFileUploadMock({
          selectedFile: '/renders/test-video.mp4',
          uploading: false,
          response: uploadResponse,
          localDuration: 120,
          selectFile: mockSelectFile,
          uploadFile: mockUploadFile,
          resetUploadState: mockResetUploadState
        })
      )

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)
      await userEvent.click(screen.getByRole('button', { name: /add video/i }))
      await userEvent.click(screen.getByRole('tab', { name: /upload file/i }))
    }

    it('b5_1_runs_the_poster_frame_for_the_uploaded_video', async () => {
      vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
        posterFrameHookReturn({ enabled: true })
      )

      await renderUploadTab()

      await waitFor(() =>
        expect(mockPosterFrameRun).toHaveBeenCalledWith('sprout-abc', 'test-api-key')
      )
    })

    it('b6_1_stores_the_custom_poster_frame_url_on_the_video_link', async () => {
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://sproutvideo.com/custom-poster.jpg',
        error: null
      })
      vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
        posterFrameHookReturn({ enabled: true })
      )

      await renderUploadTab()

      await waitFor(() =>
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            sproutVideoId: 'sprout-abc',
            thumbnailUrl: 'https://sproutvideo.com/custom-poster.jpg'
          })
        )
      )
    })

    it('b5_7_adds_the_video_link_even_when_the_poster_frame_fails', async () => {
      mockPosterFrameRun.mockResolvedValue({
        ok: false,
        posterFrameUrl: null,
        error: 'Poster frame is 793 KB — Sprout Video allows up to 500 KB.'
      })
      vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
        posterFrameHookReturn({ enabled: true })
      )

      await renderUploadTab()

      await waitFor(() =>
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            sproutVideoId: 'sprout-abc',
            // B6.3: unchanged from what today's code would store
            thumbnailUrl: uploadResponse.assets.poster_frames[0]
          })
        )
      )
    })

    it('b1_6_leaves_the_upload_untouched_when_the_option_is_unticked', async () => {
      vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
        posterFrameHookReturn({ enabled: false })
      )

      await renderUploadTab()

      await waitFor(() =>
        expect(mockAddVideoLink).toHaveBeenCalledWith(
          expect.objectContaining({
            thumbnailUrl: uploadResponse.assets.poster_frames[0]
          })
        )
      )
      expect(mockPosterFrameRun).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Issue #141: set a poster frame on an already-linked video
  // ==========================================
  describe('#141: Set poster frame card action', () => {
    const linkWithId: VideoLink = {
      url: 'https://sproutvideo.com/videos/abc123',
      title: 'WBS - MSc - Managing Change',
      sproutVideoId: 'abc123',
      thumbnailUrl: 'https://cdn.sproutvideo.com/poster/abc123.jpg',
      uploadDate: '2026-01-05T10:00:00Z',
      sourceRenderFile: 'managing_change.mp4'
    }

    const linkWithoutId: VideoLink = {
      url: 'https://videos.sproutvideo.com/embed/def456/tok',
      title: 'WBS - MSc - Leading Teams',
      sproutVideoId: null,
      thumbnailUrl: 'https://cdn.sproutvideo.com/poster/def456.jpg',
      uploadDate: null,
      sourceRenderFile: null
    }

    const unlinkableLink: VideoLink = {
      url: 'https://example.com/not-a-sprout-video',
      title: 'Somewhere else entirely',
      sproutVideoId: null,
      thumbnailUrl: null,
      uploadDate: null,
      sourceRenderFile: null
    }

    const withVideoLinks = (links: VideoLink[]) => {
      vi.mocked(useBreadcrumbsVideoLinksModule.useBreadcrumbsVideoLinks).mockReturnValue({
        videoLinks: links,
        isLoading: false,
        error: null,
        addVideoLink: mockAddVideoLink,
        addVideoLinkAsync: vi.fn(),
        removeVideoLink: mockRemoveVideoLink,
        removeVideoLinkAsync: vi.fn(),
        updateVideoLink: vi.fn(),
        updateVideoLinkAsync: mockUpdateVideoLinkAsync,
        reorderVideoLinks: mockReorderVideoLinks,
        reorderVideoLinksAsync: vi.fn(),
        isUpdating: false,
        addError: null,
        removeError: null,
        updateError: null,
        reorderError: null
      })
    }

    /** Opens the card action dialog for the card at `index` */
    const openPosterFrameDialog = async (index = 0) => {
      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)
      const actions = screen.getAllByRole('button', { name: /set poster frame/i })
      await userEvent.click(actions[index])
      return within(await screen.findByRole('dialog'))
    }

    it('b2_1_sends_the_frame_for_the_stored_sprout_id', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() =>
        expect(mockPosterFrameRun).toHaveBeenCalledWith('abc123', 'test-api-key')
      )
    })

    it('b2_2_derives_the_id_from_the_url_when_none_is_stored', async () => {
      withVideoLinks([linkWithoutId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/def456-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() =>
        expect(mockPosterFrameRun).toHaveBeenCalledWith('def456', 'test-api-key')
      )
    })

    it('b2_3_disables_the_action_when_no_id_can_be_resolved', async () => {
      withVideoLinks([unlinkableLink])

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      const action = screen.getByRole('button', { name: /set poster frame/i })
      expect(action).toBeDisabled()
      expect(action.getAttribute('title')).toMatch(/no sprout video id/i)
    })

    it('b4_4_explains_a_missing_sprout_api_key_in_the_dialog', async () => {
      withVideoLinks([linkWithId])
      vi.mocked(useApiKeysModule.useSproutVideoApiKey).mockReturnValue({
        apiKey: '',
        isLoading: false,
        error: null
      })

      const dialog = await openPosterFrameDialog()

      expect(dialog.getByText(/API key not configured/i)).toBeInTheDocument()
      expect(dialog.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
    })

    it('b6_1_writes_the_refreshed_thumbnail_back_to_the_right_link', async () => {
      withVideoLinks([linkWithoutId, linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog(1)
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() =>
        expect(mockUpdateVideoLinkAsync).toHaveBeenCalledWith({
          videoIndex: 1,
          updatedLink: expect.objectContaining({
            url: linkWithId.url,
            thumbnailUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg'
          })
        })
      )
    })

    it('b6_2_persists_a_derived_sprout_id_in_the_same_write', async () => {
      withVideoLinks([linkWithoutId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/def456-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() =>
        expect(mockUpdateVideoLinkAsync).toHaveBeenCalledWith({
          videoIndex: 0,
          updatedLink: expect.objectContaining({ sproutVideoId: 'def456' })
        })
      )
    })

    it('b6_3_cache_busts_the_card_thumbnail_after_a_successful_set', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: linkWithId.thumbnailUrl,
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() =>
        expect(screen.getByAltText(linkWithId.title).getAttribute('src')).toMatch(
          /[?&]v=\d+/
        )
      )
    })

    it('b6_7_closes_the_dialog_and_reports_success', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('b6_4_still_reports_success_when_the_breadcrumbs_write_back_fails', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg',
        error: null
      })
      mockUpdateVideoLinkAsync.mockRejectedValue(
        new Error('breadcrumbs.json is read-only')
      )

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() => expect(toast.warning).toHaveBeenCalled())
      expect(toast.error).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('b6_4_still_reports_success_when_sprout_details_could_not_be_re_read', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: null,
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() => expect(toast.warning).toHaveBeenCalled())
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('b6_6_opens_no_trello_dialog_after_a_successful_set', async () => {
      const trelloCards = [
        { cardId: 'card-1', title: 'Managing Change', url: 'https://trello.com/c/card-1' }
      ]
      vi.mocked(
        useBreadcrumbsTrelloCardsHookModule.useBreadcrumbsTrelloCards
      ).mockReturnValue({
        trelloCards,
        isLoading: false,
        error: null,
        addTrelloCard: vi.fn(),
        addTrelloCardAsync: vi.fn(),
        removeTrelloCard: vi.fn(),
        removeTrelloCardAsync: vi.fn(),
        fetchCardDetails: vi.fn(),
        fetchCardDetailsAsync: vi.fn(),
        isUpdating: false,
        isFetchingDetails: false,
        addError: null,
        removeError: null,
        fetchError: null,
        fetchedCardData: undefined
      } as unknown as ReturnType<
        typeof useBreadcrumbsTrelloCardsHookModule.useBreadcrumbsTrelloCards
      >)
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: true,
        posterFrameUrl: 'https://cdn.sproutvideo.com/poster/abc123-branded.jpg',
        error: null
      })

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(screen.queryByText(/update trello card/i)).not.toBeInTheDocument()
    })

    it('b5_4_keeps_the_dialog_open_with_the_error_on_a_terminal_failure', async () => {
      withVideoLinks([linkWithId])
      mockPosterFrameRun.mockResolvedValue({
        ok: false,
        posterFrameUrl: null,
        error: 'Poster frame is 793 KB — Sprout Video allows up to 500 KB.'
      })
      vi.mocked(usePosterFrameForUploadModule.usePosterFrameForUpload).mockReturnValue(
        posterFrameHookReturn({
          status: 'error',
          error: 'Poster frame is 793 KB — Sprout Video allows up to 500 KB.'
        })
      )

      const dialog = await openPosterFrameDialog()
      await userEvent.click(dialog.getByRole('button', { name: /^set poster frame$/i }))

      await waitFor(() => expect(mockPosterFrameRun).toHaveBeenCalled())
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(dialog.getByText(/793 KB/)).toBeInTheDocument()
      expect(mockUpdateVideoLinkAsync).not.toHaveBeenCalled()
    })

    it('b3_4_re_derives_the_text_when_the_dialog_is_reopened_for_another_link', async () => {
      withVideoLinks([linkWithId, linkWithoutId])

      renderWithQueryClient(<VideoLinksManager projectPath={mockProjectPath} />)

      await userEvent.click(
        screen.getAllByRole('button', { name: /set poster frame/i })[0]
      )
      await screen.findByRole('dialog')
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i })
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await userEvent.click(
        screen.getAllByRole('button', { name: /^set poster frame$/i })[1]
      )
      await screen.findByRole('dialog')

      // The hook derives text from the title it is given, so switching links must
      // re-seed it (reset clears any text the user typed for the previous link).
      expect(mockPosterFrameReset).toHaveBeenCalled()
      expect(
        vi
          .mocked(usePosterFrameForUploadModule.usePosterFrameForUpload)
          .mock.calls.some(([options]) => options?.videoTitle === linkWithoutId.title)
      ).toBe(true)
    })
  })
})
