/**
 * useReplaceVideo (issue #282)
 *
 * Replaces the Sprout video behind a link that is already in a project's
 * breadcrumbs, driven from the video card's overlay action. Owns the dialog
 * target and form, and orchestrates the four steps: the transfer (Upload's
 * useReplaceUpload), the poster frame choice, the breadcrumbs write-back and
 * the optional Trello comment.
 *
 * Sprout is the irreversible step. Once it has accepted the file the outcome
 * is "replaced" whatever happens next, so every follow-up failure is gathered
 * into one warning against a replace that did happen, rather than a retry that
 * would re-send an accepted file. Same policy as useCardPosterFrame.
 *
 * One instance per VideoLinksManager, like useCardPosterFrame: the form is
 * re-derived from whichever link is targeted.
 */
import { logger } from '@shared/utils'
import { useState } from 'react'
import { toast } from 'sonner'

import type { TrelloCard, VideoLink } from '@features/Baker'
import { useReplaceUpload, useSproutVideoApi } from '@features/Upload'

import { addCardComment } from '../api'
import {
  NO_API_KEY_REASON,
  NO_SPROUT_ID_REASON,
  resolveSproutVideoId
} from './useCardPosterFrame'

/**
 * How long to give Sprout before re-reading a video whose poster frames were
 * empty right after a replace. One retry, not a poll: the app has no polling
 * loop and a long video could keep the user waiting for minutes.
 */
const PROCESSING_RETRY_DELAY_MS = 3_000

export type PosterMode = 'keep' | 'new'

export interface UseReplaceVideoOptions {
  videoLinks: VideoLink[]
  /** Sprout Video API key, absent when it hasn't been configured */
  sproutApiKey: string | null | undefined
  trelloApiKey: string | null | undefined
  trelloToken: string | null | undefined
  /** The project's linked cards; the comment is offered only when there are some */
  trelloCards: TrelloCard[] | undefined
  updateVideoLinkAsync: (variables: {
    videoIndex: number
    updatedLink: VideoLink
  }) => Promise<unknown>
  /** Forces the card to reload its thumbnail after the file behind it changed */
  bumpThumbnailCacheKey: (url: string) => void
  /** Opens the existing Set poster frame dialog for a link ("new" poster mode) */
  onOpenPosterFrame: (index: number) => void
}

/** The name a link is shown under when its title is blank (older breadcrumbs) */
function displayTitle(link: VideoLink): string {
  return (
    link.title.trim() ||
    link.sourceRenderFile ||
    resolveSproutVideoId(link) ||
    'this video'
  )
}

function defaultComment(link: VideoLink): string {
  return `Replaced the video "${displayTitle(link)}" on Sprout Video. The link is unchanged.`
}

const basename = (path: string) => path.split('/').pop() ?? path

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type PosterOutcome = 'kept' | 'regenerated' | 'processing'

/**
 * One toast per replace. Follow-up failures win, since they need acting on;
 * a regenerated frame is folded into that warning rather than shown twice.
 */
function reportOutcome(failures: string[], posterOutcome: PosterOutcome, title: string) {
  if (failures.length > 0) {
    const posterNote =
      posterOutcome === 'regenerated'
        ? ' Sprout regenerated the poster frame; use Set poster frame to restore it.'
        : ''
    toast.warning(
      `Video replaced. Could not ${failures.join('; could not ')}.${posterNote}`
    )
    return
  }
  if (posterOutcome === 'regenerated') {
    toast.warning(
      `Sprout regenerated the poster frame for '${title}'. Use Set poster frame to restore it.`
    )
    return
  }
  if (posterOutcome === 'processing') {
    toast.info(
      'Video replaced. Sprout is still processing; the thumbnail will refresh next time you open this project.'
    )
    return
  }
  toast.success('Video replaced on Sprout Video.')
}

export function useReplaceVideo({
  videoLinks,
  sproutApiKey,
  trelloApiKey,
  trelloToken,
  trelloCards,
  updateVideoLinkAsync,
  bumpThumbnailCacheKey,
  onOpenPosterFrame
}: UseReplaceVideoOptions) {
  const upload = useReplaceUpload()
  const { fetchVideoDetailsAsync } = useSproutVideoApi()

  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [posterMode, setPosterMode] = useState<PosterMode>('keep')
  const [trelloEnabled, setTrelloEnabled] = useState(true)
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [commentText, setCommentText] = useState('')

  const target = targetIndex !== null ? videoLinks[targetIndex] : undefined
  const cards = trelloCards ?? []
  const trelloAvailable = cards.length > 0 && !!trelloApiKey && !!trelloToken
  const commentActive = trelloAvailable && trelloEnabled
  const transferring = upload.status === 'uploading' || upload.status === 'cancelling'

  /** Opens the dialog for one link, re-deriving the whole form from it. */
  const request = (index: number) => {
    const link = videoLinks[index]
    if (!link) return
    upload.reset()
    setPosterMode('keep')
    setTrelloEnabled(true)
    setSelectedCardIds(cards.map((card) => card.cardId))
    setCommentText(defaultComment(link))
    setTargetIndex(index)
  }

  const handleOpenChange = (open: boolean) => {
    // Closing mid-transfer would leave Rust streaming with nothing watching it
    if (!open && transferring) return
    if (!open) setTargetIndex(null)
  }

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId]
    )
  }

  const validationMessage = !commentActive
    ? null
    : selectedCardIds.length === 0
      ? 'Choose at least one card, or turn the comment off.'
      : commentText.trim().length === 0
        ? 'Enter a comment, or turn the comment off.'
        : null

  const canSubmit =
    targetIndex !== null &&
    !!upload.selectedFile &&
    !transferring &&
    validationMessage === null

  /**
   * Reads the poster frame Sprout now serves. Empty right after a replace
   * usually means "still processing", so one re-read follows a short delay.
   * `failed` means the read itself did not work, which is not evidence about
   * the frame either way.
   */
  const readPosterFrame = async (
    videoId: string,
    apiKey: string
  ): Promise<{ frame: string | null; failed: boolean }> => {
    const read = async () => {
      const details = await fetchVideoDetailsAsync({
        videoUrl: `https://sproutvideo.com/videos/${videoId}`,
        apiKey
      })
      return details.assets.poster_frames[0] ?? null
    }

    try {
      const first = await read()
      if (first) return { frame: first, failed: false }
      await wait(PROCESSING_RETRY_DELAY_MS)
      return { frame: await read(), failed: false }
    } catch (error) {
      logger.warn('Could not re-read the replaced video from Sprout:', error)
      return { frame: null, failed: true }
    }
  }

  const confirm = async () => {
    const index = targetIndex
    if (index === null) return
    const link = videoLinks[index]
    if (!link) return

    const videoId = resolveSproutVideoId(link)
    const apiKey = sproutApiKey
    const file = upload.selectedFile
    if (!videoId || !apiKey || !file) return

    // Captured now: the form is reset when the dialog closes below.
    const comment = commentText.trim()
    const commentCards = commentActive
      ? cards.filter((card) => selectedCardIds.includes(card.cardId))
      : []
    const mode = posterMode

    const result = await upload.start(videoId, apiKey)
    // Cancelled or failed: the dialog stays open showing why, nothing is written.
    if (result.status !== 'complete') return

    setTargetIndex(null)

    const failures: string[] = []
    const poster = mode === 'keep' ? await settlePosterFrame(link, videoId, apiKey) : null
    if (poster?.failed) failures.push('check the poster frame')

    const updatedLink: VideoLink = {
      ...link,
      sproutVideoId: videoId,
      thumbnailUrl: poster?.thumbnailUrl ?? link.thumbnailUrl,
      uploadDate: new Date().toISOString(),
      sourceRenderFile: basename(file)
    }

    const [wrote, missedCards] = await Promise.all([
      writeBreadcrumbs(index, updatedLink),
      postComments(commentCards, comment)
    ])

    bumpThumbnailCacheKey(link.url)

    if (!wrote) failures.unshift('update breadcrumbs')
    if (missedCards.length > 0) failures.push(`comment on: ${missedCards.join(', ')}`)

    reportOutcome(failures, poster?.outcome ?? 'kept', displayTitle(link))

    // Only once the breadcrumbs write has landed: the poster flow rewrites the
    // whole record from its own view of the links and would otherwise revert it.
    if (mode === 'new') onOpenPosterFrame(index)
  }

  /**
   * Decides what the stored thumbnail should be after a "keep" replace. Best
   * effort: Sprout can serve a changed image at the same URL, so "equal" is not
   * proof the frame survived. The cache-key bump makes the card show whatever
   * is current either way.
   */
  const settlePosterFrame = async (
    link: VideoLink,
    videoId: string,
    apiKey: string
  ): Promise<{
    thumbnailUrl: string | undefined
    outcome: PosterOutcome
    failed: boolean
  }> => {
    const { frame, failed } = await readPosterFrame(videoId, apiKey)
    if (failed) return { thumbnailUrl: link.thumbnailUrl, outcome: 'kept', failed: true }
    if (frame === null)
      return { thumbnailUrl: link.thumbnailUrl, outcome: 'processing', failed: false }
    const regenerated = !!link.thumbnailUrl && frame !== link.thumbnailUrl
    return {
      thumbnailUrl: frame,
      outcome: regenerated ? 'regenerated' : 'kept',
      failed: false
    }
  }

  /** True when the record was written; a failure is reported, never thrown. */
  const writeBreadcrumbs = (index: number, updatedLink: VideoLink): Promise<boolean> =>
    updateVideoLinkAsync({ videoIndex: index, updatedLink })
      .then(() => true)
      .catch((error) => {
        logger.warn('Could not write the replaced video to breadcrumbs:', error)
        return false
      })

  /** Comments on every card in parallel; resolves with the titles that missed it. */
  const postComments = async (targets: TrelloCard[], text: string): Promise<string[]> => {
    const outcomes = await Promise.all(
      targets.map((card) =>
        addCardComment(card.cardId, text, trelloApiKey as string, trelloToken as string)
          .then(() => null)
          .catch((error) => {
            logger.warn(`Could not comment on Trello card "${card.title}":`, error)
            return card.title
          })
      )
    )
    return outcomes.filter((title): title is string => title !== null)
  }

  /** Why the card action is unavailable for a link, or null when it is usable */
  const disabledReason = (videoLink: VideoLink): string | null => {
    if (!resolveSproutVideoId(videoLink)) return NO_SPROUT_ID_REASON
    if (!sproutApiKey) return NO_API_KEY_REASON
    return null
  }

  return {
    target,
    targetIndex,
    targetTitle: target ? displayTitle(target) : '',
    request,
    handleOpenChange,
    upload: {
      selectedFile: upload.selectedFile,
      selectFile: upload.selectFile,
      status: upload.status,
      progress: upload.progress,
      error: upload.error,
      cancel: upload.cancel
    },
    posterMode,
    setPosterMode,
    trello: {
      available: trelloAvailable,
      enabled: trelloEnabled,
      setEnabled: setTrelloEnabled,
      cards,
      selectedCardIds,
      toggleCard,
      text: commentText,
      setText: setCommentText,
      validationMessage
    },
    canSubmit,
    confirm,
    disabledReason
  }
}
