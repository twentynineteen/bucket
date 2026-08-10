/**
 * useFileUpload -- destination folder (issue #155)
 *
 * The regression test for the reported bug. Before this change `selectedFolder`
 * was a setter-less `useState(null)` threaded straight into `uploadVideo`, so
 * every upload landed in the account root regardless of what the user chose.
 * These tests fail against master.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  uploadVideo: vi.fn().mockResolvedValue(undefined),
  getVideoDuration: vi.fn().mockResolvedValue(0),
  openFileDialog: vi.fn(),
  listenUploadComplete: vi.fn().mockResolvedValue(() => undefined),
  listenUploadError: vi.fn().mockResolvedValue(() => undefined)
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import {
  getVideoDuration,
  listenUploadComplete,
  listenUploadError,
  openFileDialog,
  uploadVideo
} from '../api'
import type { SelectedSproutFolder } from '../types'
import { useFileUpload } from './useFileUpload'

const folder: SelectedSproutFolder = {
  id: 'folder-abc',
  name: 'Q2 Campaign',
  path: 'Marketing / Q2 Campaign'
}

/** Starts an upload without waiting for the completion event, which never fires here. */
function startUpload(upload: () => Promise<void>): void {
  void upload().catch(() => undefined)
}

beforeEach(() => {
  // The suite resets mock implementations between tests, so these are set here
  // rather than in the vi.mock factory.
  vi.mocked(uploadVideo).mockClear().mockResolvedValue(undefined)
  vi.mocked(openFileDialog).mockResolvedValue('/tmp/clip.mp4')
  vi.mocked(getVideoDuration).mockResolvedValue(0)
  vi.mocked(listenUploadComplete).mockResolvedValue(() => undefined)
  vi.mocked(listenUploadError).mockResolvedValue(() => undefined)
})

/** Selects a file so uploadFile gets past its guard clause. */
async function withFile(result: { current: ReturnType<typeof useFileUpload> }) {
  await act(async () => {
    await result.current.selectFile()
  })
}

describe('useFileUpload folder destination', () => {
  it('exposes the selected folder and a setter', () => {
    const { result } = renderHook(() => useFileUpload())

    expect(result.current.selectedFolder).toBeNull()
    expect(typeof result.current.setSelectedFolder).toBe('function')
  })

  it('sends the selected folder id to the upload command', async () => {
    const { result } = renderHook(() => useFileUpload())

    await withFile(result)
    act(() => {
      result.current.setSelectedFolder(folder)
    })

    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123', 'A title', folder))
    })

    expect(uploadVideo).toHaveBeenCalledWith(
      expect.anything(),
      'key-123',
      'folder-abc',
      'A title'
    )
  })

  it('sends null when Root is selected', async () => {
    const { result } = renderHook(() => useFileUpload())
    await withFile(result)

    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123', 'A title', null))
    })

    expect(uploadVideo).toHaveBeenCalledWith(
      expect.anything(),
      'key-123',
      null,
      'A title'
    )
  })

  it('prefers an explicitly passed folder over hook state', async () => {
    // Callers that resolve the destination themselves pass it explicitly, so
    // they cannot upload against a pre-update value.
    const { result } = renderHook(() => useFileUpload())
    await withFile(result)

    act(() => {
      result.current.setSelectedFolder({ id: 'stale', name: 'Old', path: 'Old' })
    })

    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123', undefined, folder))
    })

    expect(uploadVideo).toHaveBeenCalledWith(
      expect.anything(),
      'key-123',
      'folder-abc',
      null
    )
  })

  it('falls back to hook state when no folder is passed', async () => {
    const { result } = renderHook(() => useFileUpload())
    await withFile(result)

    act(() => {
      result.current.setSelectedFolder(folder)
    })

    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123'))
    })

    expect(uploadVideo).toHaveBeenCalledWith(
      expect.anything(),
      'key-123',
      'folder-abc',
      null
    )
  })
})
