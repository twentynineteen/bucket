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
  // Trim whitespace
  const trimmedUrl = url.trim()

  // Return null for empty strings
  if (!trimmedUrl) {
    return null
  }

  // Pattern 1: Public video page URL
  // Matches: https://sproutvideo.com/videos/{VIDEO_ID}
  // Also matches http:// (non-secure)
  const publicMatch = trimmedUrl.match(
    /(?:https?:\/\/)?sproutvideo\.com\/videos\/([a-zA-Z0-9]+)/
  )
  if (publicMatch && publicMatch[1]) {
    return publicMatch[1]
  }

  // Pattern 2: Embed URL
  // Matches: https://videos.sproutvideo.com/embed/{VIDEO_ID}/...
  // Video ID may be followed by token, query params, or nothing
  const embedMatch = trimmedUrl.match(
    /(?:https?:\/\/)?videos\.sproutvideo\.com\/embed\/([a-zA-Z0-9]+)/
  )
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1]
  }

  // No valid pattern matched
  return null
}
