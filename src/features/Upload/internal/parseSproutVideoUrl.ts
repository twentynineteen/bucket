import { sproutVideoIdFromUrl } from '@shared/utils'

/**
 * Parses Sprout Video URLs to extract video ID
 * Feature: 004-embed-multiple-video
 *
 * Supports two URL formats:
 * 1. Public: https://sproutvideo.com/videos/{VIDEO_ID}
 * 2. Embed: https://videos.sproutvideo.com/embed/{VIDEO_ID}/...
 *
 * @param url - Sprout Video URL (any format)
 * @returns Video ID if valid Sprout URL, null otherwise
 *
 * @example
 * parseSproutVideoUrl('https://sproutvideo.com/videos/abc123')
 * // Returns: 'abc123'
 *
 * parseSproutVideoUrl('https://videos.sproutvideo.com/embed/abc123/token')
 * // Returns: 'abc123'
 *
 * parseSproutVideoUrl('https://youtube.com/watch?v=123')
 * // Returns: null
 */
export function parseSproutVideoUrl(url: string): string | null {
  // The parsing itself lives in @shared/utils because Baker needs it too
  // (issue #141), and this module is deliberately not exported from the
  // Upload barrel. Kept as a wrapper so existing callers stay put.
  return sproutVideoIdFromUrl(url)
}

/** Sprout video ids are alphanumeric, so anything punctuated is a URL or junk. */
const BARE_SPROUT_ID = /^[a-zA-Z0-9]+$/

/**
 * Resolves what a user typed into a Sprout video id: either URL form, or the
 * bare id copied out of Sprout's own UI (issue #142 B1.2-B1.5).
 *
 * A bare id is accepted on trust - only Sprout can say whether it exists, and
 * the caller finds out by fetching the video's details. Anything with
 * punctuation in it that is not a Sprout URL is rejected here instead, so a
 * pasted YouTube link never reaches the API.
 *
 * @returns the id, or null when the input is neither a Sprout URL nor an id
 */
export function sproutVideoReferenceToId(reference: string): string | null {
  const trimmed = reference.trim()
  if (!trimmed) return null

  const fromUrl = sproutVideoIdFromUrl(trimmed)
  if (fromUrl) return fromUrl

  return BARE_SPROUT_ID.test(trimmed) ? trimmed : null
}
