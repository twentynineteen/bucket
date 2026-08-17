/**
 * useFileUpload
 *
 * Two groups of tests, both regressions for reported bugs.
 *
 * **Destination folder (issue #155).** Before that fix `selectedFolder` was a
 * setter-less `useState(null)` threaded straight into `uploadVideo`, so every
 * upload landed in the account root regardless of what the user chose.
 *
 * **Stall detection (issue #204).** The hook armed a flat 45-minute
 * `setTimeout` at invocation and never consulted progress, so a transfer that
 * died at 3% held at 3% for another 44 minutes -- indistinguishable from a
 * genuinely slow large upload -- while a healthy upload that legitimately ran
 * past 45 minutes was killed mid-flight. Detection itself lives in Rust, which
 * can see byte offsets and tear the request down; what the hook keeps is a
 * liveness backstop on the backend, rearmed by every progress event.
 *
 * The file was `useFileUpload.folder.test.ts`; renamed for #204 so the unit has
 * one test file rather than one per topic.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  uploadVideo: vi.fn().mockResolvedValue('op-1'),
  cancelUpload: vi.fn().mockResolvedValue(true),
  getVideoDuration: vi.fn().mockResolvedValue(0),
  openFileDialog: vi.fn(),
  listenUploadComplete: vi.fn().mockResolvedValue(() => undefined),
  listenUploadError: vi.fn().mockResolvedValue(() => undefined),
  listenUploadProgress: vi.fn().mockResolvedValue(() => undefined),
  listenUploadCancelled: vi.fn().mockResolvedValue(() => undefined),
  listenUploadStallWarning: vi.fn().mockResolvedValue(() => undefined)
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() }
}))

import { toast } from 'sonner'

import {
  cancelUpload,
  getVideoDuration,
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress,
  listenUploadStallWarning,
  openFileDialog,
  uploadVideo
} from '../api'
import type {
  SelectedSproutFolder,
  UploadCancelledEvent,
  UploadErrorEvent,
  UploadProgressEvent
} from '../types'
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
  vi.mocked(uploadVideo).mockClear().mockResolvedValue('op-1')
  vi.mocked(cancelUpload).mockClear().mockResolvedValue(true)
  vi.mocked(openFileDialog).mockResolvedValue('/tmp/clip.mp4')
  vi.mocked(getVideoDuration).mockResolvedValue(0)
  vi.mocked(listenUploadComplete).mockResolvedValue(() => undefined)
  vi.mocked(listenUploadError).mockResolvedValue(() => undefined)
  vi.mocked(listenUploadProgress).mockResolvedValue(() => undefined)
  vi.mocked(listenUploadCancelled).mockResolvedValue(() => undefined)
  vi.mocked(listenUploadStallWarning).mockResolvedValue(() => undefined)
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

// --- Stall detection and the backend liveness backstop (issue #204) ---

/**
 * The stall message the Rust watchdog emits, copied from `stall_message` in
 * `sprout_upload.rs`. Its wording is pinned there by
 * `the_stall_message_names_the_offset_the_total_and_the_silence`; what matters
 * here is only that the hook does not rewrite whatever the backend sent.
 */
const BACKEND_STALL_MESSAGE =
  'Stalled after 71s with no data reaching Sprout. The transfer stopped at ' +
  '1.68 GB of 4.10 GB (41%). That is a dropped connection rather than a slow one, ' +
  'so waiting will not help. Check your network and start the upload again.'

describe('useFileUpload stall handling', () => {
  /** Captured `upload_progress` handlers, in registration order. */
  let progressHandlers: Array<(event: { payload: UploadProgressEvent }) => void>
  /** Captured `upload_error` handlers. */
  let errorHandlers: Array<(event: { payload: UploadErrorEvent }) => void>

  beforeEach(() => {
    vi.useFakeTimers()
    progressHandlers = []
    errorHandlers = []

    vi.mocked(listenUploadProgress).mockImplementation((callback) => {
      progressHandlers.push(callback)
      return Promise.resolve(() => undefined)
    })
    vi.mocked(listenUploadError).mockImplementation((callback) => {
      errorHandlers.push(callback)
      return Promise.resolve(() => undefined)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Selects a file and starts an upload that nothing settles. */
  async function beginUpload() {
    const { result } = renderHook(() => useFileUpload())
    await act(async () => {
      await result.current.selectFile()
    })
    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123'))
    })
    return result
  }

  /** Emits a progress event, as the Rust `ProgressReader` does. */
  function emitProgress(percentage: number, operationId = 'op-1') {
    const payload: UploadProgressEvent = {
      operationId,
      bytesSent: Math.round((percentage / 100) * 4_100_000_000),
      totalBytes: 4_100_000_000,
      percentage
    }
    for (const handler of progressHandlers) handler({ payload })
  }

  /** Emits a terminal failure, as `TerminalGate::fail` does. */
  function emitError(message: string, operationId = 'op-1') {
    for (const handler of errorHandlers) handler({ payload: { operationId, message } })
  }

  it('subscribes to progress so its deadline can follow the transfer', async () => {
    await beginUpload()

    // The old timer was armed once at invocation and never consulted progress,
    // which is why a dead upload and a slow one looked identical for 45 minutes.
    expect(progressHandlers).toHaveLength(1)
  })

  it('does not give up on an upload still making progress after 45 minutes', async () => {
    // UP-14 / UP-18. The flat deadline killed a legitimate large upload over a
    // slow link while it was making perfectly steady headway.
    const result = await beginUpload()

    for (let minute = 1; minute <= 45; minute++) {
      await act(async () => {
        emitProgress(minute)
        await vi.advanceTimersByTimeAsync(60_000)
      })
    }

    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.uploading).toBe(true)
  })

  it('reports the backend as unresponsive when nothing arrives at all', async () => {
    // UP-18. No progress and no terminal event for two full stall windows means
    // the backend itself has gone quiet, which is not a stall: a stall would have
    // been reported by the watchdog inside the first window.
    const result = await beginUpload()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150_000)
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    const message = vi.mocked(toast.error).mock.calls[0][0] as string
    expect(message).toContain('backend stopped responding')
    expect(message).not.toContain('timed out')
    expect(message).not.toContain('45 minutes')
    expect(message.toLowerCase()).not.toContain('stall')
    expect(result.current.uploading).toBe(false)
  })

  it('rearms the deadline on every progress event', async () => {
    // UP-18. The whole point: the deadline measures silence, not wall clock.
    await beginUpload()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(149_000)
    })
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => {
      emitProgress(12)
      await vi.advanceTimersByTimeAsync(149_000)
    })
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("passes the backend's stall message through verbatim", async () => {
    // UP-19. The catch block used to rewrite anything containing "connection"
    // into "Network connection error. Please check your internet connection",
    // discarding the byte offset and the silence duration -- precisely the detail
    // that lets a user tell a stall from a slow transfer. #152 removed the same
    // string sniffing at two other sites.
    await beginUpload()

    await act(async () => {
      emitError(BACKEND_STALL_MESSAGE)
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    const message = vi.mocked(toast.error).mock.calls[0][0] as string
    expect(message).toContain('stopped at 1.68 GB of 4.10 GB')
    expect(message).toContain('71s')
    expect(message).not.toContain('Network connection error')
  })

  it('stops watching once a terminal event has settled the upload', async () => {
    // UP-17 from the consumer's side: one terminal event per operation. A
    // deadline left armed after the backend has reported would fire a second,
    // contradictory message minutes later.
    await beginUpload()

    await act(async () => {
      emitError('Sprout rejected the upload')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(toast.error).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000)
    })
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('ignores a terminal event belonging to a different operation', async () => {
    // UP-32. With no operation id, a zombie upload's events were
    // indistinguishable from the live one's, so a retry could be failed by the
    // corpse of the attempt it replaced.
    const result = await beginUpload()

    await act(async () => {
      emitError('Sprout rejected the upload', 'some-other-operation')
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.uploading).toBe(true)

    await act(async () => {
      emitError('Sprout rejected the upload')
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(result.current.uploading).toBe(false)
  })
})

// --- Cancellation (issue #225) ---

describe('useFileUpload cancellation', () => {
  /** Captured `upload_cancelled` handlers. */
  let cancelledHandlers: Array<(event: { payload: UploadCancelledEvent }) => void>

  beforeEach(() => {
    cancelledHandlers = []
    vi.mocked(listenUploadCancelled).mockImplementation((callback) => {
      cancelledHandlers.push(callback)
      return Promise.resolve(() => undefined)
    })
  })

  async function beginUpload() {
    const { result } = renderHook(() => useFileUpload())
    await act(async () => {
      await result.current.selectFile()
    })
    await act(async () => {
      startUpload(() => result.current.uploadFile('key-123'))
    })
    return result
  }

  it('exposes a cancel action, which the hook did not have at all before', () => {
    // The heart of #225: #204 could report a stall in 70 seconds and the only
    // thing a user could do with that was quit the app.
    const { result } = renderHook(() => useFileUpload())

    expect(typeof result.current.cancelUpload).toBe('function')
  })

  it('cancels the operation the backend named', async () => {
    // UP-20. `upload_video` used to return nothing, so no running upload could be
    // addressed. It now returns the id the registry minted for it.
    const result = await beginUpload()

    await act(async () => {
      await result.current.cancelUpload()
    })

    expect(cancelUpload).toHaveBeenCalledWith('op-1')
  })

  it('does not call the backend when nothing is in flight', async () => {
    // UP-23. A dialog is routinely dismissed when no upload is running, and that
    // must not fire a command naming an operation that never existed.
    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.cancelUpload()
    })

    expect(cancelUpload).not.toHaveBeenCalled()
  })

  it('settles quietly on cancellation, with no error toast', async () => {
    // UP-21. Cancellation is not a failure. A destructive toast for something the
    // user asked for reads as though the app went wrong.
    const result = await beginUpload()

    await act(async () => {
      for (const handler of cancelledHandlers) {
        handler({
          payload: {
            operationId: 'op-1',
            bytesSent: 1_680_000_000,
            totalBytes: 4_100_000_000
          }
        })
      }
    })

    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.uploading).toBe(false)
    expect(result.current.response).toBeNull()
  })

  it('does not treat another operation cancellation as its own', async () => {
    // UP-32, from the cancellation side.
    const result = await beginUpload()

    await act(async () => {
      for (const handler of cancelledHandlers) {
        handler({
          payload: { operationId: 'not-mine', bytesSent: 0, totalBytes: 1 }
        })
      }
    })

    expect(result.current.uploading).toBe(true)
  })
})
