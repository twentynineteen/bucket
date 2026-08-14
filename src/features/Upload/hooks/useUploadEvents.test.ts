/**
 * UPLOAD-01 — upload message severity comes from WHICH backend event fired,
 * never from sniffing the message text.
 *
 * The regression this locks down: the backend now emits
 * "Sprout rejected the upload: HTTP 413 — <excerpt>", which contains neither
 * "failed" nor "success", so text-sniffing consumers rendered a hard failure
 * as a neutral (or worse, a green) notice.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUploadEvents } from './useUploadEvents'

type Listener = (event: { payload: unknown }) => void

// Plain functions (not vi.fn) so the suite-wide `mockReset: true` cannot strip
// the implementations before a test runs.
const eventBus = vi.hoisted(() => ({
  failSetup: false,
  progress: null as Listener | null,
  complete: null as Listener | null,
  error: null as Listener | null,
  cancelled: null as Listener | null,
  stallWarning: null as Listener | null
}))

vi.mock('../api', () => ({
  listenUploadProgress: async (cb: Listener) => {
    if (eventBus.failSetup) {
      // Let the query's own resolver land first so the catch-path write is the
      // last one to touch the cache.
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('listen() rejected')
    }
    eventBus.progress = cb
    return () => {}
  },
  listenUploadComplete: async (cb: Listener) => {
    if (eventBus.failSetup) {
      // Let the query's own resolver land first so the catch-path write is the
      // last one to touch the cache.
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('listen() rejected')
    }
    eventBus.complete = cb
    return () => {}
  },
  listenUploadError: async (cb: Listener) => {
    if (eventBus.failSetup) {
      // Let the query's own resolver land first so the catch-path write is the
      // last one to touch the cache.
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('listen() rejected')
    }
    eventBus.error = cb
    return () => {}
  },
  listenUploadCancelled: async (cb: Listener) => {
    if (eventBus.failSetup) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('listen() rejected')
    }
    eventBus.cancelled = cb
    return () => {}
  },
  listenUploadStallWarning: async (cb: Listener) => {
    if (eventBus.failSetup) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw new Error('listen() rejected')
    }
    eventBus.stallWarning = cb
    return () => {}
  }
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { wrapper, queryClient }
}

const renderUploadEvents = async () => {
  const { wrapper, queryClient } = createWrapper()
  const view = renderHook(() => useUploadEvents(), { wrapper })

  if (!eventBus.failSetup) {
    await waitFor(() => {
      expect(eventBus.error).not.toBeNull()
      expect(eventBus.complete).not.toBeNull()
    })
  }

  return { ...view, queryClient }
}

beforeEach(() => {
  eventBus.failSetup = false
  eventBus.progress = null
  eventBus.complete = null
  eventBus.error = null
  eventBus.cancelled = null
  eventBus.stallWarning = null
})

/** One `upload_progress` payload, as Rust's `ProgressReader` sends it. */
const progressEvent = (percentage: number, bytesSent: number, totalBytes: number) => ({
  payload: { operationId: 'op-1', bytesSent, totalBytes, percentage }
})

describe('UPLOAD-01: message severity is derived from the event, not the text', () => {
  it('marks an upload_error payload as an error even when it says neither "failed" nor "success"', async () => {
    const payload =
      'Sprout rejected the upload: HTTP 413 — <html><body>Request Entity Too Large</body></html>'

    // Guard: the whole regression is that this text defeats text sniffing.
    expect(payload.toLowerCase()).not.toContain('failed')
    expect(payload.toLowerCase()).not.toContain('success')

    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.error?.({ payload: { operationId: 'op-1', message: payload } })
    })

    await waitFor(() => {
      expect(result.current.message).toEqual({ text: payload, severity: 'error' })
    })
    expect(result.current.uploading).toBe(false)
  })

  it('marks a non-JSON body rejection as an error', async () => {
    const payload =
      'Sprout returned HTTP 200 but the response body was not valid JSON (…)'

    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.error?.({ payload: { operationId: 'op-1', message: payload } })
    })

    await waitFor(() => {
      expect(result.current.message).toEqual({ text: payload, severity: 'error' })
    })
  })

  it('marks upload_complete as a success', async () => {
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.complete?.({
        payload: { operationId: 'op-1', video: { id: 'video-1' } }
      })
    })

    await waitFor(() => {
      expect(result.current.message).toEqual({
        text: 'Upload successful',
        severity: 'success'
      })
    })
    expect(result.current.progress).toBe(100)
    expect(result.current.uploading).toBe(false)
  })

  it('does not downgrade an error whose text happens to contain "success"', async () => {
    const payload = 'Operation completed — 0 successes recorded'

    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.error?.({ payload: { operationId: 'op-1', message: payload } })
    })

    await waitFor(() => {
      expect(result.current.message).toEqual({ text: payload, severity: 'error' })
    })
  })

  it('reports a listener setup failure as an error', async () => {
    eventBus.failSetup = true

    const { result } = await renderUploadEvents()

    await waitFor(() => {
      expect(result.current.message).toEqual({
        text: 'Failed to setup event listeners',
        severity: 'error'
      })
    })
  })

  it('leaves the message alone while progress ticks', async () => {
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.progress?.(progressEvent(42, 1_722_000_000, 4_100_000_000))
    })

    await waitFor(() => {
      expect(result.current.progress).toBe(42)
    })
    expect(result.current.message).toBeNull()
  })
})

// --- Byte counts, the soft warning and cancellation (issue #225) ---

describe('UPLOAD-225: the dialog can tell a slow upload from a frozen one', () => {
  it('surfaces the byte counts the progress event now carries', async () => {
    // UP-30. A percentage alone cannot tell 3% of 200 MB from 3% of 12 GB, which
    // is exactly the judgement a user makes when deciding whether to keep waiting.
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.progress?.(progressEvent(41.2, 1_680_000_000, 4_100_000_000))
    })

    await waitFor(() => {
      expect(result.current.bytesSent).toBe(1_680_000_000)
    })
    expect(result.current.totalBytes).toBe(4_100_000_000)
    expect(result.current.progress).toBe(41)
  })

  it('shows a stall warning without ending the upload', async () => {
    // UP-26. The warning is non-terminal by design: a recoverable TCP backoff is
    // legitimate for tens of seconds, so this informs rather than acts.
    const { result } = await renderUploadEvents()

    // The page marks the upload as running; nothing in the event stream does, so
    // the state has to be put there before a warning can be shown not to clear it.
    await act(async () => {
      result.current.setUploading(true)
    })

    await act(async () => {
      eventBus.progress?.(progressEvent(41, 1_680_000_000, 4_100_000_000))
      eventBus.stallWarning?.({
        payload: {
          operationId: 'op-1',
          bytesSent: 1_680_000_000,
          totalBytes: 4_100_000_000,
          silentForSeconds: 35,
          message: 'No data has reached Sprout for 35s.'
        }
      })
    })

    await waitFor(() => {
      expect(result.current.stallWarning).toBe('No data has reached Sprout for 35s.')
    })
    // The warning must not masquerade as the terminal verdict: nothing about it
    // ends the upload or turns the panel red.
    expect(result.current.uploading).toBe(true)
    expect(result.current.message).toBeNull()
  })

  it('withdraws the warning when progress resumes', async () => {
    // UP-27. A warning left standing after recovery tells the user to cancel
    // something that is working.
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.stallWarning?.({
        payload: {
          operationId: 'op-1',
          bytesSent: 1_680_000_000,
          totalBytes: 4_100_000_000,
          silentForSeconds: 35,
          message: 'No data has reached Sprout for 35s.'
        }
      })
    })
    await waitFor(() => expect(result.current.stallWarning).not.toBeNull())

    await act(async () => {
      eventBus.stallWarning?.({
        payload: {
          operationId: 'op-1',
          bytesSent: 1_800_000_000,
          totalBytes: 4_100_000_000,
          silentForSeconds: 0,
          message: null
        }
      })
    })

    await waitFor(() => {
      expect(result.current.stallWarning).toBeNull()
    })
  })

  it('reads a cancellation as neutral, never as an error', async () => {
    // UP-21. The user asked for this. Styling it as a failure reads as though the
    // app went wrong, which is the severity-from-the-event discipline UPLOAD-01
    // established applied to a fifth outcome.
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.cancelled?.({
        payload: {
          operationId: 'op-1',
          bytesSent: 1_680_000_000,
          totalBytes: 4_100_000_000
        }
      })
    })

    await waitFor(() => {
      expect(result.current.message?.severity).toBe('info')
    })
    expect(result.current.message?.text.toLowerCase()).toContain('cancel')
    expect(result.current.uploading).toBe(false)
  })

  it('clears a standing stall warning when the upload settles', async () => {
    // A warning outliving the upload it described would sit under a finished
    // panel advising the user to cancel a transfer that is already over.
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.stallWarning?.({
        payload: {
          operationId: 'op-1',
          bytesSent: 1_680_000_000,
          totalBytes: 4_100_000_000,
          silentForSeconds: 35,
          message: 'No data has reached Sprout for 35s.'
        }
      })
    })
    await waitFor(() => expect(result.current.stallWarning).not.toBeNull())

    await act(async () => {
      eventBus.error?.({
        payload: { operationId: 'op-1', message: 'Sprout rejected the upload' }
      })
    })

    await waitFor(() => {
      expect(result.current.stallWarning).toBeNull()
    })
  })
})
