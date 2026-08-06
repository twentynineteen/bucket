/**
 * Tests for video utilities: duration suffix formatting and title derivation
 */
import { describe, expect, it } from 'vitest'

import {
  fileNameToTitle,
  formatDurationSuffix,
  sproutVideoIdFromUrl,
  titleToPosterFrameText
} from './video'

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

describe('titleToPosterFrameText', () => {
  it('b3_1_takes_the_last_spaced_hyphen_segment', () => {
    expect(titleToPosterFrameText('WBS - MSc - Module 3 - Managing Change')).toBe(
      'Managing Change'
    )
  })

  it('b3_2_uses_the_whole_title_when_there_is_no_separator', () => {
    expect(titleToPosterFrameText('Managing Change')).toBe('Managing Change')
  })

  it('b3_3_leaves_unspaced_hyphens_intact', () => {
    expect(titleToPosterFrameText('Decision-Making in Practice')).toBe(
      'Decision-Making in Practice'
    )
  })

  it('b3_3_only_splits_on_spaced_hyphens_within_a_prefixed_title', () => {
    expect(titleToPosterFrameText('WBS - MSc - Decision-Making in Practice')).toBe(
      'Decision-Making in Practice'
    )
  })

  it('b3_4_falls_back_to_the_last_non_empty_segment', () => {
    expect(titleToPosterFrameText('WBS - MSc - Module 3 - ')).toBe('Module 3')
  })

  it('b3_4_returns_an_empty_string_for_an_empty_title', () => {
    expect(titleToPosterFrameText('   ')).toBe('')
  })

  it('trims surrounding whitespace on the derived segment', () => {
    expect(titleToPosterFrameText('WBS -   Managing Change  ')).toBe('Managing Change')
  })
})

// Issue #141 (B2.2): a link added by URL often carries no stored sproutVideoId,
// so the id has to come from the URL itself before a poster frame can be set.
describe('sproutVideoIdFromUrl', () => {
  it('b2_2_extracts_the_id_from_a_public_video_url', () => {
    expect(sproutVideoIdFromUrl('https://sproutvideo.com/videos/abc123')).toBe('abc123')
  })

  it('b2_2_extracts_the_id_from_an_embed_url', () => {
    expect(
      sproutVideoIdFromUrl('https://videos.sproutvideo.com/embed/def456/sometoken')
    ).toBe('def456')
  })

  it('b2_2_accepts_urls_without_a_protocol', () => {
    expect(sproutVideoIdFromUrl('sproutvideo.com/videos/abc123')).toBe('abc123')
  })

  it('b2_2_trims_surrounding_whitespace', () => {
    expect(sproutVideoIdFromUrl('  https://sproutvideo.com/videos/abc123  ')).toBe(
      'abc123'
    )
  })

  it('b2_3_returns_null_for_a_non_sprout_url', () => {
    expect(sproutVideoIdFromUrl('https://youtube.com/watch?v=abc123')).toBeNull()
  })

  it('b2_3_returns_null_for_an_empty_url', () => {
    expect(sproutVideoIdFromUrl('   ')).toBeNull()
  })

  it('b2_3_returns_null_when_no_id_follows_the_videos_segment', () => {
    expect(sproutVideoIdFromUrl('https://sproutvideo.com/')).toBeNull()
  })
})
