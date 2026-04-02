/**
 * Integration Test: US-06 — Sprout Video File Upload
 *
 * As a user, when I navigate to /upload and select a video file, I can upload
 * it to Sprout Video. The upload is event-driven: a Tauri backend event signals
 * completion, and the hook stores the upload response.
 *
 * Tests the useFileUpload hook from src/features/Upload/hooks/useFileUpload.ts.
 * Mocking strategy: mock the Upload api.ts module and @shared/store; no direct
 * @tauri-apps imports.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be
 * restored in beforeEach.
 */

import { useFileUpload } from '../../src/features/Upload/hooks/useFileUpload'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Upload api.ts layer (single I/O boundary for Upload module)
vi.mock('../../src/features/Upload/api', () => ({
  openFileDialog: vi.fn().mockResolvedValue('/videos/test-video.mp4'),
  uploadVideo: vi.fn().mockResolvedValue(undefined),
  listenUploadComplete: vi.fn().mockResolvedValue(vi.fn()),
  listenUploadError: vi.fn().mockResolvedValue(vi.fn()),
  listenUploadProgress: vi.fn().mockResolvedValue(vi.fn()),
  getFolders: vi.fn().mockResolvedValue({ folders: [] }),
  fetchSproutVideoDetails: vi.fn().mockResolvedValue(null),
  openFolderDialog: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(undefined),
  readFileAsBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  listDirectory: vi.fn().mockResolvedValue([]),
  getFontDir: vi.fn().mockResolvedValue('/mock/fonts'),
  fileExists: vi.fn().mockResolvedValue(false),
  openFolder: vi.fn().mockResolvedValue(undefined)
}))

// Mock @shared/store for appStore used in useFileUpload
vi.mock('@shared/store', () => {
  const mockSetLatestSproutUpload = vi.fn()
  return {
    appStore: {
      getState: vi.fn().mockReturnValue({
        setLatestSproutUpload: mockSetLatestSproutUpload,
        latestSproutUpload: null
      })
    },
    useAppStore: vi.fn().mockImplementation((selector: any) =>
      selector({
        ollamaUrl: null,
        setOllamaUrl: vi.fn(),
        latestSproutUpload: null,
        setLatestSproutUpload: vi.fn()
      })
    )
  }
})

// ============================================================================
// Helpers
// ============================================================================

/** Captures listenUploadComplete / listenUploadError handlers for test control */
async function setupUploadHandlers() {
  const api = await import('../../src/features/Upload/api')
  const handlers: Record<string, (event: any) => void> = {}

  vi.mocked(api.listenUploadComplete).mockImplementation((handler: any) => {
    handlers['upload_complete'] = handler
    return Promise.resolve(vi.fn())
  })

  vi.mocked(api.listenUploadError).mockImplementation((handler: any) => {
    handlers['upload_error'] = handler
    return Promise.resolve(vi.fn())
  })

  return handlers
}

// ============================================================================
// US-06: File Upload — useFileUpload hook
// ============================================================================

describe('US-06 — Sprout Video: File Upload (useFileUpload)', () => {
  beforeEach(async () => {
    // mockReset: true clears mock implementations — restore defaults here
    const api = await import('../../src/features/Upload/api')
    const { appStore } = await import('@shared/store')

    vi.mocked(api.openFileDialog).mockResolvedValue('/videos/test-video.mp4')
    vi.mocked(api.uploadVideo).mockResolvedValue(undefined)
    vi.mocked(api.listenUploadComplete).mockResolvedValue(vi.fn())
    vi.mocked(api.listenUploadError).mockResolvedValue(vi.fn())
    vi.mocked(appStore.getState).mockReturnValue({
      setLatestSproutUpload: vi.fn(),
      latestSproutUpload: null
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with no selected file and not uploading', () => {
    const { result } = renderHook(() => useFileUpload())

    expect(result.current.selectedFile).toBeNull()
    expect(result.current.uploading).toBe(false)
    expect(result.current.response).toBeNull()
  })

  it('US-06a — should set selectedFile after selectFile() picks a file', async () => {
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    expect(result.current.selectedFile).toBe('/videos/test-video.mp4')
  })

  it('US-06b — should not set selectedFile when dialog returns null', async () => {
    const api = await import('../../src/features/Upload/api')
    vi.mocked(api.openFileDialog).mockResolvedValue(null)

    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    expect(result.current.selectedFile).toBeNull()
  })

  it('US-06c — should not start upload when no file is selected', async () => {
    const api = await import('../../src/features/Upload/api')
    const { result } = renderHook(() => useFileUpload())

    // Do NOT call selectFile — selectedFile is null
    await act(async () => {
      await result.current.uploadFile('api-key')
    })

    expect(api.uploadVideo).not.toHaveBeenCalled()
    expect(result.current.uploading).toBe(false)
  })

  it('US-06d — should not start upload when API key is null', async () => {
    const api = await import('../../src/features/Upload/api')
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    await act(async () => {
      await result.current.uploadFile(null)
    })

    expect(api.uploadVideo).not.toHaveBeenCalled()
    expect(result.current.uploading).toBe(false)
  })

  it('US-06e — should set uploading=true when upload starts', async () => {
    const handlers = await setupUploadHandlers()
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    // Start upload without awaiting (it waits for an event)
    act(() => {
      result.current.uploadFile('test-api-key')
    })

    await waitFor(() => {
      expect(result.current.uploading).toBe(true)
    })

    // Fire completion event to avoid hanging
    await act(async () => {
      handlers['upload_complete']?.({
        payload: { id: 'video-123', title: 'Done' }
      })
    })

    await waitFor(() => {
      expect(result.current.uploading).toBe(false)
    })
  })

  it('US-06f — should call uploadVideo with correct file path and API key', async () => {
    const api = await import('../../src/features/Upload/api')
    const handlers = await setupUploadHandlers()

    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    act(() => {
      result.current.uploadFile('my-api-key')
    })

    await waitFor(() => {
      expect(api.uploadVideo).toHaveBeenCalledWith(
        '/videos/test-video.mp4',
        'my-api-key',
        null // selectedFolder is always null in this hook
      )
    })

    // Clean up
    await act(async () => {
      handlers['upload_complete']?.({ payload: { id: 'v123' } })
    })
  })

  it('US-06g — should set response after upload_complete event fires', async () => {
    const mockResponse = {
      id: 'video-abc',
      title: 'My Uploaded Video',
      embed_code: '<iframe src="..." />'
    }

    const handlers = await setupUploadHandlers()
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    act(() => {
      result.current.uploadFile('api-key')
    })

    await waitFor(() => {
      expect(result.current.uploading).toBe(true)
    })

    await act(async () => {
      handlers['upload_complete']?.({ payload: mockResponse })
    })

    await waitFor(() => {
      expect(result.current.response).toEqual(mockResponse)
      expect(result.current.uploading).toBe(false)
    })
  })

  it('US-06h — should set uploading=false after upload_error event fires', async () => {
    const handlers = await setupUploadHandlers()
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    act(() => {
      result.current.uploadFile('api-key')
    })

    await waitFor(() => {
      expect(result.current.uploading).toBe(true)
    })

    await act(async () => {
      handlers['upload_error']?.({ payload: 'Server error: 500' })
    })

    await waitFor(() => {
      expect(result.current.uploading).toBe(false)
      expect(result.current.response).toBeNull()
    })
  })

  it('US-06i — should reset uploading and response on resetUploadState()', async () => {
    const handlers = await setupUploadHandlers()
    const { result } = renderHook(() => useFileUpload())

    // Complete a successful upload
    await act(async () => {
      await result.current.selectFile()
    })

    act(() => {
      result.current.uploadFile('api-key')
    })

    await act(async () => {
      handlers['upload_complete']?.({ payload: { id: 'v123', title: 'Test' } })
    })

    await waitFor(() => {
      expect(result.current.response).not.toBeNull()
    })

    // Now reset
    act(() => {
      result.current.resetUploadState()
    })

    expect(result.current.uploading).toBe(false)
    expect(result.current.response).toBeNull()
  })

  it('US-06j — should handle uploadVideo rejection gracefully', async () => {
    const api = await import('../../src/features/Upload/api')

    vi.mocked(api.listenUploadComplete).mockResolvedValue(vi.fn())
    vi.mocked(api.listenUploadError).mockResolvedValue(vi.fn())
    vi.mocked(api.uploadVideo).mockRejectedValue(new Error('Network connection failed'))

    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    await act(async () => {
      await result.current.uploadFile('api-key')
    })

    // After error, uploading should be false and response null
    await waitFor(() => {
      expect(result.current.uploading).toBe(false)
    })
    expect(result.current.response).toBeNull()
  })

  it('US-06k — should call appStore.setLatestSproutUpload after successful upload', async () => {
    const { appStore } = await import('@shared/store')
    const mockSetLatestSproutUpload = vi.fn()
    vi.mocked(appStore.getState).mockReturnValue({
      setLatestSproutUpload: mockSetLatestSproutUpload,
      latestSproutUpload: null
    } as any)

    const mockResponse = { id: 'video-xyz', title: 'Final Upload' }
    const handlers = await setupUploadHandlers()
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    act(() => {
      result.current.uploadFile('api-key')
    })

    await act(async () => {
      handlers['upload_complete']?.({ payload: mockResponse })
    })

    await waitFor(() => {
      expect(mockSetLatestSproutUpload).toHaveBeenCalledWith(mockResponse)
    })
  })
})
