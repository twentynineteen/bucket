/**
 * useSproutFolders -- rate-limit behaviour (issue #155, R2-R4)
 *
 * Sprout allows 200 requests/minute per ACCOUNT, shared with uploads. These
 * tests pin the three properties that keep folder browsing from spending a
 * budget an in-flight upload needs.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({ getFolders: vi.fn() }))

import { getFolders } from '../api'
import { DWELL_MS, useSproutFolders } from './useSproutFolders'

const page = {
  folders: [{ id: 'f1', name: 'Marketing', parent_id: null }],
  total: 1,
  truncated: false,
  rate_limit_remaining: 190,
  rate_limit_reset: null
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(getFolders).mockResolvedValue(page)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('R2: hovering must not fetch', () => {
  it('issues nothing while the submenu is open for less than the dwell', async () => {
    // A mouse sweep opens each submenu for a fraction of a second. Without the
    // dwell gate, sweeping 20 folders would be 20 requests.
    const { rerender } = renderHook(
      ({ isOpen }) => useSproutFolders({ apiKey: 'k', parentId: 'f1', isOpen }),
      { wrapper: wrapper(freshClient()), initialProps: { isOpen: true } }
    )

    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS - 50))
    rerender({ isOpen: false })
    await act(() => vi.advanceTimersByTimeAsync(1000))

    expect(getFolders).not.toHaveBeenCalled()
  })

  it('issues nothing for five submenus opened and closed in a sweep', async () => {
    const client = freshClient()

    for (const parentId of ['a', 'b', 'c', 'd', 'e']) {
      const { rerender, unmount } = renderHook(
        ({ isOpen }) => useSproutFolders({ apiKey: 'k', parentId, isOpen }),
        { wrapper: wrapper(client), initialProps: { isOpen: true } }
      )
      await act(() => vi.advanceTimersByTimeAsync(100))
      rerender({ isOpen: false })
      unmount()
    }

    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(getFolders).not.toHaveBeenCalled()
  })

  it('issues exactly one request once the submenu is held past the dwell', async () => {
    renderHook(() => useSproutFolders({ apiKey: 'k', parentId: 'f1', isOpen: true }), {
      wrapper: wrapper(freshClient())
    })

    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))

    expect(getFolders).toHaveBeenCalledTimes(1)
    expect(getFolders).toHaveBeenCalledWith('k', 'f1')
  })

  it('stays idle without an API key however long it is open', async () => {
    renderHook(() => useSproutFolders({ apiKey: null, parentId: null, isOpen: true }), {
      wrapper: wrapper(freshClient())
    })

    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(getFolders).not.toHaveBeenCalled()
  })
})

describe('R3: reopening a level must be free', () => {
  it('does not refetch a level already loaded this session', async () => {
    const client = freshClient()

    const first = renderHook(
      () => useSproutFolders({ apiKey: 'k', parentId: 'f1', isOpen: true }),
      { wrapper: wrapper(client) }
    )
    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))
    expect(getFolders).toHaveBeenCalledTimes(1)
    first.unmount()

    // Reopening the picker after an upload is the most common interaction.
    renderHook(() => useSproutFolders({ apiKey: 'k', parentId: 'f1', isOpen: true }), {
      wrapper: wrapper(client)
    })
    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))

    expect(getFolders).toHaveBeenCalledTimes(1)
  })
})

describe('R4: rate limits and auth failures are never retried', () => {
  it('does not retry a 429', async () => {
    // Retrying spends more of a budget that is already exhausted, while the
    // window is still closed.
    vi.mocked(getFolders).mockRejectedValue(
      'Sprout rate limit reached (HTTP 429). Try again in 30 seconds.'
    )

    const { result } = renderHook(
      () => useSproutFolders({ apiKey: 'k', parentId: null, isOpen: true }),
      { wrapper: wrapper(freshClient()) }
    )

    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))
    // A second flush: the rejection settles one microtask after the fetch.
    await act(() => vi.advanceTimersByTimeAsync(10))

    expect(result.current.isError).toBe(true)
    expect(getFolders).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 401', async () => {
    vi.mocked(getFolders).mockRejectedValue(
      'Sprout rejected the folder request: HTTP 401 — check your Sprout Video API key in Settings.'
    )

    const { result } = renderHook(
      () => useSproutFolders({ apiKey: 'k', parentId: null, isOpen: true }),
      { wrapper: wrapper(freshClient()) }
    )

    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))
    // A second flush: the rejection settles one microtask after the fetch.
    await act(() => vi.advanceTimersByTimeAsync(10))

    expect(result.current.isError).toBe(true)
    expect(getFolders).toHaveBeenCalledTimes(1)
  })

  it('retries a transport error once', async () => {
    vi.mocked(getFolders).mockRejectedValue('Could not reach Sprout Video: timeout')

    const { result } = renderHook(
      () => useSproutFolders({ apiKey: 'k', parentId: null, isOpen: true }),
      { wrapper: wrapper(freshClient()) }
    )

    await act(() => vi.advanceTimersByTimeAsync(DWELL_MS + 50))
    await act(() => vi.advanceTimersByTimeAsync(30_000))

    expect(result.current.isError).toBe(true)
    expect(getFolders).toHaveBeenCalledTimes(2)
  })
})
