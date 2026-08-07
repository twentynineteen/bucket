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
  error: null as Listener | null
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
      eventBus.error?.({ payload })
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
      eventBus.error?.({ payload })
    })

    await waitFor(() => {
      expect(result.current.message).toEqual({ text: payload, severity: 'error' })
    })
  })

  it('marks upload_complete as a success', async () => {
    const { result } = await renderUploadEvents()

    await act(async () => {
      eventBus.complete?.({ payload: { id: 'video-1' } })
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
      eventBus.error?.({ payload })
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
      eventBus.progress?.({ payload: 42 })
    })

    await waitFor(() => {
      expect(result.current.progress).toBe(42)
    })
    expect(result.current.message).toBeNull()
  })
})
