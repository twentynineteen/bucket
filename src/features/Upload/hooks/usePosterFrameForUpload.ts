/**
 * usePosterFrameForUpload (Issue #140)
 *
 * Prepares a branded poster frame alongside a Baker video upload and pushes
 * it to Sprout Video once the upload completes. Owns the remembered
 * preferences, the background/text state driving the dialog preview, and the
 * retry policy for the Sprout request.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { logger, titleToPosterFrameText } from '@shared/utils'

import type { PosterFrameRunResult, PosterFrameStatus } from '../types'
import {
  POSTER_FRAME_RETRY_DELAYS_MS,
  describePosterFrameError,
  exportCanvasJpeg,
  isTransientPosterFrameError,
  posterFrameDelay,
  posterFrameFileStem
} from '../internal/posterFrame'
import {
  fetchSproutVideoDetails,
  posterFrameFontAvailable,
  savePosterFrameCopy,
  setSproutPosterFrame
} from '../api'
import { useBackgroundFolder } from './useBackgroundFolder'
import { useFileSelection } from './useFileSelection'
import { usePosterframeAutoRedraw } from './usePosterframeAutoRedraw'
import { usePosterframeCanvas } from './usePosterframeCanvas'

const PREFS_KEY = 'posterframe-upload-preferences'

interface PosterFramePreferences {
  enabled: boolean
  saveCopy: boolean
}

const DEFAULT_PREFERENCES: PosterFramePreferences = { enabled: false, saveCopy: false }

function loadPreferences(): PosterFramePreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (!stored) return DEFAULT_PREFERENCES

    const parsed = JSON.parse(stored) as Partial<PosterFramePreferences>
    return {
      enabled: parsed.enabled === true,
      saveCopy: parsed.saveCopy === true
    }
  } catch (error) {
    logger.warn('Failed to load poster frame preferences:', error)
    return DEFAULT_PREFERENCES
  }
}

function savePreferences(preferences: PosterFramePreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
  } catch (error) {
    logger.warn('Failed to save poster frame preferences:', error)
  }
}

export interface UsePosterFrameForUploadOptions {
  /** Project the video belongs to — destination for the optional local copy */
  projectPath: string
  /** Current Video Title field, which the poster frame text follows */
  videoTitle: string
}

export function usePosterFrameForUpload({
  projectPath,
  videoTitle
}: UsePosterFrameForUploadOptions) {
  const [preferences, setPreferences] = useState<PosterFramePreferences>(loadPreferences)
  // null means "still following the Video Title" (B3.5); any string is the
  // user's own text, which the title no longer overwrites (B3.6).
  const [ownText, setOwnText] = useState<string | null>(null)
  const [status, setStatus] = useState<PosterFrameStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const lastRunRef = useRef<{ videoId: string; apiKey: string } | null>(null)

  const text = ownText ?? titleToPosterFrameText(videoTitle)

  const {
    files: backgrounds,
    currentFolder,
    isLoading: backgroundsLoading
  } = useBackgroundFolder()
  const { selectedFilePath, selectedFileBlob, selectFile } = useFileSelection()
  const { canvasRef, draw } = usePosterframeCanvas()

  const { data: fontAvailable, isPending: fontCheckPending } = useQuery({
    queryKey: ['posterframe', 'font-available'],
    queryFn: posterFrameFontAvailable,
    staleTime: Infinity
  })

  // Keep the preview in step with the chosen background and text (B4.2).
  usePosterframeAutoRedraw({ draw, imageUrl: selectedFileBlob, title: text })

  // Default to the first background in the folder (B2.2).
  useEffect(() => {
    if (!selectedFilePath && backgrounds.length > 0) {
      selectFile(backgrounds[0])
    }
  }, [backgrounds, selectedFilePath, selectFile])

  // Configuration problems are reported before the font check, and neither is
  // claimed while its check is still in flight (B1.3-B1.5).
  const unavailableReason = !currentFolder
    ? 'No default background folder configured. Set one in Settings.'
    : backgroundsLoading
      ? null
      : backgrounds.length === 0
        ? 'The background folder contains no image files.'
        : fontCheckPending
          ? null
          : !fontAvailable
            ? 'Poster frame text requires Cabrito.otf in ~/Library/Fonts.'
            : null

  const available = unavailableReason === null && fontAvailable === true

  const setEnabled = useCallback((enabled: boolean) => {
    setPreferences((current) => {
      const next = { ...current, enabled }
      savePreferences(next)
      return next
    })
  }, [])

  const setSaveCopy = useCallback((saveCopy: boolean) => {
    setPreferences((current) => {
      const next = { ...current, saveCopy }
      savePreferences(next)
      return next
    })
  }, [])

  const setText = useCallback((value: string) => {
    setOwnText(value)
  }, [])

  const setSelectedBackground = useCallback(
    (path: string) => {
      selectFile(path)
    },
    [selectFile]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setOwnText(null)
    lastRunRef.current = null
  }, [])

  /**
   * Sends the current poster frame to Sprout, retrying only failures that
   * another identical attempt could survive (B5.4, B5.5). Sprout's response
   * is read back so the caller can store the branded thumbnail (B6.1).
   */
  const runFor = useCallback(
    async (videoId: string, apiKey: string): Promise<PosterFrameRunResult> => {
      lastRunRef.current = { videoId, apiKey }
      setStatus('working')
      setError(null)

      const canvas = canvasRef.current
      if (!canvas || !selectedFileBlob) {
        const message = 'Poster frame preview is not ready.'
        setStatus('error')
        setError(message)
        return { ok: false, posterFrameUrl: null, error: message }
      }

      let bytes: Uint8Array
      try {
        // The preview redraw is debounced, so repaint before snapshotting to
        // be certain the export matches what the user just typed.
        await draw(selectedFileBlob, text)
        bytes = await exportCanvasJpeg(canvas)
      } catch (renderError) {
        const message =
          renderError instanceof Error
            ? renderError.message
            : 'Could not render the poster frame'
        logger.error('Poster frame render failed:', renderError)
        setStatus('error')
        setError(message)
        return { ok: false, posterFrameUrl: null, error: message }
      }

      const fileStem = posterFrameFileStem(text)

      for (let attempt = 0; attempt <= POSTER_FRAME_RETRY_DELAYS_MS.length; attempt++) {
        try {
          await setSproutPosterFrame(videoId, apiKey, bytes, `${fileStem}.jpg`)

          // A failed local copy must not sink an accepted poster frame (B7.5).
          if (preferences.saveCopy) {
            try {
              await savePosterFrameCopy(projectPath, fileStem, bytes)
            } catch (copyError) {
              logger.warn('Could not save the local poster frame copy:', copyError)
            }
          }

          let posterFrameUrl: string | null = null
          try {
            const details = await fetchSproutVideoDetails(videoId, apiKey)
            posterFrameUrl = details.assets?.poster_frames?.[0] || null
          } catch (detailsError) {
            logger.warn('Could not re-read the Sprout poster frame URL:', detailsError)
          }

          setStatus('success')
          setError(null)
          return { ok: true, posterFrameUrl, error: null }
        } catch (requestError) {
          const message = describePosterFrameError(requestError, bytes.byteLength)
          const canRetry =
            isTransientPosterFrameError(requestError) &&
            attempt < POSTER_FRAME_RETRY_DELAYS_MS.length

          if (!canRetry) {
            logger.error('Poster frame upload failed:', requestError)
            setStatus('error')
            setError(message)
            return { ok: false, posterFrameUrl: null, error: message }
          }

          await posterFrameDelay(POSTER_FRAME_RETRY_DELAYS_MS[attempt])
        }
      }

      // Unreachable: the loop either returns or exhausts its retries above.
      return { ok: false, posterFrameUrl: null, error: 'Poster frame upload failed' }
    },
    [canvasRef, draw, preferences.saveCopy, projectPath, selectedFileBlob, text]
  )

  const retry = useCallback(async (): Promise<PosterFrameRunResult> => {
    const last = lastRunRef.current
    if (!last) {
      return { ok: false, posterFrameUrl: null, error: 'Nothing to retry' }
    }
    return runFor(last.videoId, last.apiKey)
  }, [runFor])

  return {
    available,
    unavailableReason,
    enabled: preferences.enabled,
    setEnabled,
    backgrounds,
    selectedBackground: selectedFilePath,
    setSelectedBackground,
    text,
    setText,
    previewImageUrl: selectedFileBlob,
    canvasRef,
    saveCopy: preferences.saveCopy,
    setSaveCopy,
    status,
    error,
    run: runFor,
    retry,
    reset
  }
}
