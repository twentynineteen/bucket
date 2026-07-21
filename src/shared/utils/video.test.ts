/**
 * Tests for video utilities: duration suffix formatting and title derivation
 */
import { describe, expect, it } from 'vitest'

import { fileNameToTitle, formatDurationSuffix } from './video'

describe('formatDurationSuffix', () => {
  it('formats 90 seconds as 1:30mins', () => {
    expect(formatDurationSuffix(90)).toBe('1:30mins')
  })

  it('zero-pads seconds', () => {
    expect(formatDurationSuffix(605)).toBe('10:05mins')
  })

  it('formats sub-minute durations', () => {
    expect(formatDurationSuffix(42)).toBe('0:42mins')
  })

  it('rounds fractional seconds to the nearest second', () => {
    expect(formatDurationSuffix(89.6)).toBe('1:30mins')
    expect(formatDurationSuffix(89.4)).toBe('1:29mins')
  })

  it('switches to H:MM:SShrs at one hour', () => {
    expect(formatDurationSuffix(3600)).toBe('1:00:00hrs')
    expect(formatDurationSuffix(3725)).toBe('1:02:05hrs')
  })

  it('stays in minutes just under an hour', () => {
    expect(formatDurationSuffix(3599)).toBe('59:59mins')
  })

  it('handles zero and invalid input gracefully', () => {
    expect(formatDurationSuffix(0)).toBe('0:00mins')
    expect(formatDurationSuffix(NaN)).toBe('0:00mins')
    expect(formatDurationSuffix(-5)).toBe('0:00mins')
  })
})

describe('fileNameToTitle', () => {
  it('strips the directory and extension', () => {
    expect(fileNameToTitle('/renders/WM101_final_v3.mp4')).toBe('WM101_final_v3')
  })

  it('handles Windows-style paths', () => {
    expect(fileNameToTitle('C:\\Renders\\My Video.mov')).toBe('My Video')
  })

  it('keeps names without an extension intact', () => {
    expect(fileNameToTitle('/renders/raw_footage')).toBe('raw_footage')
  })

  it('only strips the last extension', () => {
    expect(fileNameToTitle('/renders/lecture.v2.final.mp4')).toBe('lecture.v2.final')
  })

  it('does not treat a leading dot as an extension', () => {
    expect(fileNameToTitle('.hidden')).toBe('.hidden')
  })
})
