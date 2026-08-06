/**
 * useCardPosterFrame (Issue #141)
 *
 * Sets a branded poster frame on a video that is already linked to a project,
 * driven from the video card's overlay action rather than an upload. Owns the
 * dialog target, the id resolution for links that never stored a Sprout id, the
 * breadcrumbs write-back, and the per-link cache key that makes a replaced
 * frame actually visible.
 *
 * One instance per VideoLinksManager, not per card: its inputs are React
 * Query-backed and shared, but its poster frame text follows the *targeted*
 * link's title, which is why it can't share the upload flow's instance.
 */

import { logger, sproutVideoIdFromUrl } from '@shared/utils'
import { useState } from 'react'
import { toast } from 'sonner'

import type { VideoLink } from '@features/Baker'
import { usePosterFrameForUpload } from '@features/Upload'

const NO_SPROUT_ID_REASON = 'No Sprout video ID could be determined from this link.'
const NO_API_KEY_REASON = 'Sprout Video API key not configured. Go to Settings to add it.'

/**
 * The Sprout id a poster frame can be set against: the stored one, or one
 * derived from the link's own URL for links added before the id was captured
 * (B2.1-B2.2).
 */
function resolveSproutVideoId(videoLink: VideoLink): string | null {
  return videoLink.sproutVideoId?.trim() || sproutVideoIdFromUrl(videoLink.url)
}

interface UseCardPosterFrameOptions {
  /** Project the links belong to — destination for the optional Graphics copy */
  projectPath: string
  videoLinks: VideoLink[]
  /** Sprout Video API key, absent when it hasn't been configured */
  apiKey: string | null | undefined
  updateVideoLinkAsync: (variables: {
    videoIndex: number
    updatedLink: VideoLink
  }) => Promise<unknown>
}

export function useCardPosterFrame({
  projectPath,
  videoLinks,
  apiKey,
  updateVideoLinkAsync
}: UseCardPosterFrameOptions) {
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [thumbnailCacheKeys, setThumbnailCacheKeys] = useState<Record<string, number>>({})

  const target = targetIndex !== null ? videoLinks[targetIndex] : undefined

  const posterFrame = usePosterFrameForUpload({
    projectPath,
    videoTitle: target?.title ?? ''
  })

  /**
   * Opens the dialog for one link. The hook is reset first so text typed for a
   * previously targeted link doesn't carry over — it re-derives from this
   * link's title instead (B3.4).
   */
  const request = (index: number) => {
    posterFrame.reset()
    setTargetIndex(index)
  }

  const handleOpenChange = (open: boolean) => {
    // Closing mid-request would tear down the in-flight PUT (B5.3)
    if (!open && posterFrame.status === 'working') return
    if (!open) setTargetIndex(null)
  }

  /** Records the refreshed thumbnail, reporting whether the write stuck */
  const writeBack = async (
    index: number,
    link: VideoLink,
    videoId: string,
    posterFrameUrl: string | null
  ): Promise<boolean> => {
    const updatedLink: VideoLink = {
      ...link,
      thumbnailUrl: posterFrameUrl ?? link.thumbnailUrl,
      // One write, two fixes: a derived id is worth keeping (B6.2)
      sproutVideoId: link.sproutVideoId?.trim() || videoId
    }

    const changed =
      updatedLink.thumbnailUrl !== link.thumbnailUrl ||
      updatedLink.sproutVideoId !== link.sproutVideoId

    if (!changed) return posterFrameUrl !== null

    try {
      await updateVideoLinkAsync({ videoIndex: index, updatedLink })
      return posterFrameUrl !== null
    } catch (error) {
      logger.warn('Could not write the refreshed poster frame to breadcrumbs:', error)
      return false
    }
  }

  /**
   * Replaces the poster frame on Sprout for the targeted link. Sprout is the
   * irreversible step, so once it accepts the frame the outcome is a success
   * even if the follow-up bookkeeping fails — the warning names what went
   * unrefreshed rather than offering a retry that would re-send an accepted
   * frame (B6.4).
   */
  const confirm = async () => {
    const index = targetIndex
    if (index === null) return

    const link = videoLinks[index]
    if (!link) return

    const videoId = resolveSproutVideoId(link)
    if (!videoId || !apiKey) return

    const result = await posterFrame.run(videoId, apiKey)

    // A terminal failure leaves the dialog open with its error and retry (B5.4)
    if (!result.ok) return

    setTargetIndex(null)

    const refreshed = await writeBack(index, link, videoId, result.posterFrameUrl)

    setThumbnailCacheKeys((current) => ({ ...current, [link.url]: Date.now() }))

    if (refreshed) {
      toast.success('Poster frame set on Sprout Video.')
    } else {
      toast.warning(
        'Poster frame set on Sprout Video, but the stored thumbnail could not be refreshed.'
      )
    }
  }

  /** Why the card action is unavailable for a link, or null when it is usable */
  const disabledReason = (videoLink: VideoLink): string | null =>
    resolveSproutVideoId(videoLink) ? null : NO_SPROUT_ID_REASON

  return {
    posterFrame,
    target,
    targetIndex,
    // The hook's own reason first, then anything else that would stop the request
    unavailableReason:
      posterFrame.unavailableReason ?? (apiKey ? null : NO_API_KEY_REASON),
    thumbnailCacheKeys,
    disabledReason,
    request,
    confirm,
    retry: () => void confirm(),
    handleOpenChange
  }
}
