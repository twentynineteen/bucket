/**
 * useReplaceUpload (issue #282, B2)
 *
 * The transfer half of "replace the video behind a Baker link". It exists
 * beside useFileUpload rather than inside it because that hook is welded to
 * the Add Video flow: it hardcodes `uploadVideo`, writes the latest upload into
 * the app store, raises its own error toast and shares `selectedFile` with the
 * Add form. Reusing it for a replace would make a replace completion look like
 * an add.
 *
 * The event plumbing is the part worth testing hardest. Upload events are
 * global and carry an operation id; useFileUpload accepts *any* id until the
 * backend has told it its own ("permissive window"), which is the one place a
 * foreign completion could be mistaken for this transfer's. This hook has no
 * such window: events that arrive before the id is known are buffered and
 * only replayed if they turn out to be ours.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Shape of a Tauri event, declared locally so this file stays clear of the no-bypass rule. */
type Event<T> = { event: string; id: number; payload: T }

vi.mock('../api', () => ({
  replaceVideo: vi.fn(),
  cancelUpload: vi.fn(),
  openFileDialog: vi.fn(),
  listenUploadComplete: vi.fn(),
  listenUploadError: vi.fn(),
  listenUploadProgress: vi.fn(),
  listenUploadCancelled: vi.fn(),
  listenUploadStallWarning: vi.fn()
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }
}))

import { appStore } from '@shared/store'
import { toast } from 'sonner'

import {
  cancelUpload,
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress,
  listenUploadStallWarning,
  openFileDialog,
  replaceVideo
} from '../api'
import type {
  SproutUploadResponse,
  UploadCancelledEvent,
  UploadCompleteEvent,
  UploadErrorEvent,
  UploadProgressEvent
} from '../types'
import { useReplaceUpload } from './useReplaceUpload'

type Handler<T> = (event: Event<T>) => void | Promise<void>

/** The listeners the hook attached, so a test can play the backend. */
const handlers: {
  progress?: Handler<UploadProgressEvent>
  complete?: Handler<UploadCompleteEvent>
  error?: Handler<UploadErrorEvent>
  cancelled?: Handler<UploadCancelledEvent>
} = {}

const asEvent = <T>(payload: T): Event<T> => ({ event: 'x', id: 1, payload })

const video = (overrides: Partial<SproutUploadResponse> = {}): SproutUploadResponse =>
  ({
    id: 'vid-1',
    title: 'Managing Change',
    state: 'deployed',
    duration: 120,
    embed_code: '',
    embedded_url: 'https://sproutvideo.com/videos/vid-1',
    assets: { poster_frames: ['https://cdn/poster-b.jpg'] },
    ...overrides
  }) as SproutUploadResponse

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  delete handlers.progress
  delete handlers.complete
  delete handlers.error
  delete handlers.cancelled

  vi.mocked(replaceVideo).mockReset().mockResolvedValue('op-1')
  vi.mocked(cancelUpload).mockReset().mockResolvedValue(true)
  vi.mocked(openFileDialog).mockReset().mockResolvedValue('/renders/WBS_intro_v2.mp4')
  vi.mocked(listenUploadProgress).mockImplementation(async (cb) => {
    handlers.progress = cb
    return () => undefined
  })
  vi.mocked(listenUploadComplete).mockImplementation(async (cb) => {
    handlers.complete = cb
    return () => undefined
  })
  vi.mocked(listenUploadError).mockImplementation(async (cb) => {
    handlers.error = cb
    return () => undefined
  })
  vi.mocked(listenUploadCancelled).mockImplementation(async (cb) => {
    handlers.cancelled = cb
    return () => undefined
  })
  vi.mocked(listenUploadStallWarning).mockResolvedValue(() => undefined)
  vi.mocked(toast.error).mockClear()
})

/**
 * Picks a file and starts the replace. The pending outcome comes back wrapped
 * so `await startReplace()` does not flatten it and wait for the transfer.
 */
async function startReplace(result: { current: ReturnType<typeof useReplaceUpload> }) {
  await act(async () => {
    await result.current.selectFile()
  })
  let pending!: ReturnType<typeof result.current.start>
  await act(async () => {
    pending = result.current.start('vid-1', 'key-123')
    // Let the listeners attach and the invoke resolve.
    await Promise.resolve()
  })
  return { pending }
}

describe('useReplaceUpload - file selection', () => {
  it('b4_2_a_cancelled_picker_leaves_no_file_selected', async () => {
    vi.mocked(openFileDialog).mockResolvedValue(null)
    const { result } = renderHook(() => useReplaceUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    expect(result.current.selectedFile).toBeNull()
  })

  it('offers only video files', async () => {
    const { result } = renderHook(() => useReplaceUpload())

    await act(async () => {
      await result.current.selectFile()
    })

    expect(openFileDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        multiple: false,
        filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi'] }]
      })
    )
    expect(result.current.selectedFile).toBe('/renders/WBS_intro_v2.mp4')
  })
})

describe('useReplaceUpload - completion', () => {
  it('b2_1_invokes_replace_for_the_selected_file_and_resolves_with_the_video', async () => {
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    expect(replaceVideo).toHaveBeenCalledWith(
      '/renders/WBS_intro_v2.mp4',
      'key-123',
      'vid-1'
    )
    expect(result.current.status).toBe('uploading')

    const replaced = video()
    await act(async () => {
      await handlers.complete?.(asEvent({ operationId: 'op-1', video: replaced }))
    })

    await expect(outcome).resolves.toEqual({ status: 'complete', video: replaced })
    expect(result.current.status).toBe('idle')
  })

  it('b2_2_tracks_progress_for_its_own_operation_only', async () => {
    const { result } = renderHook(() => useReplaceUpload())
    await startReplace(result)

    await act(async () => {
      await handlers.progress?.(
        asEvent({ operationId: 'op-1', bytesSent: 50, totalBytes: 200, percentage: 25 })
      )
    })
    expect(result.current.progress).toEqual({
      bytesSent: 50,
      totalBytes: 200,
      percentage: 25
    })

    await act(async () => {
      await handlers.progress?.(
        asEvent({
          operationId: 'op-other',
          bytesSent: 199,
          totalBytes: 200,
          percentage: 99.5
        })
      )
    })
    expect(result.current.progress.percentage).toBe(25)
  })

  it('b2_2_a_foreign_completion_before_the_id_is_known_is_not_honoured', async () => {
    // The permissive window useFileUpload has. A zombie operation's terminal
    // event landing between "listeners attached" and "invoke resolved" must
    // not settle this transfer with someone else's video.
    const registered = deferred<string>()
    vi.mocked(replaceVideo).mockReturnValue(registered.promise)
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    await act(async () => {
      await handlers.complete?.(
        asEvent({ operationId: 'op-zombie', video: video({ id: 'zombie' }) })
      )
    })

    let settled = false
    void outcome.then(() => {
      settled = true
    })
    await act(async () => {
      registered.resolve('op-1')
      await Promise.resolve()
    })
    expect(settled).toBe(false)
    expect(result.current.status).toBe('uploading')

    const mine = video()
    await act(async () => {
      await handlers.complete?.(asEvent({ operationId: 'op-1', video: mine }))
    })
    await expect(outcome).resolves.toEqual({ status: 'complete', video: mine })
  })

  it('b2_2_our_own_completion_before_the_id_is_known_is_buffered_and_replayed', async () => {
    // The mirror image: no window means no dropped events either. A completion
    // that beats the invoke's resolution is held until the id confirms it.
    const registered = deferred<string>()
    vi.mocked(replaceVideo).mockReturnValue(registered.promise)
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    const mine = video()
    await act(async () => {
      await handlers.complete?.(asEvent({ operationId: 'op-1', video: mine }))
    })
    await act(async () => {
      registered.resolve('op-1')
    })

    await expect(outcome).resolves.toEqual({ status: 'complete', video: mine })
  })

  it('b2_5_never_writes_the_latest_upload_into_the_app_store', async () => {
    // A replace is not "the latest upload": Trello's "append video info" reads
    // that slot and would push the replaced video's details as a new upload.
    const sentinel = video({ id: 'previous-upload' })
    appStore.getState().setLatestSproutUpload(sentinel)
    const { result } = renderHook(() => useReplaceUpload())
    await startReplace(result)

    await act(async () => {
      await handlers.complete?.(asEvent({ operationId: 'op-1', video: video() }))
    })

    expect(appStore.getState().latestSproutUpload).toBe(sentinel)
  })
})

describe('useReplaceUpload - error', () => {
  it('b2_3_an_upload_error_is_reported_in_state_and_not_toasted', async () => {
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    await act(async () => {
      await handlers.error?.(
        asEvent({ operationId: 'op-1', message: 'Sprout rejected the request: HTTP 413' })
      )
    })

    await expect(outcome).resolves.toEqual({
      status: 'error',
      message: 'Sprout rejected the request: HTTP 413'
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Sprout rejected the request: HTTP 413')
    // The dialog shows the error inline; a toast on top would double-report it.
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('b2_3_a_2xx_whose_video_failed_processing_is_an_error', async () => {
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    await act(async () => {
      await handlers.complete?.(
        asEvent({ operationId: 'op-1', video: video({ state: 'failed' }) })
      )
    })

    const settled = await outcome
    expect(settled.status).toBe('error')
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/could not process/i)
  })

  it('b2_3_a_failed_invoke_is_an_error', async () => {
    vi.mocked(replaceVideo).mockRejectedValue('No such video')
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    await expect(outcome).resolves.toEqual({ status: 'error', message: 'No such video' })
    expect(result.current.status).toBe('error')
  })

  it('refuses to start without a selected file', async () => {
    const { result } = renderHook(() => useReplaceUpload())

    const outcome = await result.current.start('vid-1', 'key-123')

    expect(outcome.status).toBe('error')
    expect(replaceVideo).not.toHaveBeenCalled()
  })
})

describe('useReplaceUpload - cancellation', () => {
  it('b2_4_cancel_signals_the_backend_and_waits_for_the_terminal_event', async () => {
    const { result } = renderHook(() => useReplaceUpload())
    const { pending: outcome } = await startReplace(result)

    await act(async () => {
      await result.current.cancel()
    })

    expect(cancelUpload).toHaveBeenCalledWith('op-1')
    // Rust is still tearing the request down. Reporting idle here is the
    // async-cancel gap: the user could leave while the transfer is live.
    expect(result.current.status).toBe('cancelling')

    let settled = false
    void outcome.then(() => {
      settled = true
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(settled).toBe(false)

    await act(async () => {
      await handlers.cancelled?.(
        asEvent({ operationId: 'op-1', bytesSent: 10, totalBytes: 200 })
      )
    })

    await expect(outcome).resolves.toEqual({ status: 'cancelled' })
    await waitFor(() => expect(result.current.status).toBe('idle'))
    // Selections survive so the user can retry without re-picking.
    expect(result.current.selectedFile).toBe('/renders/WBS_intro_v2.mp4')
  })

  it('b2_4_cancel_is_a_no_op_when_nothing_is_running', async () => {
    const { result } = renderHook(() => useReplaceUpload())

    await act(async () => {
      await result.current.cancel()
    })

    expect(cancelUpload).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})
