/**
 * Tests for usePosterFrameForUpload — the hook that prepares a branded poster
 * frame during a Baker video upload and pushes it to Sprout Video.
 * Issue #140 (B1.2-B1.5, B2.1-B2.3, B3.5, B3.6, B5.1-B5.6, B6.1, B6.2, B7.2, B7.5, B7.6)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '@shared/store'

import * as api from '../api'
import { usePosterFrameForUpload } from './usePosterFrameForUpload'

// Issue #166: listDirectory returns a tagged result rather than a bare array,
// so a missing folder is distinguishable from an empty one.
vi.mock('../api', () => ({
  listDirectory: vi.fn().mockResolvedValue({ status: 'ok', files: [] }),
  readFileAsBytes: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  getFontDir: vi.fn().mockResolvedValue('/fonts'),
  fileExists: vi.fn().mockResolvedValue(true),
  posterFrameFontAvailable: vi.fn().mockResolvedValue(true),
  setSproutPosterFrame: vi.fn().mockResolvedValue(undefined),
  savePosterFrameCopy: vi.fn().mockResolvedValue('/projects/demo/Graphics/x.jpg'),
  fetchSproutVideoDetails: vi.fn().mockResolvedValue({
    id: 'vid1',
    title: 'Managing Change',
    duration: 90,
    created_at: '2026-08-01T00:00:00Z',
    assets: { poster_frames: ['https://sproutvideo.com/custom-poster.jpg'] }
  })
}))

// useBackgroundFolder now reads the settings query's status so it can tell
// "not configured" from "settings not loaded yet" from "settings unreadable"
// (issue #166 B2.1-B2.3). Report settings as loaded unless a test says otherwise.
vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  return {
    ...actual,
    useApiKeys: vi.fn(() => ({ isPending: false, isError: false, error: null }))
  }
})

// The canvas export and the retry sleeps are the two pieces that cannot run in
// jsdom; everything else in the internals module stays real.
vi.mock('../internal/posterFrame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../internal/posterFrame')>()
  return {
    ...actual,
    exportCanvasJpeg: vi.fn().mockResolvedValue(new Uint8Array([9, 9, 9, 9])),
    posterFrameDelay: vi.fn().mockResolvedValue(undefined)
  }
})

import { exportCanvasJpeg, posterFrameDelay } from '../internal/posterFrame'

const BACKGROUNDS = ['/backgrounds/wbs-blue.jpg', '/backgrounds/wbs-red.png']
const PROJECT_PATH = '/projects/demo'
const PREFS_KEY = 'posterframe-upload-preferences'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

/**
 * A client whose default IS to retry, so a test asserting "did not retry"
 * exercises the query's own `retry: false` rather than the harness's (#166).
 */
function retryingWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 1, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function renderPosterFrameHook(
  videoTitle = 'WBS - MSc - Managing Change',
  hookWrapper = wrapper
) {
  return renderHook(
    (props: { videoTitle: string }) =>
      usePosterFrameForUpload({
        projectPath: PROJECT_PATH,
        videoTitle: props.videoTitle
      }),
    { initialProps: { videoTitle }, wrapper: hookWrapper }
  )
}

beforeAll(() => {
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:poster' })
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined })
  }
})

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ defaultBackgroundFolder: '/backgrounds' })
  vi.mocked(api.listDirectory).mockResolvedValue({ status: 'ok', files: BACKGROUNDS })
  vi.mocked(api.posterFrameFontAvailable).mockResolvedValue(true)
  vi.mocked(api.setSproutPosterFrame).mockResolvedValue(undefined)
  vi.mocked(api.savePosterFrameCopy).mockResolvedValue(
    '/projects/demo/Graphics/posterframe-Managing_Change.jpg'
  )
  vi.mocked(api.fetchSproutVideoDetails).mockResolvedValue({
    id: 'vid1',
    title: 'Managing Change',
    duration: 90,
    created_at: '2026-08-01T00:00:00Z',
    assets: { poster_frames: ['https://sproutvideo.com/custom-poster.jpg'] }
  })
  vi.mocked(exportCanvasJpeg).mockResolvedValue(new Uint8Array([9, 9, 9, 9]))
  vi.mocked(posterFrameDelay).mockResolvedValue(undefined)
})

afterEach(() => {
  useAppStore.setState({ defaultBackgroundFolder: null })
})

describe('usePosterFrameForUpload - availability', () => {
  it('is available when the font, folder and images are all present', async () => {
    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.available).toBe(true))
    expect(result.current.unavailableReason).toBeNull()
  })

  it('b1_3_is_unavailable_when_the_cabrito_font_is_missing', async () => {
    vi.mocked(api.posterFrameFontAvailable).mockResolvedValue(false)

    const { result } = renderPosterFrameHook()

    // The gating checks resolve asynchronously — wait for the reason itself
    await waitFor(() => expect(result.current.unavailableReason).toMatch(/Cabrito/i))
    expect(result.current.available).toBe(false)
  })

  it('b1_4_is_unavailable_without_a_default_background_folder', async () => {
    useAppStore.setState({ defaultBackgroundFolder: null })

    const { result } = renderPosterFrameHook()

    // The gating checks resolve asynchronously — wait for the reason itself
    await waitFor(() => expect(result.current.unavailableReason).toMatch(/settings/i))
    expect(result.current.available).toBe(false)
  })

  it('b1_5_is_unavailable_when_the_background_folder_has_no_images', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'ok', files: [] })

    const { result } = renderPosterFrameHook()

    // The gating checks resolve asynchronously — wait for the reason itself
    await waitFor(() => expect(result.current.unavailableReason).toMatch(/no image/i))
    expect(result.current.available).toBe(false)
  })
})

describe('usePosterFrameForUpload - accurate unavailable reasons (#166)', () => {
  it('b6_1_names_a_missing_folder_instead_of_claiming_it_is_empty', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'missing' })

    const { result } = renderPosterFrameHook()

    await waitFor(() =>
      expect(result.current.unavailableReason).toBe(
        'Cannot read background folder: /backgrounds'
      )
    )
    expect(result.current.unavailableReason).not.toMatch(/no image/i)
    expect(result.current.available).toBe(false)
  })

  it('b6_1_names_an_unreadable_folder_the_same_way', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({
      status: 'unreadable',
      detail: 'os error 13'
    })

    const { result } = renderPosterFrameHook()

    await waitFor(() =>
      expect(result.current.unavailableReason).toBe(
        'Cannot read background folder: /backgrounds'
      )
    )
    // The detail belongs in the log, not in front of the user.
    expect(result.current.unavailableReason).not.toContain('os error 13')
  })

  it('b6_3_distinguishes_a_failed_font_check_from_an_absent_font', async () => {
    vi.mocked(api.posterFrameFontAvailable).mockRejectedValue(new Error('probe failed'))

    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.unavailableReason).not.toBeNull())
    // Blaming a missing font for a check that never completed is the same
    // misattribution as claiming an absent folder is empty.
    expect(result.current.unavailableReason).toMatch(/could not check/i)
    expect(result.current.unavailableReason).not.toMatch(/requires Cabrito/i)
    expect(result.current.available).toBe(false)
  })

  it('b6_2_still_names_an_empty_folder_exactly', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'ok', files: [] })

    const { result } = renderPosterFrameHook()

    await waitFor(() =>
      expect(result.current.unavailableReason).toBe(
        'The background folder contains no image files.'
      )
    )
  })

  it('b6_4_gives_the_full_font_guidance_when_the_font_is_genuinely_absent', async () => {
    vi.mocked(api.posterFrameFontAvailable).mockResolvedValue(false)

    const { result } = renderPosterFrameHook()

    await waitFor(() =>
      expect(result.current.unavailableReason).toBe(
        'Poster frame text requires Cabrito.otf in ~/Library/Fonts.'
      )
    )
  })

  it('b6_5_claims_no_font_reason_while_the_font_check_is_in_flight', async () => {
    // Never resolves: the folder is fine, so only the font check is outstanding.
    vi.mocked(api.posterFrameFontAvailable).mockReturnValue(
      new Promise(() => {}) as never
    )

    const { result } = renderPosterFrameHook()

    // Wait for the folder to resolve, then assert the font check stays silent.
    await waitFor(() => expect(api.listDirectory).toHaveBeenCalled())
    expect(result.current.unavailableReason).toBeNull()
    expect(result.current.available).toBe(false)
  })

  it('b6_6_does_not_retry_a_failed_font_check', async () => {
    vi.mocked(api.posterFrameFontAvailable).mockRejectedValue(new Error('probe failed'))

    const { result } = renderPosterFrameHook(undefined, retryingWrapper)

    await waitFor(() => expect(result.current.unavailableReason).not.toBeNull())
    expect(api.posterFrameFontAvailable).toHaveBeenCalledTimes(1)
  })
})

describe('usePosterFrameForUpload - remembered preferences', () => {
  it('b1_2_starts_unticked_with_no_stored_preference', async () => {
    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.available).toBe(true))
    expect(result.current.enabled).toBe(false)
    expect(result.current.saveCopy).toBe(false)
  })

  it('b1_2_restores_the_last_used_choice', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: true, saveCopy: true }))

    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.enabled).toBe(true))
    expect(result.current.saveCopy).toBe(true)
  })

  it('b1_2_persists_a_new_choice', async () => {
    const { result } = renderPosterFrameHook()
    await waitFor(() => expect(result.current.available).toBe(true))

    act(() => result.current.setEnabled(true))
    act(() => result.current.setSaveCopy(true))

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(PREFS_KEY) as string)).toEqual({
        enabled: true,
        saveCopy: true
      })
    )
  })

  it('ignores malformed stored preferences', async () => {
    localStorage.setItem(PREFS_KEY, 'not json')

    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.available).toBe(true))
    expect(result.current.enabled).toBe(false)
  })
})

describe('usePosterFrameForUpload - backgrounds', () => {
  it('b2_1_lists_the_images_from_the_default_background_folder', async () => {
    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.backgrounds).toEqual(BACKGROUNDS))
  })

  it('b2_2_selects_the_first_background_by_default', async () => {
    const { result } = renderPosterFrameHook()

    await waitFor(() => expect(result.current.selectedBackground).toBe(BACKGROUNDS[0]))
  })

  it('b2_3_loads_the_newly_chosen_background_for_the_preview', async () => {
    const { result } = renderPosterFrameHook()
    await waitFor(() => expect(result.current.selectedBackground).toBe(BACKGROUNDS[0]))

    act(() => result.current.setSelectedBackground(BACKGROUNDS[1]))

    await waitFor(() => expect(api.readFileAsBytes).toHaveBeenCalledWith(BACKGROUNDS[1]))
  })
})

describe('usePosterFrameForUpload - text derivation', () => {
  it('b3_5_re_derives_the_text_when_the_video_title_changes', async () => {
    const { result, rerender } = renderPosterFrameHook('WBS - MSc - Managing Change')
    await waitFor(() => expect(result.current.text).toBe('Managing Change'))

    rerender({ videoTitle: 'WBS - MSc - Leading Teams' })

    await waitFor(() => expect(result.current.text).toBe('Leading Teams'))
  })

  it('b3_6_stops_following_the_title_once_the_user_edits_the_text', async () => {
    const { result, rerender } = renderPosterFrameHook('WBS - MSc - Managing Change')
    await waitFor(() => expect(result.current.text).toBe('Managing Change'))

    act(() => result.current.setText('Change, Managed'))
    rerender({ videoTitle: 'WBS - MSc - Leading Teams' })

    await waitFor(() => expect(result.current.text).toBe('Change, Managed'))
  })
})

describe('usePosterFrameForUpload - Sprout upload', () => {
  async function readyHook(videoTitle = 'WBS - MSc - Managing Change') {
    const rendered = renderPosterFrameHook(videoTitle)
    await waitFor(() => expect(rendered.result.current.available).toBe(true))
    // The dialog owns the <canvas>; stand one in for the hook-level tests.
    rendered.result.current.canvasRef.current = document.createElement('canvas')
    return rendered
  }

  it('b5_1_exports_the_canvas_and_sends_it_to_sprout', async () => {
    const { result } = await readyHook()

    await act(async () => {
      await result.current.run('vid1', 'sprout-key')
    })

    expect(exportCanvasJpeg).toHaveBeenCalled()
    expect(api.setSproutPosterFrame).toHaveBeenCalledWith(
      'vid1',
      'sprout-key',
      new Uint8Array([9, 9, 9, 9]),
      expect.stringMatching(/\.jpg$/)
    )
  })

  it('b5_2_reports_working_while_the_request_is_in_flight', async () => {
    let release: () => void = () => {}
    vi.mocked(api.setSproutPosterFrame).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    const { result } = await readyHook()

    let pending: Promise<unknown> | undefined
    await act(async () => {
      pending = result.current.run('vid1', 'sprout-key')
    })
    expect(result.current.status).toBe('working')

    await act(async () => {
      release()
      await pending
    })
    expect(result.current.status).toBe('success')
  })

  it('b5_3_resolves_ok_on_success', async () => {
    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(outcome?.ok).toBe(true)
    expect(outcome?.error).toBeNull()
  })

  it('b5_4_retries_transient_failures_three_times_with_backoff', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValue({
      status: 503,
      message: 'unavailable'
    })

    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(api.setSproutPosterFrame).toHaveBeenCalledTimes(4)
    expect(vi.mocked(posterFrameDelay).mock.calls.map(([ms]) => ms)).toEqual([
      2000, 5000, 10000
    ])
    expect(outcome?.ok).toBe(false)
    expect(result.current.status).toBe('error')
  })

  it('b5_4_succeeds_when_a_retry_goes_through', async () => {
    vi.mocked(api.setSproutPosterFrame)
      .mockRejectedValueOnce({ status: 500, message: 'boom' })
      .mockResolvedValueOnce(undefined)

    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(api.setSproutPosterFrame).toHaveBeenCalledTimes(2)
    expect(outcome?.ok).toBe(true)
  })

  it('b5_5_does_not_retry_a_413_and_reports_the_size_limit', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValue({
      status: 413,
      message: 'Request Entity Too Large'
    })

    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(api.setSproutPosterFrame).toHaveBeenCalledTimes(1)
    expect(posterFrameDelay).not.toHaveBeenCalled()
    expect(outcome?.error).toMatch(/500 KB/)
  })

  it('b5_6_retry_re_attempts_the_same_video', async () => {
    vi.mocked(api.setSproutPosterFrame).mockRejectedValueOnce({
      status: 401,
      message: 'Unauthorised'
    })

    const { result } = await readyHook()
    await act(async () => {
      await result.current.run('vid1', 'sprout-key')
    })
    expect(result.current.status).toBe('error')

    await act(async () => {
      await result.current.retry()
    })

    expect(api.setSproutPosterFrame).toHaveBeenLastCalledWith(
      'vid1',
      'sprout-key',
      expect.any(Uint8Array),
      expect.any(String)
    )
    expect(result.current.status).toBe('success')
  })
})

describe('usePosterFrameForUpload - resulting thumbnail', () => {
  async function readyHook() {
    const rendered = renderPosterFrameHook()
    await waitFor(() => expect(rendered.result.current.available).toBe(true))
    rendered.result.current.canvasRef.current = document.createElement('canvas')
    return rendered
  }

  it('b6_1_returns_the_refetched_custom_poster_frame_url', async () => {
    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(api.fetchSproutVideoDetails).toHaveBeenCalledWith('vid1', 'sprout-key')
    expect(outcome?.posterFrameUrl).toBe('https://sproutvideo.com/custom-poster.jpg')
  })

  it('b6_2_returns_a_null_url_when_sprout_has_no_poster_frames_yet', async () => {
    vi.mocked(api.fetchSproutVideoDetails).mockResolvedValue({
      id: 'vid1',
      title: 'Managing Change',
      duration: 0,
      created_at: '2026-08-01T00:00:00Z',
      assets: { poster_frames: [] }
    })

    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(outcome?.ok).toBe(true)
    expect(outcome?.posterFrameUrl).toBeNull()
  })

  it('b6_2_returns_a_null_url_when_the_refetch_fails', async () => {
    vi.mocked(api.fetchSproutVideoDetails).mockRejectedValue(new Error('offline'))

    const { result } = await readyHook()

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(outcome?.ok).toBe(true)
    expect(outcome?.posterFrameUrl).toBeNull()
  })
})

describe('usePosterFrameForUpload - optional local copy', () => {
  async function readyHook(saveCopy: boolean) {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: true, saveCopy }))
    const rendered = renderPosterFrameHook()
    await waitFor(() => expect(rendered.result.current.available).toBe(true))
    rendered.result.current.canvasRef.current = document.createElement('canvas')
    return rendered
  }

  it('b7_2_writes_the_copy_with_the_derived_stem', async () => {
    const { result } = await readyHook(true)

    await act(async () => {
      await result.current.run('vid1', 'sprout-key')
    })

    expect(api.savePosterFrameCopy).toHaveBeenCalledWith(
      PROJECT_PATH,
      'posterframe-Managing_Change',
      new Uint8Array([9, 9, 9, 9])
    )
  })

  it('b7_5_a_failed_local_copy_does_not_fail_the_run', async () => {
    vi.mocked(api.savePosterFrameCopy).mockRejectedValue(new Error('read-only volume'))

    const { result } = await readyHook(true)

    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined
    await act(async () => {
      outcome = await result.current.run('vid1', 'sprout-key')
    })

    expect(outcome?.ok).toBe(true)
    expect(result.current.status).toBe('success')
  })

  it('b7_6_writes_nothing_when_the_copy_option_is_off', async () => {
    const { result } = await readyHook(false)

    await act(async () => {
      await result.current.run('vid1', 'sprout-key')
    })

    expect(api.savePosterFrameCopy).not.toHaveBeenCalled()
  })
})
