/**
 * Sprout Video helpers shared across features that work with video links.
 *
 * Consolidates `resolveSproutVideoId` and the unavailability reason strings
 * that were previously duplicated in Trello/useCardPosterFrame and
 * Upload/usePosterframeSproutUpload (#308).
 */
import type { VideoLink } from '@features/Baker'
import { sproutVideoIdFromUrl } from '@shared/utils'

export const NO_SPROUT_ID_REASON =
  'No Sprout video ID could be determined from this link.'

export const NO_API_KEY_REASON =
  'Sprout Video API key not configured. Go to Settings to add it.'

/**
 * The Sprout id a poster frame can be set against: the stored one, or one
 * derived from the link's own URL for links added before the id was captured
 * (B2.1-B2.2). Shared with the replace action (#282), which has the same need.
 */
export function resolveSproutVideoId(videoLink: VideoLink): string | null {
  return videoLink.sproutVideoId?.trim() || sproutVideoIdFromUrl(videoLink.url)
}
