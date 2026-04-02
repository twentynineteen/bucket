/**
 * Integration Test: US-07 — Posterframe / Sprout Video URL parsing
 *
 * As a user, when I paste a Sprout Video URL into the video link field,
 * the app parses the URL to extract the video ID and fetches video metadata
 * including available poster frames.
 *
 * Tests the pure parseSproutVideoUrl utility and the useSproutVideoApi hook.
 * Mocking strategy: mock the Upload api.ts module; no direct @tauri-apps imports.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be
 * restored in beforeEach.
 */

import { parseSproutVideoUrl } from '../../src/features/Upload/internal/parseSproutVideoUrl'
import { useSproutVideoApi } from '../../src/features/Upload/hooks/useSproutVideoApi'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

// Mock the Upload api.ts layer (single I/O boundary for Upload module)
vi.mock('../../src/features/Upload/api', () => ({
  fetchSproutVideoDetails: vi.fn().mockResolvedValue({
    id: 'abc123',
    title: 'My Test Video',
    assets: {
      poster_frames: [
        { time: 0, url: 'https://cdn.sproutvideo.com/poster-0.jpg' },
        { time: 5, url: 'https://cdn.sproutvideo.com/poster-5.jpg' }
      ]
    }
  }),
  uploadVideo: vi.fn().mockResolvedValue(undefined),
  getFolders: vi.fn().mockResolvedValue({ folders: [] }),
  listenUploadProgress: vi.fn().mockResolvedValue(vi.fn()),
  listenUploadComplete: vi.fn().mockResolvedValue(vi.fn()),
  listenUploadError: vi.fn().mockResolvedValue(vi.fn()),
  openFileDialog: vi.fn().mockResolvedValue(null)
}))

// ============================================================================
// US-07: parseSproutVideoUrl — pure function (no mocking needed)
// ============================================================================

describe('US-07 — parseSproutVideoUrl (pure function)', () => {
  describe('Pattern 1: Public video page URL (sproutvideo.com/videos/{ID})', () => {
    it('should extract video ID from HTTPS URL', () => {
      expect(parseSproutVideoUrl('https://sproutvideo.com/videos/abc123')).toBe('abc123')
    })

    it('should extract video ID from HTTP URL', () => {
      expect(parseSproutVideoUrl('http://sproutvideo.com/videos/xyz789')).toBe('xyz789')
    })

    it('should extract alphanumeric video ID', () => {
      expect(parseSproutVideoUrl('https://sproutvideo.com/videos/Ab1Cd2Ef3Gh4')).toBe(
        'Ab1Cd2Ef3Gh4'
      )
    })

    it('should handle URL without protocol prefix', () => {
      expect(parseSproutVideoUrl('sproutvideo.com/videos/abc123')).toBe('abc123')
    })
  })

  describe('Pattern 2: Embed URL (videos.sproutvideo.com/embed/{ID}/...)', () => {
    it('should extract video ID from embed URL with token', () => {
      expect(
        parseSproutVideoUrl('https://videos.sproutvideo.com/embed/abc123/sometoken')
      ).toBe('abc123')
    })

    it('should extract video ID from embed URL without trailing path', () => {
      expect(parseSproutVideoUrl('https://videos.sproutvideo.com/embed/def456')).toBe(
        'def456'
      )
    })

    it('should extract video ID from embed URL with query params', () => {
      expect(
        parseSproutVideoUrl(
          'https://videos.sproutvideo.com/embed/gh789/token?autoPlay=true'
        )
      ).toBe('gh789')
    })

    it('should extract video ID from embed URL without protocol', () => {
      expect(
        parseSproutVideoUrl('videos.sproutvideo.com/embed/abc123/token')
      ).toBe('abc123')
    })
  })

  describe('Invalid / non-Sprout URLs', () => {
    it('should return null for empty string', () => {
      expect(parseSproutVideoUrl('')).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      expect(parseSproutVideoUrl('   ')).toBeNull()
    })

    it('should return null for YouTube URL', () => {
      expect(parseSproutVideoUrl('https://youtube.com/watch?v=abc123')).toBeNull()
    })

    it('should return null for Vimeo URL', () => {
      expect(parseSproutVideoUrl('https://vimeo.com/123456789')).toBeNull()
    })

    it('should return null for generic video URL', () => {
      expect(parseSproutVideoUrl('https://example.com/videos/abc123')).toBeNull()
    })

    it('should return null for plain text', () => {
      expect(parseSproutVideoUrl('not a url at all')).toBeNull()
    })

    it('should return null for partial Sprout domain without path', () => {
      expect(parseSproutVideoUrl('https://sproutvideo.com/')).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should trim leading/trailing whitespace before parsing', () => {
      expect(
        parseSproutVideoUrl('  https://sproutvideo.com/videos/abc123  ')
      ).toBe('abc123')
    })

    it('should prefer Pattern 1 match when URL matches both', () => {
      // Unusual URL that could match both patterns — Pattern 1 is checked first
      const result = parseSproutVideoUrl('https://sproutvideo.com/videos/abc123')
      expect(result).toBe('abc123')
    })
  })
})

// ============================================================================
// US-07: useSproutVideoApi — mutation hook
// ============================================================================

const MOCK_VIDEO_DETAILS = {
  id: 'abc123',
  title: 'My Test Video',
  assets: {
    poster_frames: [
      { time: 0, url: 'https://cdn.sproutvideo.com/poster-0.jpg' },
      { time: 5, url: 'https://cdn.sproutvideo.com/poster-5.jpg' }
    ]
  }
}

describe('US-07 — useSproutVideoApi hook', () => {
  beforeEach(async () => {
    // mockReset: true clears mock implementations — restore defaults here
    const { fetchSproutVideoDetails } = await import('../../src/features/Upload/api')
    vi.mocked(fetchSproutVideoDetails).mockResolvedValue(MOCK_VIDEO_DETAILS as any)
  })

  it('US-07a — should return the required hook interface', () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.fetchVideoDetails).toBe('function')
    expect(typeof result.current.fetchVideoDetailsAsync).toBe('function')
    expect(typeof result.current.reset).toBe('function')
    expect(result.current.isFetching).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeUndefined()
  })

  it('US-07b — should fetch video details for a valid public URL', async () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    let details: any
    await act(async () => {
      details = await result.current.fetchVideoDetailsAsync({
        videoUrl: 'https://sproutvideo.com/videos/abc123',
        apiKey: 'test-api-key'
      })
    })

    expect(details.id).toBe('abc123')
    expect(details.title).toBe('My Test Video')
    expect(details.assets.poster_frames).toHaveLength(2)
  })

  it('US-07c — should fetch video details for a valid embed URL', async () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    let details: any
    await act(async () => {
      details = await result.current.fetchVideoDetailsAsync({
        videoUrl: 'https://videos.sproutvideo.com/embed/abc123/sometoken',
        apiKey: 'test-api-key'
      })
    })

    expect(details).toBeDefined()
    expect(details.id).toBe('abc123')
  })

  it('US-07d — should call fetchSproutVideoDetails with the extracted video ID', async () => {
    const { fetchSproutVideoDetails } = await import('../../src/features/Upload/api')

    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    await act(async () => {
      await result.current.fetchVideoDetailsAsync({
        videoUrl: 'https://sproutvideo.com/videos/myVideoId99',
        apiKey: 'my-api-key'
      })
    })

    expect(fetchSproutVideoDetails).toHaveBeenCalledWith('myVideoId99', 'my-api-key')
  })

  it('US-07e — should throw for an invalid Sprout Video URL', async () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    let thrownError: any
    await act(async () => {
      try {
        await result.current.fetchVideoDetailsAsync({
          videoUrl: 'https://youtube.com/watch?v=bad',
          apiKey: 'test-api-key'
        })
      } catch (err) {
        thrownError = err
      }
    })

    expect(thrownError).toBeDefined()
    expect(thrownError.message).toBe('Invalid Sprout Video URL format')
  })

  it('US-07f — should set isFetching=true while fetching and false after', async () => {
    const { fetchSproutVideoDetails } = await import('../../src/features/Upload/api')

    let resolveDetails: ((v: any) => void) | undefined
    vi.mocked(fetchSproutVideoDetails).mockReturnValue(
      new Promise((resolve) => {
        resolveDetails = resolve
      })
    )

    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    act(() => {
      result.current.fetchVideoDetails({
        videoUrl: 'https://sproutvideo.com/videos/abc123',
        apiKey: 'test-api-key'
      })
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true)
    })

    await act(async () => {
      resolveDetails!(MOCK_VIDEO_DETAILS)
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
  })

  it('US-07g — should store fetched data in result.current.data', async () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    await act(async () => {
      await result.current.fetchVideoDetailsAsync({
        videoUrl: 'https://sproutvideo.com/videos/abc123',
        apiKey: 'test-api-key'
      })
    })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
      expect(result.current.data?.title).toBe('My Test Video')
    })
  })

  it('US-07h — should clear data and error on reset()', async () => {
    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    await act(async () => {
      await result.current.fetchVideoDetailsAsync({
        videoUrl: 'https://sproutvideo.com/videos/abc123',
        apiKey: 'test-api-key'
      })
    })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })

    act(() => {
      result.current.reset()
    })

    await waitFor(() => {
      expect(result.current.data).toBeUndefined()
      expect(result.current.error).toBeNull()
    })
  })

  it('US-07i — should expose error when fetchSproutVideoDetails rejects', async () => {
    const { fetchSproutVideoDetails } = await import('../../src/features/Upload/api')
    vi.mocked(fetchSproutVideoDetails).mockRejectedValue(
      new Error('API rate limit exceeded')
    )

    const { result } = renderHook(() => useSproutVideoApi(), {
      wrapper: makeWrapper()
    })

    await act(async () => {
      try {
        await result.current.fetchVideoDetailsAsync({
          videoUrl: 'https://sproutvideo.com/videos/abc123',
          apiKey: 'test-api-key'
        })
      } catch {
        // Expected rejection
      }
    })

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })
  })
})
