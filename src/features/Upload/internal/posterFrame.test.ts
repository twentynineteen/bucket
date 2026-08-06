/**
 * Tests for the poster frame internals — filename derivation and Sprout
 * error classification.
 * Issue #140 (B5.4, B5.5, B7.2)
 */

import { describe, expect, it } from 'vitest'

import {
  POSTER_FRAME_MAX_BYTES,
  POSTER_FRAME_RETRY_DELAYS_MS,
  describePosterFrameError,
  isTransientPosterFrameError,
  posterFrameFileStem
} from './posterFrame'

describe('posterFrameFileStem', () => {
  it('b7_2_builds_the_posterframe_prefixed_stem', () => {
    expect(posterFrameFileStem('Managing Change')).toBe('posterframe-Managing_Change')
  })

  it('b7_2_replaces_every_non_alphanumeric_character', () => {
    expect(posterFrameFileStem('Week 1: Intro (v2)')).toBe('posterframe-Week_1__Intro__v2_')
  })

  it('b7_2_falls_back_to_a_generic_stem_for_empty_text', () => {
    expect(posterFrameFileStem('   ')).toBe('posterframe')
  })
})

describe('isTransientPosterFrameError', () => {
  it('b5_4_treats_a_statusless_network_failure_as_transient', () => {
    expect(isTransientPosterFrameError({ message: 'error sending request' })).toBe(true)
    expect(isTransientPosterFrameError({ status: null, message: 'connection reset' })).toBe(
      true
    )
  })

  it('b5_4_treats_5xx_as_transient', () => {
    expect(isTransientPosterFrameError({ status: 500, message: 'boom' })).toBe(true)
    expect(isTransientPosterFrameError({ status: 502, message: 'bad gateway' })).toBe(true)
    expect(isTransientPosterFrameError({ status: 503, message: 'unavailable' })).toBe(true)
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
    expect(isTransientPosterFrameError({ status: 400, message: 'bad request' })).toBe(false)
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

  it('passes through the backend message for other failures', () => {
    const message = describePosterFrameError({ status: 401, message: 'Unauthorised' }, 100)

    expect(message).toMatch(/Unauthorised/)
    expect(message).not.toMatch(/500 KB/)
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
