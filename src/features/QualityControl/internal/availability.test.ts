/**
 * QC availability composition (issue #180, B8.5)
 *
 * Pure tests. What matters is that exactly one reason surfaces and it is the
 * one worth acting on first.
 */

import { describe, expect, it } from 'vitest'

import type { FfmpegAvailability } from '../types'
import { resolveQcAvailability } from './availability'
import type { ReferencePoolState } from './referencePool'

const READY_POOL: ReferencePoolState = { status: 'ready', reason: null }
const EMPTY_WATERMARKS: ReferencePoolState = {
  status: 'empty',
  reason: 'The watermarks folder contains no reference images.'
}
const EMPTY_STINGS: ReferencePoolState = {
  status: 'empty',
  reason: 'The stings folder contains no reference images.'
}

const FFMPEG_READY: FfmpegAvailability = {
  status: 'ready',
  ffmpeg: '/opt/homebrew/bin/ffmpeg',
  ffprobe: '/opt/homebrew/bin/ffprobe'
}

describe('resolveQcAvailability', () => {
  it('B8.5 is available when ffmpeg and both pools are ready', () => {
    expect(
      resolveQcAvailability({
        ffmpeg: FFMPEG_READY,
        watermarks: READY_POOL,
        stings: READY_POOL
      })
    ).toEqual({ available: true, reason: null, pending: false })
  })

  it('B8.5 reports the missing binary by name', () => {
    const result = resolveQcAvailability({
      ffmpeg: {
        status: 'notFound',
        missing: ['ffprobe'],
        searched: ['/opt/homebrew/bin']
      },
      watermarks: READY_POOL,
      stings: READY_POOL
    })

    expect(result.available).toBe(false)
    expect(result.reason).toContain('ffprobe')
  })

  it('B8.5 distinguishes a present-but-unrunnable binary from a missing one', () => {
    const result = resolveQcAvailability({
      ffmpeg: { status: 'notExecutable', path: '/custom/tools/ffmpeg' },
      watermarks: READY_POOL,
      stings: READY_POOL
    })

    expect(result.available).toBe(false)
    expect(result.reason).toContain('/custom/tools/ffmpeg')
    // "Install ffmpeg" would be the wrong instruction here.
    expect(result.reason).not.toMatch(/install/i)
  })

  it('B8.5 reports ffmpeg ahead of an empty reference pool', () => {
    // Both are broken. Telling someone about their sting folder while ffmpeg is
    // absent sends them to fix the thing that does not matter yet.
    const result = resolveQcAvailability({
      ffmpeg: { status: 'notFound', missing: ['ffmpeg', 'ffprobe'], searched: [] },
      watermarks: EMPTY_WATERMARKS,
      stings: EMPTY_STINGS
    })

    expect(result.reason).toMatch(/ffmpeg/i)
    expect(result.reason).not.toMatch(/stings/i)
  })

  it('B8.5 reports the watermark pool ahead of the sting pool', () => {
    const result = resolveQcAvailability({
      ffmpeg: FFMPEG_READY,
      watermarks: EMPTY_WATERMARKS,
      stings: EMPTY_STINGS
    })

    expect(result.reason).toMatch(/watermarks/i)
  })

  it('B8.5 surfaces the sting pool when it is the only problem', () => {
    const result = resolveQcAvailability({
      ffmpeg: FFMPEG_READY,
      watermarks: READY_POOL,
      stings: EMPTY_STINGS
    })

    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/stings/i)
  })

  it('B8.5 claims nothing while the ffmpeg check is in flight', () => {
    const result = resolveQcAvailability({
      ffmpeg: null,
      watermarks: READY_POOL,
      stings: READY_POOL
    })

    expect(result).toEqual({ available: false, reason: null, pending: true })
  })

  it('B8.5 claims nothing while a pool check is in flight', () => {
    const result = resolveQcAvailability({
      ffmpeg: FFMPEG_READY,
      watermarks: { status: 'loading', reason: null },
      stings: READY_POOL
    })

    expect(result.pending).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('B8.5 is never available and pending at the same time', () => {
    const result = resolveQcAvailability({
      ffmpeg: null,
      watermarks: { status: 'unknown', reason: null },
      stings: { status: 'unknown', reason: null }
    })

    expect(result.available).toBe(false)
  })
})
