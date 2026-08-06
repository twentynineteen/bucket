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
