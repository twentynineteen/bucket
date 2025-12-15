import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryOptions } from '@lib/query-utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef } from 'react'

import { logger } from '@/utils/logger'

interface UseUploadEventsReturn {
  progress: number
  uploading: boolean
  message: string | null
  setUploading: (uploading: boolean) => void
  setProgress: (progress: number) => void
  setMessage: (message: string | null) => void
}

export const useUploadEvents = (): UseUploadEventsReturn => {
  const queryClient = useQueryClient()
  const listenersSetup = useRef(false)

  // Use React Query to manage upload state with real-time updates
  const { data: uploadState } = useQuery({
    ...createQueryOptions(
      queryKeys.upload.events(),
      async () => ({
        progress: 0,
        uploading: false,
        message: null as string | null
      }),
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

  // Helper to update upload state via React Query
  const updateUploadState = useCallback(
    (
      updates: Partial<{
        progress: number
        uploading: boolean
        message: string | null
      }>
    ) => {
      queryClient.setQueryData(
        queryKeys.upload.events(),
        (
          old:
            | {
                progress: number
                uploading: boolean
                message: string | null
              }
            | undefined
        ) => ({
          progress: 0,
          uploading: false,
          message: null,
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
    (newMessage: string | null) => {
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
    let isMounted = true

    const setupListeners = async () => {
      try {
        unlistenProgress = await listen('upload_progress', (event) => {
          if (isMounted) {
            const progressValue = event.payload as number
            updateUploadState({ progress: progressValue })
          }
        })

        unlistenComplete = await listen('upload_complete', () => {
          if (isMounted) {
            // Backend sends the response object, not a string message
            // Convert to a success message for display
            updateUploadState({
              message: 'Upload successful',
              uploading: false,
              progress: 100
            })
          }
        })

        unlistenError = await listen('upload_error', (event) => {
          if (isMounted) {
            const errorMessage = event.payload as string
            updateUploadState({
              message: errorMessage,
              uploading: false
            })
          }
        })
      } catch (error) {
        logger.error('Failed to setup upload event listeners:', error)
        updateUploadState({
          message: 'Failed to setup event listeners',
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
    message,
    setUploading,
    setProgress,
    setMessage
  }
}
