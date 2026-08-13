/**
 * Tests for the poster frame internals — filename derivation, Sprout
 * error classification, and the 500KB compression pipeline.
 * Issue #140 (B5.4, B5.5, B7.2) and issue #189 (B5.1-B5.3, B5.5)
 */

import { describe, expect, it, vi } from 'vitest'

import {
  POSTER_FRAME_MAX_BYTES,
  POSTER_FRAME_RETRY_DELAYS_MS,
  PosterFrameTooLargeError,
  describePosterFrameError,
  exportCanvasJpegUnder,
  isTransientPosterFrameError,
  posterFrameFileStem
} from './posterFrame'

describe('posterFrameFileStem', () => {
  it('b7_2_builds_the_posterframe_prefixed_stem', () => {
    expect(posterFrameFileStem('Managing Change')).toBe('posterframe-Managing_Change')
  })

  it('b7_2_replaces_every_non_alphanumeric_character', () => {
    expect(posterFrameFileStem('Week 1: Intro (v2)')).toBe(
      'posterframe-Week_1__Intro__v2_'
    )
  })

  it('b7_2_falls_back_to_a_generic_stem_for_empty_text', () => {
    expect(posterFrameFileStem('   ')).toBe('posterframe')
  })
})

describe('isTransientPosterFrameError', () => {
  it('b5_4_treats_a_statusless_network_failure_as_transient', () => {
    expect(isTransientPosterFrameError({ message: 'error sending request' })).toBe(true)
    expect(
      isTransientPosterFrameError({ status: null, message: 'connection reset' })
    ).toBe(true)
  })

  it('b5_4_treats_5xx_as_transient', () => {
    expect(isTransientPosterFrameError({ status: 500, message: 'boom' })).toBe(true)
    expect(isTransientPosterFrameError({ status: 502, message: 'bad gateway' })).toBe(
      true
    )
    expect(isTransientPosterFrameError({ status: 503, message: 'unavailable' })).toBe(
      true
    )
  })

  it('b5_4_treats_429_rate_limiting_as_transient', () => {
    expect(isTransientPosterFrameError({ status: 429, message: 'slow down' })).toBe(true)
  })

  it('b5_5_treats_413_as_terminal', () => {
    expect(isTransientPosterFrameError({ status: 413, message: 'too large' })).toBe(false)
  })

  it('b5_5_treats_auth_and_not_found_as_terminal', () => {
    expect(isTransientPosterFrameError({ status: 401, message: 'unauthorised' })).toBe(
      false
    )
    expect(isTransientPosterFrameError({ status: 403, message: 'forbidden' })).toBe(false)
    expect(isTransientPosterFrameError({ status: 404, message: 'no such video' })).toBe(
      false
    )
    expect(isTransientPosterFrameError({ status: 400, message: 'bad request' })).toBe(
      false
    )
  })
})

describe('describePosterFrameError', () => {
  it('b5_5_reports_the_payload_size_against_the_limit_for_413', () => {
    const message = describePosterFrameError(
      { status: 413, message: 'Request Entity Too Large' },
      812_345
    )

    expect(message).toMatch(/793 KB/)
    expect(message).toMatch(/500 KB/)
  })

  it('b5_5_no_longer_blames_the_background_image_for_a_413', () => {
    // With auto-compression in front of the upload (issue #189), a 413 means
    // compression itself could not fit the frame - "use a lighter background
    // image" is now wrong advice.
    const message = describePosterFrameError(
      { status: 413, message: 'Request Entity Too Large' },
      812_345
    )

    expect(message).not.toMatch(/lighter background/i)
    expect(message).toMatch(/compress/i)
  })

  it('passes through the backend message for other failures', () => {
    const message = describePosterFrameError(
      { status: 401, message: 'Unauthorised' },
      100
    )

    expect(message).toMatch(/Unauthorised/)
    expect(message).not.toMatch(/500 KB/)
  })
})

describe('exportCanvasJpegUnder (#189)', () => {
  const canvas = {} as HTMLCanvasElement

  function bytes(length: number) {
    return new Uint8Array(length)
  }

  it('b5_1_returns_the_default_quality_export_untouched_when_it_fits', async () => {
    const underLimit = bytes(400 * 1024)
    const encode = vi.fn().mockResolvedValue(underLimit)

    const result = await exportCanvasJpegUnder(canvas, POSTER_FRAME_MAX_BYTES, encode)

    // Exactly one encode, with NO quality argument: under-limit output must be
    // byte-identical to the single-shot export the app produced before.
    expect(encode).toHaveBeenCalledTimes(1)
    expect(encode).toHaveBeenCalledWith(canvas, undefined)
    expect(result).toBe(underLimit)
  })

  it('b5_2_steps_the_quality_down_until_the_export_fits', async () => {
    const tooBig = bytes(700 * 1024)
    const fits = bytes(450 * 1024)
    const encode = vi
      .fn()
      .mockResolvedValueOnce(tooBig) // default quality
      .mockResolvedValueOnce(tooBig) // 0.9
      .mockResolvedValueOnce(fits) // 0.8

    const result = await exportCanvasJpegUnder(canvas, POSTER_FRAME_MAX_BYTES, encode)

    expect(result).toBe(fits)
    expect(encode.mock.calls.map((call) => call[1])).toEqual([undefined, 0.9, 0.8])
  })

  it('b5_3_fails_clearly_when_even_the_quality_floor_is_over_the_limit', async () => {
    const encode = vi.fn().mockResolvedValue(bytes(600 * 1024))

    await expect(
      exportCanvasJpegUnder(canvas, POSTER_FRAME_MAX_BYTES, encode)
    ).rejects.toBeInstanceOf(PosterFrameTooLargeError)

    // Descends to the 0.5 floor and no further.
    expect(encode.mock.calls.map((call) => call[1])).toEqual([
      undefined,
      0.9,
      0.8,
      0.7,
      0.6,
      0.5
    ])
  })

  it('b5_3_names_the_size_and_the_limit_in_the_failure', async () => {
    const encode = vi.fn().mockResolvedValue(bytes(600 * 1024))

    await expect(
      exportCanvasJpegUnder(canvas, POSTER_FRAME_MAX_BYTES, encode)
    ).rejects.toThrow(/600 KB/)
    await expect(
      exportCanvasJpegUnder(canvas, POSTER_FRAME_MAX_BYTES, encode)
    ).rejects.toThrow(/500 KB/)
  })
})

describe('poster frame constants', () => {
  it('b5_4_defines_three_retry_delays_of_2s_5s_and_10s', () => {
    expect(POSTER_FRAME_RETRY_DELAYS_MS).toEqual([2000, 5000, 10000])
  })

  it('b5_5_uses_sprouts_500_kb_limit', () => {
    expect(POSTER_FRAME_MAX_BYTES).toBe(500 * 1024)
  })
})
