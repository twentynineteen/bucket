/**
 * Issue #226. Two things about this hook that a user can feel.
 *
 * First, the evidence behind the claim that an unconfigured or unselected
 * project cannot produce a failure alert: the query is gated on `projectPath`,
 * so `baker_get_video_links` is never invoked until a project is chosen. The
 * Rust command itself returns `Ok(Vec::new())` when there is no breadcrumbs
 * file (`src-tauri/src/baker/video_links.rs`), so the empty case is empty
 * rather than an error the whole way down.
 *
 * Second, the Retry offered by the failure alert has to actually re-read the
 * file, which means this hook must hand a working `refetch` to its callers.
 *
 * Only `api.ts`, the I/O boundary, is stubbed; the real query runs.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bakerGetVideoLinks } from '../api'
import { useBreadcrumbsVideoLinks } from './useBreadcrumbsVideoLinks'

vi.mock('../api')

const getVideoLinks = vi.mocked(bakerGetVideoLinks)

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useBreadcrumbsVideoLinks', () => {
  beforeEach(() => {
    getVideoLinks.mockResolvedValue([])
  })

  it('does not read video links until a project folder is chosen', () => {
    const { result } = renderHook(() => useBreadcrumbsVideoLinks({ projectPath: '' }), {
      wrapper
    })

    expect(getVideoLinks).not.toHaveBeenCalled()
    expect(result.current.videoLinks).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('re-reads the video links when a caller retries after a failure', async () => {
    getVideoLinks.mockRejectedValueOnce('Project path does not exist').mockResolvedValue([
      {
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Managing Change'
      }
    ])

    const { result } = renderHook(
      () => useBreadcrumbsVideoLinks({ projectPath: '/Volumes/Production/Induction' }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.error).toBeTruthy())

    await result.current.refetch()

    await waitFor(() => {
      expect(result.current.videoLinks).toHaveLength(1)
    })
    expect(result.current.error).toBeNull()
  })
})
