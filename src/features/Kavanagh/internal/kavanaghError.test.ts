/**
 * Normalising QC failures (issue #180, stage 2)
 */

import { describe, expect, it } from 'vitest'

import { asKavanaghError, isCancellation } from './kavanaghError'

describe('asKavanaghError', () => {
  it('keeps a tagged error from the backend as it is', () => {
    const error = asKavanaghError({
      kind: 'ffmpeg',
      message: 'ffmpeg could not decode this video.',
      stderr: "Unknown decoder 'hevc'"
    })

    expect(error.kind).toBe('ffmpeg')
    expect(error).toHaveProperty('stderr', "Unknown decoder 'hevc'")
  })

  it('keeps an unrecognised shape readable rather than showing an object', () => {
    // The failure mode this prevents is a screen reading "[object Object]".
    const error = asKavanaghError(new Error('the webview lost the connection'))

    expect(error.kind).toBe('io')
    expect(error.message).toBe('the webview lost the connection')
  })

  it('does not mistake an arbitrary object for a tagged error', () => {
    const error = asKavanaghError({ kind: 'somethingElse', message: 'nope' })

    expect(error.kind).toBe('io')
  })

  it('B8.2 recognises a cancellation, which is not a fault to show as one', () => {
    expect(isCancellation({ kind: 'cancelled', message: 'Cancelled.' })).toBe(true)
    expect(isCancellation({ kind: 'probe', message: 'No video stream.' })).toBe(false)
    expect(isCancellation(null)).toBe(false)
  })
})
