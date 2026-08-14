/**
 * Tests for usePosterframeSproutUpload - the Posterframe page's Sprout upload
 * action: resolving the target video from a pasted URL or id, the confirmation
 * step, and the send with its retry policy.
 * Issue #142 (B1.2-B1.8, B2.2, B3.1-B3.3, B4.1-B4.6)
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { usePosterframeSproutUpload } from './usePosterframeSproutUpload'

vi.mock('../api', () => ({
  fetchSproutVideoDetails: vi.fn(),
  setSproutPosterFrame: vi.fn()
}))

// The backoff is the one piece that must not really sleep in a test run.
vi.mock('../internal/posterFrame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../internal/posterFrame')>()
  return { ...actual, posterFrameDelay: vi.fn().mockResolvedValue(undefined) }
})

vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  return {
    ...actual,
    useSproutVideoApiKey: vi.fn(() => ({
      apiKey: 'sprout-key',
      isLoading: false,
      error: null
    }))
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

import { useSproutVideoApiKey } from '@shared/hooks'

import { posterFrameDelay } from '../internal/posterFrame'

const API_KEY = 'sprout-key'
const BYTES = new Uint8Array([1, 2, 3, 4])

const DETAILS = {
  id: 'abc123',
  title: 'WBS - MSc - Managing Change',
  duration: 90,
  created_at: '2026-08-01T00:00:00Z',
  assets: { poster_frames: ['https://sproutvideo.com/poster.jpg'] }
}

function renderUploadHook(
  overrides: {
    text?: string
    unavailableReason?: string | null
    renderBytes?: () => Promise<Uint8Array>
    onVideoResolved?: (title: string) => void
  } = {}
) {
  const renderBytes = overrides.renderBytes ?? vi.fn().mockResolvedValue(BYTES)
  const view = renderHook(() =>
    usePosterframeSproutUpload({
      text: overrides.text ?? 'Managing Change',
      unavailableReason: overrides.unavailableReason ?? null,
      renderBytes,
      onVideoResolved: overrides.onVideoResolved
    })
  )
  return { ...view, renderBytes }
}

/** Types a reference into the field and runs Fetch details */
async function resolveVideo(
  result: { current: ReturnType<typeof usePosterframeSproutUpload> },
  reference = 'https://sproutvideo.com/videos/abc123'
) {
  await act(async () => {
    result.current.setVideoReference(reference)
  })
  await act(async () => {
    await result.current.fetchDetails()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useSproutVideoApiKey).mockReturnValue({
    apiKey: API_KEY,
    isLoading: false,
    error: null
  })
  vi.mocked(api.fetchSproutVideoDetails).mockResolvedValue(DETAILS)
  vi.mocked(api.setSproutPosterFrame).mockResolvedValue(undefined)
  vi.mocked(posterFrameDelay).mockResolvedValue(undefined)
})

describe('usePosterframeSproutUpload - resolving the target video', () => {
  it('b1_2_resolves_a_public_url_to_its_video_id_and_reports_the_title', async () => {
    const { result } = renderUploadHook()

    await resolveVideo(result)

    expect(api.fetchSproutVideoDetails).toHaveBeenCalledWith('abc123', API_KEY)
    expect(result.current.resolvedVideo).toEqual({
      id: 'abc123',
      title: 'WBS - MSc - Managing Change'
    })
  })

  it('b1_3_resolves_an_embed_url', async () => {
    const { result } = renderUploadHook()

    await resolveVideo(result, 'https://videos.sproutvideo.com/embed/abc123/tok')

    expect(api.fetchSproutVideoDetails).toHaveBeenCalledWith('abc123', API_KEY)
  })

  it('b1_4_accepts_a_bare_video_id', async () => {
    const { result } = renderUploadHook()

    await resolveVideo(result, ' abc123 ')

    expect(api.fetchSproutVideoDetails).toHaveBeenCalledWith('abc123', API_KEY)
  })

  it('b1_5_refuses_a_non_sprout_reference_without_calling_sprout', async () => {
    const { result } = renderUploadHook()

    await resolveVideo(result, 'https://youtube.com/watch?v=1')

    expect(api.fetchSproutVideoDetails).not.toHaveBeenCalled()
    expect(result.current.fetchError).toMatch(/sprout video url or id/i)
    expect(result.current.resolvedVideo).toBeNull()
  })

  it('b1_6_reports_a_failed_lookup_and_resolves_nothing', async () => {
    vi.mocked(api.fetchSproutVideoDetails).mockRejectedValue(new Error('Not found'))
    const { result } = renderUploadHook()

    await resolveVideo(result)

    expect(result.current.resolvedVideo).toBeNull()
    expect(result.current.fetchError).toMatch(/not found/i)
    expect(result.current.blockedReason).not.toBeNull()
  })

  it('b1_7_discards_the_resolution_when_the_reference_is_edited', async () => {
    const { result } = renderUploadHook()
    await resolveVideo(result)
    expect(result.current.resolvedVideo).not.toBeNull()

    await act(async () => {
      result.current.setVideoReference('https://sproutvideo.com/videos/other99')
    })

    // An upload must never target a video the field no longer names.
    expect(result.current.resolvedVideo).toBeNull()
    expect(result.current.blockedReason).not.toBeNull()
  })

  it('b1_8_blocks_everything_without_a_configured_api_key', async () => {
    vi.mocked(useSproutVideoApiKey).mockReturnValue({
      apiKey: null,
      isLoading: false,
      error: null
    })
    const { result } = renderUploadHook()

    await resolveVideo(result)

    expect(api.fetchSproutVideoDetails).not.toHaveBeenCalled()
    expect(result.current.canFetch).toBe(false)
    expect(result.current.blockedReason).toMatch(/settings/i)
  })

  it('b1_9_hands_the_resolved_title_to_the_caller', async () => {
    const onVideoResolved = vi.fn()
    const { result } = renderUploadHook({ onVideoResolved })

    await resolveVideo(result)

    expect(onVideoResolved).toHaveBeenCalledWith('WBS - MSc - Managing Change')
  })
})

describe('usePosterframeSproutUpload - gating', () => {
  it('b2_2_refuses_a_blank_poster_frame_text', async () => {
    const { result } = renderUploadHook({ text: '   ' })
    await resolveVideo(result)

    expect(result.current.blockedReason).toMatch(/text/i)
  })

  it('b2_3_reports_the_callers_own_reason_first', async () => {
    const { result } = renderUploadHook({
      unavailableReason: 'Select a background image first.'
    })
    await resolveVideo(result)

    expect(result.current.blockedReason).toBe('Select a background image first.')
  })

  it('is unblocked once a video, a background and text are all present', async () => {
    const { result } = renderUploadHook()
    await resolveVideo(result)

    expect(result.current.blockedReason).toBeNull()
  })
})

describe('usePosterframeSproutUpload - confirmation', () => {
  it('b3_1_asks_for_confirmation_before_sending_anything', async () => {
    const { result, renderBytes } = renderUploadHook()
    await resolveVideo(result)

    await act(async () => {
      result.current.requestUpload()
    })

    expect(result.current.confirmOpen).toBe(true)
    expect(renderBytes).not.toHaveBeenCalled()
    expect(api.setSproutPosterFrame).not.toHaveBeenCalled()
  })

  it('b3_1_does_not_open_the_confirmation_while_blocked', async () => {
    const { result } = renderUploadHook({ text: '' })
    await resolveVideo(result)

    await act(async () => {
      result.current.requestUpload()
    })

    expect(result.current.confirmOpen).toBe(false)
  })

  it('b3_2_sends_nothing_when_the_confirmation_is_dismissed', async () => {
    const { result } = renderUploadHook()
    await resolveVideo(result)

    await act(async () => {
      result.current.requestUpload()
    })
    await act(async () => {
      result.current.setConfirmOpen(false)
    })

    expect(api.setSproutPosterFrame).not.toHaveBeenCalled()
  })

  it('b3_3_sends_the_exported_frame_to_the_resolved_video', async () => {
    const { result, renderBytes } = renderUploadHook({ text: 'Managing Change' })
    await resolveVideo(result)

    await act(async () => {
      await result.current.confirmUpload()
    })

    expect(renderBytes).toHaveBeenCalled()
    expect(api.setSproutPosterFrame).toHaveBeenCalledWith(
      'abc123',
      API_KEY,
      BYTES,
      'posterframe-Managing_Change.jpg'
    )
    expect(result.current.confirmOpen).toBe(false)
    expect(result.current.status).toBe('success')
  })
})

describe('usePosterframeSproutUpload - outcome', () => {
  it('b4_1_reports_working_while_the_request_is_in_flight', async () => {
    let release: (() => void) | undefined
    vi.mocked(api.setSproutPosterFrame).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve()
        })
    )
    const { result } = renderUploadHook()
    await resolveVideo(result)

    let pending: Promise<void> | undefined
    await act(async () => {
      pending = result.current.confirmUpload()
    })

    expect(result.current.status).toBe('working')

    await act(async () => {
      release?.()
      await pending
    })
    expect(result.current.status).toBe('success')
  })

  it('b4_3_retries_a_transient_failure_three_times_with_backoff', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValue({
      status: null,
      message: 'connection reset'
    })
    const { result } = renderUploadHook()
    await resolveVideo(result)

    await act(async () => {
      await result.current.confirmUpload()
    })

    expect(api.setSproutPosterFrame).toHaveBeenCalledTimes(4)
    expect(vi.mocked(posterFrameDelay).mock.calls.map(([ms]) => ms)).toEqual([
      2000, 5000, 10000
    ])
    expect(result.current.status).toBe('error')
  })

  it('b4_4_does_not_retry_a_413_and_names_the_size_against_the_limit', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValue({
      status: 413,
      message: 'Payload too large'
    })
    const { result } = renderUploadHook()
    await resolveVideo(result)

    await act(async () => {
      await result.current.confirmUpload()
    })

    expect(api.setSproutPosterFrame).toHaveBeenCalledTimes(1)
    expect(result.current.error).toMatch(/500 KB/)
    expect(result.current.status).toBe('error')
  })

  it('b4_5_retry_re_sends_to_the_same_video', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValueOnce({
      status: 500,
      message: 'boom'
    })
    const { result } = renderUploadHook()
    await resolveVideo(result)

    await act(async () => {
      await result.current.confirmUpload()
    })
    vi.mocked(api.setSproutPosterFrame).mockResolvedValue(undefined)
    await act(async () => {
      await result.current.retry()
    })

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(vi.mocked(api.setSproutPosterFrame).mock.lastCall?.[0]).toBe('abc123')
  })

  it('b4_6_sends_nothing_when_the_frame_cannot_be_rendered_within_the_limit', async () => {
    const renderBytes = vi.fn().mockRejectedValue(new Error('Poster frame is 600 KB'))
    const { result } = renderUploadHook({ renderBytes })
    await resolveVideo(result)

    await act(async () => {
      await result.current.confirmUpload()
    })

    expect(api.setSproutPosterFrame).not.toHaveBeenCalled()
    expect(result.current.error).toMatch(/600 KB/)
    expect(result.current.status).toBe('error')
  })
})
