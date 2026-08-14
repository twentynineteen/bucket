import { CACHE } from '@shared/constants'
import { queryKeys, createQueryOptions } from '@shared/lib'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

import { logger } from '@shared/utils'

import {
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress,
  listenUploadStallWarning
} from '../api'
import type { UploadMessage } from '../types'

interface UseUploadEventsReturn {
  /** Whole percent, for the bar and its label. */
  progress: number
  uploading: boolean
  /**
   * Bytes transferred and the file's total (#225 UP-30). A percentage alone
   * cannot tell 3% of 200 MB from 3% of 12 GB, which is exactly the judgement a
   * user makes when deciding whether to keep waiting.
   */
  bytesSent: number
  totalBytes: number
  /**
   * The non-terminal "this looks stalled" text, or null (#225 UP-26/UP-27).
   *
   * Distinct from `message`: this one does not mean the upload is over, and is
   * withdrawn if the transfer recovers. The terminal verdict, when it comes,
   * arrives as an error `message` instead.
   */
  stallWarning: string | null
  setUploading: (uploading: boolean) => void
  setProgress: (progress: number) => void
  setMessage: (message: UploadMessage | null) => void
  message: UploadMessage | null
}

/** Everything the upload event stream tracks, as held in the query cache. */
interface UploadEventState {
  progress: number
  uploading: boolean
  bytesSent: number
  totalBytes: number
  stallWarning: string | null
  message: UploadMessage | null
}

const IDLE_UPLOAD_STATE: UploadEventState = {
  progress: 0,
  uploading: false,
  bytesSent: 0,
  totalBytes: 0,
  stallWarning: null,
  message: null
}

export const useUploadEvents = (): UseUploadEventsReturn => {
  const queryClient = useQueryClient()
  const listenersSetup = useRef(false)

  // Use React Query to manage upload state with real-time updates
  const { data: uploadState } = useQuery({
    ...createQueryOptions(
      queryKeys.upload.events(),
      async () => ({ ...IDLE_UPLOAD_STATE }),
      'REALTIME',
      {
        staleTime: 0, // Always fresh for real-time updates
        gcTime: CACHE.GC_BRIEF, // Keep cached for 1 minute
        refetchInterval: false // Don't auto-refetch, use event updates
      }
    )
  })

  const progress = uploadState?.progress ?? 0
  const uploading = uploadState?.uploading ?? false
  const message = uploadState?.message ?? null
  const bytesSent = uploadState?.bytesSent ?? 0
  const totalBytes = uploadState?.totalBytes ?? 0
  const stallWarning = uploadState?.stallWarning ?? null

  // Helper to update upload state via React Query
  const updateUploadState = useCallback(
    (updates: Partial<UploadEventState>) => {
      queryClient.setQueryData(
        queryKeys.upload.events(),
        (old: UploadEventState | undefined) => ({
          ...IDLE_UPLOAD_STATE,
          ...old,
          ...updates
        })
      )
    },
    [queryClient]
  )

  // Memoized setters to maintain API compatibility
  const setProgress = useCallback(
    (newProgress: number) => {
      updateUploadState({ progress: newProgress })
    },
    [updateUploadState]
  )

  const setUploading = useCallback(
    (newUploading: boolean) => {
      updateUploadState({ uploading: newUploading })
    },
    [updateUploadState]
  )

  const setMessage = useCallback(
    (newMessage: UploadMessage | null) => {
      updateUploadState({ message: newMessage })
    },
    [updateUploadState]
  )

  useEffect(() => {
    // Prevent double setup in StrictMode
    if (listenersSetup.current) return

    // Setting up upload event listeners with React Query integration
    listenersSetup.current = true

    let unlistenProgress: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null
    let unlistenError: (() => void) | null = null
    let unlistenCancelled: (() => void) | null = null
    let unlistenStallWarning: (() => void) | null = null
    let isMounted = true

    const setupListeners = async () => {
      try {
        unlistenProgress = await listenUploadProgress((event) => {
          if (isMounted) {
            const { percentage, bytesSent: sent, totalBytes: total } = event.payload
            updateUploadState({
              // The bar and its label want whole percent; the byte counts carry
              // the precision, so rounding here loses nothing.
              progress: Math.round(percentage),
              bytesSent: sent,
              totalBytes: total
            })
          }
        })

        unlistenComplete = await listenUploadComplete(() => {
          if (isMounted) {
            // Backend sends the response object, not a string message
            // Convert to a success message for display
            updateUploadState({
              message: { text: 'Upload successful', severity: 'success' },
              uploading: false,
              progress: 100,
              // A warning outliving the upload would sit under a finished panel
              // advising the user to cancel something already over.
              stallWarning: null
            })
          }
        })

        unlistenError = await listenUploadError((event) => {
          if (isMounted) {
            updateUploadState({
              message: { text: event.payload.message, severity: 'error' },
              uploading: false,
              stallWarning: null
            })
          }
        })

        // Cancellation is its own channel so severity never has to be guessed
        // from wording: the user asked for this, so it is `info`, not `error`.
        unlistenCancelled = await listenUploadCancelled(() => {
          if (isMounted) {
            updateUploadState({
              message: { text: 'Upload cancelled', severity: 'info' },
              uploading: false,
              progress: 0,
              bytesSent: 0,
              stallWarning: null
            })
          }
        })

        // Non-terminal: it changes nothing about `uploading` or `message`, and a
        // null payload message withdraws a warning the transfer has recovered from.
        unlistenStallWarning = await listenUploadStallWarning((event) => {
          if (isMounted) {
            updateUploadState({ stallWarning: event.payload.message })
          }
        })
      } catch (error) {
        logger.error('Failed to setup upload event listeners:', error)
        updateUploadState({
          message: { text: 'Failed to setup event listeners', severity: 'error' },
          uploading: false
        })
      }
    }

    setupListeners()

    return () => {
      isMounted = false
      listenersSetup.current = false

      // Use setTimeout to defer cleanup and avoid race conditions
      setTimeout(() => {
        try {
          if (unlistenProgress) unlistenProgress()
          if (unlistenComplete) unlistenComplete()
          if (unlistenError) unlistenError()
          if (unlistenCancelled) unlistenCancelled()
          if (unlistenStallWarning) unlistenStallWarning()
        } catch (error) {
          // Silently handle cleanup errors to avoid console spam
          logger.debug('Event listener cleanup encountered errors:', error)
        }
      }, 0)
    }
  }, [updateUploadState])

  return {
    progress,
    uploading,
    bytesSent,
    totalBytes,
    stallWarning,
    message,
    setUploading,
    setProgress,
    setMessage
  }
}
