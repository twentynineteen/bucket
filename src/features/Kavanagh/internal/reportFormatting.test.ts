/**
 * Report formatting (issue #180, stage 2)
 */

import { describe, expect, it } from 'vitest'

import { bytesToBase64, evidencePrefix, formatTime } from './reportFormatting'

describe('formatTime', () => {
  it('reads as a timeline position rather than a raw number of seconds', () => {
    // The behaviour's own example: a gap from 04:12 to 04:31.
    expect(formatTime(252)).toBe('4:12.0')
    expect(formatTime(271.5)).toBe('4:31.5')
  })

  it('pads the seconds so 4:05 does not read as 4:5', () => {
    expect(formatTime(245)).toBe('4:05.0')
  })

  it('survives a value it should never be given', () => {
    expect(formatTime(Number.NaN)).toBe('0:00.0')
    expect(formatTime(-1)).toBe('0:00.0')
  })
})

describe('evidencePrefix', () => {
  it("names the render, so two renders' evidence in one folder can be told apart", () => {
    expect(evidencePrefix('/Volumes/Renders/module_overview_UHD.mp4')).toBe(
      'kavanagh-module_overview_UHD'
    )
  })

  it('falls back when there is no render to name', () => {
    expect(evidencePrefix(null)).toBe('kavanagh')
    expect(evidencePrefix('/Volumes/Renders/.mp4')).toBe('kavanagh')
  })
})

describe('bytesToBase64', () => {
  it('encodes bytes the way a data URL needs them', () => {
    // The JPEG start-of-image marker, which is what a thumbnail begins with.
    expect(bytesToBase64(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toBe('/9j/2Q==')
  })

  it('encodes a payload larger than the argument limit', () => {
    // A real thumbnail is a few hundred kilobytes. Spread into String.fromCharCode
    // in one call, that throws rather than encoding.
    const large = new Uint8Array(300_000).fill(0x41)

    expect(() => bytesToBase64(large)).not.toThrow()
    expect(bytesToBase64(large).length).toBeGreaterThan(100_000)
  })
})
