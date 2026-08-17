/**
 * usePosterframeSproutUpload (Issue #142)
 *
 * The Posterframe page's `Upload to Sprout` action: identifying the target
 * video from a pasted URL or id, holding the confirmation that has to happen
 * before a live poster frame is replaced, and sending the frame with #140's
 * retry policy and error wording.
 *
 * The page keeps ownership of the canvas, background and title, and hands this
 * hook a `renderBytes` callback plus whatever reason of its own would stop an
 * upload. Everything about the Sprout side lives here.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { useSproutVideoApiKey } from '@shared/hooks'
import { logger } from '@shared/utils'

import type { PosterFrameStatus } from '../types'
import {
  posterFrameDelay,
  posterFrameFileStem,
  sendPosterFrameWithRetry
} from '../internal/posterFrame'
import { sproutVideoReferenceToId } from '../internal/parseSproutVideoUrl'
import { fetchSproutVideoDetails, setSproutPosterFrame } from '../api'

const NO_API_KEY_REASON = 'Sprout Video API key not configured. Go to Settings to add it.'
const NOT_A_REFERENCE_REASON = 'That is not a Sprout video URL or ID.'
const NO_VIDEO_REASON = 'Fetch a Sprout video first to confirm which one to update.'
const NO_TEXT_REASON = 'Enter the title text that goes on the poster frame.'

/** A Sprout video confirmed to exist, with the title the user will recognise. */
export interface ResolvedSproutVideo {
  id: string
  title: string
}

export interface UsePosterframeSproutUploadOptions {
  /** Poster frame text, which is the page's Video Title */
  text: string
  /**
   * Why the page itself cannot produce a frame right now (no background
   * selected, font missing). Reported ahead of this hook's own reasons.
   */
  unavailableReason: string | null
  /** Renders the current frame as JPEG bytes; rejects when it cannot */
  renderBytes: () => Promise<Uint8Array>
  /** Called with the resolved video's title so the page can prefill from it */
  onVideoResolved?: (title: string) => void
}

export function usePosterframeSproutUpload({
  text,
  unavailableReason,
  renderBytes,
  onVideoResolved
}: UsePosterframeSproutUploadOptions) {
  const { apiKey } = useSproutVideoApiKey()

  const [videoReference, setVideoReferenceState] = useState('')
  const [resolvedVideo, setResolvedVideo] = useState<ResolvedSproutVideo | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState<PosterFrameStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const working = status === 'working'

  const blockedReason = !apiKey
    ? NO_API_KEY_REASON
    : (unavailableReason ??
      (text.trim().length === 0
        ? NO_TEXT_REASON
        : resolvedVideo === null
          ? NO_VIDEO_REASON
          : null))

  /**
   * Editing the reference drops the resolution with it, so a confirmation can
   * never name one video while the field names another (B1.7).
   */
  const setVideoReference = useCallback((value: string) => {
    setVideoReferenceState(value)
    setResolvedVideo(null)
    setFetchError(null)
    setStatus('idle')
    setError(null)
  }, [])

  const fetchDetails = useCallback(async () => {
    if (!apiKey || isFetching) return

    const videoId = sproutVideoReferenceToId(videoReference)
    if (!videoId) {
      // Rejected before the network: a pasted YouTube link is a typing mistake,
      // not something Sprout should be asked about (B1.5).
      setResolvedVideo(null)
      setFetchError(NOT_A_REFERENCE_REASON)
      return
    }

    setIsFetching(true)
    setFetchError(null)
    try {
      const details = await fetchSproutVideoDetails(videoId, apiKey)
      setResolvedVideo({ id: videoId, title: details.title })
      onVideoResolved?.(details.title)
    } catch (lookupError) {
      logger.error('Could not fetch Sprout video details:', lookupError)
      setResolvedVideo(null)
      setFetchError(
        lookupError instanceof Error
          ? lookupError.message
          : `Could not fetch details for ${videoId}.`
      )
    } finally {
      setIsFetching(false)
    }
  }, [apiKey, isFetching, onVideoResolved, videoReference])

  /**
   * Replacing a live poster frame is not undoable from inside the app, so the
   * action only ever opens the confirmation (B3.1).
   */
  const requestUpload = useCallback(() => {
    if (blockedReason !== null || working) return
    setConfirmOpen(true)
  }, [blockedReason, working])

  const runUpload = useCallback(async () => {
    const target = resolvedVideo
    if (!target || !apiKey) return

    setStatus('working')
    setError(null)

    let bytes: Uint8Array
    try {
      bytes = await renderBytes()
    } catch (renderError) {
      // Nothing is sent when the frame cannot be rendered inside the limit
      // (B4.6) - the message already names the size (#189).
      const message =
        renderError instanceof Error
          ? renderError.message
          : 'Could not render the poster frame.'
      logger.error('Poster frame render failed:', renderError)
      setStatus('error')
      setError(message)
      return
    }

    const outcome = await sendPosterFrameWithRetry(
      bytes,
      (payload) =>
        setSproutPosterFrame(
          target.id,
          apiKey,
          payload,
          `${posterFrameFileStem(text)}.jpg`
        ),
      posterFrameDelay
    )

    if (outcome.ok) {
      setStatus('success')
      setError(null)
      toast.success(`Poster frame set on ${target.title}.`)
      return
    }

    logger.error('Poster frame upload failed:', outcome.error)
    setStatus('error')
    setError(outcome.error)
  }, [apiKey, renderBytes, resolvedVideo, text])

  const confirmUpload = useCallback(async () => {
    setConfirmOpen(false)
    await runUpload()
  }, [runUpload])

  return {
    videoReference,
    setVideoReference,
    /**
     * Whether a lookup can be attempted. Deliberately not gated on the
     * reference parsing: a greyed-out button explains nothing, whereas
     * attempting the lookup reports exactly why the input is not usable (B1.5).
     */
    canFetch: Boolean(apiKey) && videoReference.trim().length > 0,
    fetchDetails,
    isFetching,
    fetchError,
    resolvedVideo,
    /** Why the upload cannot run, or null when it can */
    blockedReason,
    requestUpload,
    confirmOpen,
    setConfirmOpen,
    confirmUpload,
    status,
    error,
    retry: runUpload
  }
}
