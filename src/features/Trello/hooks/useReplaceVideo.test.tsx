/**
 * useReplaceVideo (issue #282, B3-B9)
 *
 * Orchestrates replacing the Sprout video behind a Baker link: the transfer
 * (delegated to Upload's useReplaceUpload), the poster frame choice, the
 * breadcrumbs write-back and the optional Trello comment. Sprout is the
 * irreversible step, so once it accepts the file every follow-up failure is
 * reported as a warning against a replace that did happen, the same policy
 * useCardPosterFrame set for poster frames.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  addCardComment: vi.fn()
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }
}))
vi.mock('@features/Upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/Upload')>()),
  useReplaceUpload: vi.fn(),
  useSproutVideoApi: vi.fn()
}))

import { toast } from 'sonner'

import type { TrelloCard, VideoLink } from '@features/Baker'
import * as uploadModule from '@features/Upload'

import { addCardComment } from '../api'
import { useReplaceVideo } from './useReplaceVideo'

const LINK: VideoLink = {
  url: 'https://sproutvideo.com/videos/a09bd4b21e1b',
  sproutVideoId: 'a09bd4b21e1b',
  title: 'WBS - MSc - Managing Change',
  thumbnailUrl: 'https://cdn/poster-a.jpg',
  uploadDate: '2025-01-01T00:00:00.000Z',
  sourceRenderFile: 'WBS_managing_change_v1.mp4'
}

const CARDS: TrelloCard[] = [
  { cardId: 'c1', title: 'Card One', url: 'https://trello.com/c/c1', boardName: 'Board' },
  { cardId: 'c2', title: 'Card Two', url: 'https://trello.com/c/c2' }
]

const REPLACED_VIDEO = {
  id: 'a09bd4b21e1b',
  title: 'WBS - MSc - Managing Change',
  state: 'deployed',
  duration: 130,
  embed_code: '',
  embedded_url: 'https://sproutvideo.com/videos/a09bd4b21e1b',
  assets: { poster_frames: ['https://cdn/poster-a.jpg'] }
}

const details = (posterFrames: string[]) => ({
  id: 'a09bd4b21e1b',
  title: 'WBS - MSc - Managing Change',
  duration: 130,
  created_at: '2025-01-01T00:00:00.000Z',
  assets: { poster_frames: posterFrames }
})

const mockStart = vi.fn()
const mockCancel = vi.fn()
const mockSelectFile = vi.fn()
const mockClearFile = vi.fn()
const mockFetchDetails = vi.fn()

const uploadState = (
  overrides: Partial<ReturnType<typeof uploadModule.useReplaceUpload>> = {}
) =>
  ({
    selectedFile: '/renders/WBS_managing_change_v2.mp4',
    selectFile: mockSelectFile,
    clearFile: mockClearFile,
    start: mockStart,
    cancel: mockCancel,
    progress: { percentage: 0, bytesSent: 0, totalBytes: 0 },
    status: 'idle',
    error: null,
    reset: vi.fn(),
    ...overrides
  }) as unknown as ReturnType<typeof uploadModule.useReplaceUpload>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Options = Parameters<typeof useReplaceVideo>[0]

const updateVideoLinkAsync = vi.fn()
const bumpThumbnailCacheKey = vi.fn()
const onOpenPosterFrame = vi.fn()

const options = (overrides: Partial<Options> = {}): Options => ({
  videoLinks: [LINK],
  sproutApiKey: 'sprout-key',
  trelloApiKey: 'trello-key',
  trelloToken: 'trello-token',
  trelloCards: CARDS,
  updateVideoLinkAsync,
  bumpThumbnailCacheKey,
  onOpenPosterFrame,
  ...overrides
})

beforeEach(() => {
  vi.mocked(uploadModule.useReplaceUpload).mockReturnValue(uploadState())
  vi.mocked(uploadModule.useSproutVideoApi).mockReturnValue({
    fetchVideoDetails: vi.fn(),
    fetchVideoDetailsAsync: mockFetchDetails,
    isFetching: false,
    error: null,
    data: undefined,
    reset: vi.fn()
  } as unknown as ReturnType<typeof uploadModule.useSproutVideoApi>)

  mockStart.mockReset().mockResolvedValue({ status: 'complete', video: REPLACED_VIDEO })
  mockCancel.mockReset()
  mockSelectFile.mockReset()
  mockClearFile.mockReset()
  mockFetchDetails.mockReset().mockResolvedValue(details(['https://cdn/poster-a.jpg']))
  updateVideoLinkAsync.mockReset().mockResolvedValue(undefined)
  bumpThumbnailCacheKey.mockReset()
  onOpenPosterFrame.mockReset()
  vi.mocked(addCardComment).mockReset().mockResolvedValue(undefined)
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.warning).mockClear()
  vi.mocked(toast.info).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Targets the first link and runs the replace to completion. */
async function replaceFirstLink(result: { current: ReturnType<typeof useReplaceVideo> }) {
  act(() => {
    result.current.request(0)
  })
  await act(async () => {
    await result.current.confirm()
  })
}

describe('useReplaceVideo - card action availability', () => {
  it('b3_2_names_the_missing_sprout_id_as_the_reason', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    const noId: VideoLink = { url: 'https://example.com/not-sprout', title: 'Other' }
    expect(result.current.disabledReason(noId)).toMatch(/Sprout video ID/i)
    expect(result.current.disabledReason(LINK)).toBeNull()
  })

  it('b3_3_names_the_missing_api_key_as_the_reason', () => {
    const { result } = renderHook(() => useReplaceVideo(options({ sproutApiKey: null })))

    expect(result.current.disabledReason(LINK)).toMatch(/API key/i)
  })
})

describe('useReplaceVideo - dialog form defaults and validation', () => {
  it('b4_1_targets_the_link_with_keep_as_the_default_poster_choice', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })

    expect(result.current.targetIndex).toBe(0)
    expect(result.current.target).toEqual(LINK)
    expect(result.current.posterMode).toBe('keep')
  })

  it('b4_1_cannot_submit_without_a_selected_file', () => {
    vi.mocked(uploadModule.useReplaceUpload).mockReturnValue(
      uploadState({ selectedFile: null })
    )
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it('b4_3_hides_trello_when_the_project_has_no_cards', () => {
    const { result } = renderHook(() => useReplaceVideo(options({ trelloCards: [] })))

    act(() => {
      result.current.request(0)
    })

    expect(result.current.trello.available).toBe(false)
  })

  it('b4_3_hides_trello_when_credentials_are_missing', () => {
    const { result } = renderHook(() => useReplaceVideo(options({ trelloToken: null })))

    act(() => {
      result.current.request(0)
    })

    expect(result.current.trello.available).toBe(false)
  })

  it('b4_4_starts_with_every_card_checked_and_the_default_comment', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })

    expect(result.current.trello.available).toBe(true)
    expect(result.current.trello.enabled).toBe(true)
    expect(result.current.trello.selectedCardIds).toEqual(['c1', 'c2'])
    expect(result.current.trello.text).toBe(
      'Replaced the video "WBS - MSc - Managing Change" on Sprout Video. The link is unchanged.'
    )
    expect(result.current.canSubmit).toBe(true)
  })

  it('b4_4_falls_back_to_the_source_file_when_the_title_is_blank', () => {
    const untitled: VideoLink = { ...LINK, title: '   ' }
    const { result } = renderHook(() =>
      useReplaceVideo(options({ videoLinks: [untitled] }))
    )

    act(() => {
      result.current.request(0)
    })

    expect(result.current.trello.text).toContain('"WBS_managing_change_v1.mp4"')
  })

  it('b4_5_blocks_submission_when_the_comment_is_on_but_no_card_is_checked', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.toggleCard('c1')
      result.current.trello.toggleCard('c2')
    })

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.trello.validationMessage).toMatch(/card/i)

    act(() => {
      result.current.trello.setEnabled(false)
    })
    expect(result.current.canSubmit).toBe(true)
    expect(result.current.trello.validationMessage).toBeNull()
  })

  it('b4_5_blocks_submission_when_the_comment_text_is_blank', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.setText('   ')
    })

    expect(result.current.canSubmit).toBe(false)
    expect(result.current.trello.validationMessage).toMatch(/comment/i)
  })

  it('re-derives the form for each newly targeted link', () => {
    const second: VideoLink = {
      ...LINK,
      url: 'https://sproutvideo.com/videos/b19ce5c32f2c',
      sproutVideoId: 'b19ce5c32f2c',
      title: 'Second'
    }
    const { result } = renderHook(() =>
      useReplaceVideo(options({ videoLinks: [LINK, second] }))
    )

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.setText('custom')
      result.current.setPosterMode('new')
      result.current.trello.toggleCard('c2')
    })
    act(() => {
      result.current.request(1)
    })

    expect(result.current.trello.text).toContain('"Second"')
    expect(result.current.posterMode).toBe('keep')
    expect(result.current.trello.selectedCardIds).toEqual(['c1', 'c2'])
    // The previous link's file must not be pre-selected for this one: the
    // action is irreversible and B4.1 says submit is blocked until a file is
    // chosen, on every open.
    expect(mockClearFile).toHaveBeenCalled()
  })
})

describe('useReplaceVideo - transfer lifecycle', () => {
  it('b5_1_starts_the_replace_against_the_resolved_id_and_key', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(mockStart).toHaveBeenCalledWith('a09bd4b21e1b', 'sprout-key')
  })

  it('b5_1_resolves_the_id_from_the_url_for_links_that_never_stored_one', async () => {
    const legacy: VideoLink = { ...LINK, sproutVideoId: undefined }
    const { result } = renderHook(() =>
      useReplaceVideo(options({ videoLinks: [legacy] }))
    )

    await replaceFirstLink(result)

    expect(mockStart).toHaveBeenCalledWith('a09bd4b21e1b', 'sprout-key')
  })

  it('b5_2_b8_3_a_cancelled_transfer_writes_nothing_and_keeps_the_dialog_open', async () => {
    mockStart.mockResolvedValue({ status: 'cancelled' })
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).not.toHaveBeenCalled()
    expect(addCardComment).not.toHaveBeenCalled()
    expect(result.current.targetIndex).toBe(0)
  })

  it('b5_4_b8_3_a_failed_transfer_writes_nothing_and_keeps_the_dialog_open', async () => {
    mockStart.mockResolvedValue({ status: 'error', message: 'HTTP 413' })
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).not.toHaveBeenCalled()
    expect(addCardComment).not.toHaveBeenCalled()
    expect(bumpThumbnailCacheKey).not.toHaveBeenCalled()
    expect(result.current.targetIndex).toBe(0)
  })

  it('b5_3_refuses_to_close_while_the_transfer_is_running', () => {
    vi.mocked(uploadModule.useReplaceUpload).mockReturnValue(
      uploadState({ status: 'uploading' })
    )
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.handleOpenChange(false)
    })

    expect(result.current.targetIndex).toBe(0)
  })

  it('b5_3_refuses_to_close_while_cancelling', () => {
    vi.mocked(uploadModule.useReplaceUpload).mockReturnValue(
      uploadState({ status: 'cancelling' })
    )
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.handleOpenChange(false)
    })

    expect(result.current.targetIndex).toBe(0)
  })

  it('closes when idle', () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.handleOpenChange(false)
    })

    expect(result.current.targetIndex).toBeNull()
  })
})

describe('useReplaceVideo - follow-ups still running', () => {
  it('refuses_a_new_target_while_the_previous_replace_is_finishing', async () => {
    // The dialog closes once Sprout has accepted the file, but the poster
    // re-read, breadcrumbs write and comments can run for seconds after. In
    // that window the panel is unmodal; a second replace must not start, or
    // the first one's poster dialog could open over the second's form.
    const write = deferred<void>()
    updateVideoLinkAsync.mockReturnValue(write.promise)
    const second: VideoLink = {
      ...LINK,
      url: 'https://sproutvideo.com/videos/b19ce5c32f2c',
      sproutVideoId: 'b19ce5c32f2c',
      title: 'Second'
    }
    const { result } = renderHook(() =>
      useReplaceVideo(options({ videoLinks: [LINK, second] }))
    )

    act(() => {
      result.current.request(0)
    })
    // Not wrapped in act: the assertions below need React to flush the state
    // set mid-flight, which an enclosing async act would hold back.
    const run = result.current.confirm()
    await waitFor(() => expect(updateVideoLinkAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.targetIndex).toBeNull())

    expect(result.current.disabledReason(second)).toMatch(/finishing/i)
    act(() => {
      result.current.request(1)
    })
    expect(result.current.targetIndex).toBeNull()

    write.resolve()
    await act(async () => {
      await run
    })

    expect(result.current.disabledReason(second)).toBeNull()
    act(() => {
      result.current.request(1)
    })
    expect(result.current.targetIndex).toBe(1)
  })
})

describe('useReplaceVideo - success with the current poster frame kept', () => {
  it('b6_1_rewrites_the_link_record_and_reports_success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-10T10:00:00.000Z'))
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).toHaveBeenCalledWith({
      videoIndex: 0,
      updatedLink: {
        url: LINK.url,
        title: LINK.title,
        sproutVideoId: 'a09bd4b21e1b',
        thumbnailUrl: 'https://cdn/poster-a.jpg',
        uploadDate: '2026-09-10T10:00:00.000Z',
        sourceRenderFile: 'WBS_managing_change_v2.mp4'
      }
    })
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(result.current.targetIndex).toBeNull()
  })

  it('b6_1_backfills_a_derived_sprout_id', async () => {
    const legacy: VideoLink = { ...LINK, sproutVideoId: undefined }
    const { result } = renderHook(() =>
      useReplaceVideo(options({ videoLinks: [legacy] }))
    )

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({ sproutVideoId: 'a09bd4b21e1b' })
      })
    )
  })

  it('b6_2_records_a_regenerated_poster_frame_and_warns', async () => {
    mockFetchDetails.mockResolvedValue(details(['https://cdn/poster-b.jpg']))
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({ thumbnailUrl: 'https://cdn/poster-b.jpg' })
      })
    )
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(toast.warning).mock.calls[0]
    expect(message).toMatch(/regenerated/i)
    expect(message).toMatch(/Set poster frame/)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('b6_3_fills_an_empty_stored_thumbnail_without_a_regeneration_warning', async () => {
    const bare: VideoLink = { ...LINK, thumbnailUrl: undefined }
    mockFetchDetails.mockResolvedValue(details(['https://cdn/poster-b.jpg']))
    const { result } = renderHook(() => useReplaceVideo(options({ videoLinks: [bare] })))

    await replaceFirstLink(result)

    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({ thumbnailUrl: 'https://cdn/poster-b.jpg' })
      })
    )
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('b6_4_retries_once_after_three_seconds_when_sprout_is_still_processing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetchDetails
      .mockResolvedValueOnce(details([]))
      .mockResolvedValueOnce(details(['https://cdn/poster-a.jpg']))
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    const run = act(async () => {
      await result.current.confirm()
    })
    await waitFor(() => expect(mockFetchDetails).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await run

    expect(mockFetchDetails).toHaveBeenCalledTimes(2)
    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({ thumbnailUrl: 'https://cdn/poster-a.jpg' })
      })
    )
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('b6_4_keeps_the_stored_thumbnail_and_says_so_when_both_reads_are_empty', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetchDetails.mockResolvedValue(details([]))
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    const run = act(async () => {
      await result.current.confirm()
    })
    await waitFor(() => expect(mockFetchDetails).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await run

    expect(mockFetchDetails).toHaveBeenCalledTimes(2)
    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({ thumbnailUrl: 'https://cdn/poster-a.jpg' })
      })
    )
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.info).mock.calls[0][0]).toMatch(/still processing/i)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('b6_5_bumps_the_thumbnail_cache_key_for_the_link', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(bumpThumbnailCacheKey).toHaveBeenCalledWith(LINK.url)
  })
})

describe('useReplaceVideo - success with a new poster frame', () => {
  it('b7_1_b7_2_writes_breadcrumbs_then_opens_the_poster_frame_dialog', async () => {
    const write = deferred<void>()
    updateVideoLinkAsync.mockReturnValue(write.promise)
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.setPosterMode('new')
    })
    const run = act(async () => {
      await result.current.confirm()
    })
    await waitFor(() => expect(updateVideoLinkAsync).toHaveBeenCalledTimes(1))

    // The poster flow rewrites the whole record from its own view of the
    // links, so it must not open until this write has landed.
    expect(onOpenPosterFrame).not.toHaveBeenCalled()
    write.resolve()
    await run

    expect(onOpenPosterFrame).toHaveBeenCalledWith(0)
    expect(mockFetchDetails).not.toHaveBeenCalled()
    expect(updateVideoLinkAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedLink: expect.objectContaining({
          thumbnailUrl: 'https://cdn/poster-a.jpg',
          sourceRenderFile: 'WBS_managing_change_v2.mp4'
        })
      })
    )
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('b7_3_still_bumps_the_cache_key', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.setPosterMode('new')
    })
    await act(async () => {
      await result.current.confirm()
    })

    expect(bumpThumbnailCacheKey).toHaveBeenCalledWith(LINK.url)
  })
})

describe('useReplaceVideo - Trello comment', () => {
  it('b8_1_comments_on_every_checked_card_with_the_text', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.setText('New cut is live.')
    })
    await act(async () => {
      await result.current.confirm()
    })

    expect(addCardComment).toHaveBeenCalledTimes(2)
    expect(addCardComment).toHaveBeenCalledWith(
      'c1',
      'New cut is live.',
      'trello-key',
      'trello-token'
    )
    expect(addCardComment).toHaveBeenCalledWith(
      'c2',
      'New cut is live.',
      'trello-key',
      'trello-token'
    )
  })

  it('b8_1_skips_unchecked_cards', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.toggleCard('c2')
    })
    await act(async () => {
      await result.current.confirm()
    })

    expect(addCardComment).toHaveBeenCalledTimes(1)
    expect(addCardComment).toHaveBeenCalledWith(
      'c1',
      expect.any(String),
      'trello-key',
      'trello-token'
    )
  })

  it('b8_2_posts_nothing_when_the_toggle_is_off', async () => {
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    act(() => {
      result.current.trello.setEnabled(false)
    })
    await act(async () => {
      await result.current.confirm()
    })

    expect(addCardComment).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledTimes(1)
  })
})

describe('useReplaceVideo - follow-up reporting', () => {
  it('b9_1_a_failed_breadcrumbs_write_is_one_warning_against_a_done_replace', async () => {
    updateVideoLinkAsync.mockRejectedValue(new Error('disk full'))
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(toast.warning).mock.calls[0]
    expect(message).toMatch(/Video replaced/)
    expect(message).toMatch(/breadcrumbs/i)
    expect(toast.success).not.toHaveBeenCalled()
    expect(result.current.targetIndex).toBeNull()
  })

  it('b9_2_names_exactly_the_cards_that_did_not_get_the_comment', async () => {
    vi.mocked(addCardComment).mockImplementation(async (cardId) => {
      if (cardId === 'c2') throw new Error('HTTP 401')
    })
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(toast.warning).mock.calls[0]
    expect(message).toContain('Card Two')
    expect(message).not.toContain('Card One')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('keeps_the_still_processing_note_when_a_follow_up_also_failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetchDetails.mockResolvedValue(details([]))
    updateVideoLinkAsync.mockRejectedValue(new Error('disk full'))
    const { result } = renderHook(() => useReplaceVideo(options()))

    act(() => {
      result.current.request(0)
    })
    const run = act(async () => {
      await result.current.confirm()
    })
    await waitFor(() => expect(mockFetchDetails).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await run

    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(toast.warning).mock.calls[0]
    expect(message).toMatch(/breadcrumbs/i)
    expect(message).toMatch(/still processing/i)
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('b9_3_both_failing_is_still_exactly_one_warning_naming_both', async () => {
    updateVideoLinkAsync.mockRejectedValue(new Error('disk full'))
    vi.mocked(addCardComment).mockRejectedValue(new Error('HTTP 401'))
    const { result } = renderHook(() => useReplaceVideo(options()))

    await replaceFirstLink(result)

    expect(toast.warning).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(toast.warning).mock.calls[0]
    expect(message).toMatch(/breadcrumbs/i)
    expect(message).toContain('Card One')
    expect(message).toContain('Card Two')
  })
})
