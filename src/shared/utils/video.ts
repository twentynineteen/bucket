/**
 * Video Utilities
 *
 * Helpers for deriving video titles and formatting durations,
 * shared between the Upload and Trello features.
 */

/**
 * Formats a duration in seconds as a compact suffix for card/video names.
 * Under an hour: "M:SSmins" (e.g. 90 -> "1:30mins", 605 -> "10:05mins").
 * An hour or more: "H:MM:SShrs" (e.g. 3725 -> "1:02:05hrs").
 * Seconds are rounded to the nearest whole second.
 */
export function formatDurationSuffix(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0
  const secs = total % 60
  const paddedSecs = String(secs).padStart(2, '0')

  if (total < 3600) {
    return `${Math.floor(total / 60)}:${paddedSecs}mins`
  }

  const hours = Math.floor(total / 3600)
  const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  return `${hours}:${mins}:${paddedSecs}hrs`
}

/**
 * Extracts a Sprout Video id from either URL form the app stores:
 * the public page (`sproutvideo.com/videos/{id}`) or the embed
 * (`videos.sproutvideo.com/embed/{id}/...`). The protocol is optional.
 *
 * Lives here rather than inside a feature because both Upload (resolving a
 * pasted URL) and Baker (setting a poster frame on a link that never stored
 * its id) need it.
 *
 * @returns the id, or null when the URL is empty or not a Sprout URL
 */
export function sproutVideoIdFromUrl(url: string): string | null {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null

  const publicMatch = trimmedUrl.match(
    /(?:https?:\/\/)?sproutvideo\.com\/videos\/([a-zA-Z0-9]+)/
  )
  if (publicMatch && publicMatch[1]) {
    return publicMatch[1]
  }

  const embedMatch = trimmedUrl.match(
    /(?:https?:\/\/)?videos\.sproutvideo\.com\/embed\/([a-zA-Z0-9]+)/
  )
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1]
  }

  return null
}

/**
 * Derives a default video title from a file path: the basename without
 * its extension (e.g. "/renders/WM101_final_v3.mp4" -> "WM101_final_v3").
 */
export function fileNameToTitle(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath
  const dotIndex = base.lastIndexOf('.')
  return (dotIndex > 0 ? base.slice(0, dotIndex) : base).trim()
}

/**
 * Derives the text for a branded poster frame from a video title. Titles
 * follow a "prefix - prefix - subject" convention, and only the subject
 * belongs on the thumbnail:
 * "WBS - MSc - Module 3 - Managing Change" -> "Managing Change".
 *
 * Only spaced hyphens separate segments, so hyphenated words survive
 * ("Decision-Making in Practice" stays whole). A title ending in a separator
 * falls back to its last non-empty segment, and a title without any
 * separator is used as-is.
 */
export function titleToPosterFrameText(title: string): string {
  const segments = title
    .split(' - ')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return segments.length > 0 ? segments[segments.length - 1] : ''
}
