/**
 * useSproutVideoProcessor - React Query hook for processing Sprout Video upload responses
 * Feature: 004-embed-multiple-video
 *
 * Replaces useEffect pattern with React Query mutation for better state management
 */

import { useMutation } from '@tanstack/react-query'
import { createNamespacedLogger } from '@utils/logger'
import type { SproutUploadResponse } from '@utils/types'
import { useEffect, useRef } from 'react'

import type { VideoLink } from '@/types/baker'

const logger = createNamespacedLogger('useSproutVideoProcessor')

interface ProcessVideoResult {
  videoLink: VideoLink | null
  shouldAdd: boolean
  error?: string
}

interface UseSproutVideoProcessorOptions {
  response: SproutUploadResponse | null
  selectedFile: string | null
  uploading: boolean
  enabled: boolean
  onVideoReady: (videoLink: VideoLink) => void
  onError: (error: string) => void
}

/**
 * Processes a Sprout Video upload response and determines if it's ready to be added
 */
function processUploadResponse(
  response: SproutUploadResponse,
  selectedFile: string
): ProcessVideoResult {
  // Check if upload failed
  if (response.state === 'failed') {
    return {
      videoLink: null,
      shouldAdd: false,
      error:
        'Upload failed: Sprout Video could not process the video. Please check the file format and try again.'
    }
  }

  // Extract filename without path and extension for fallback title
  const filename = selectedFile.split('/').pop()?.split('.')[0] || 'Untitled'
  const sourceFilename = selectedFile.split('/').pop() || ''

  // Use embedded_url if available, otherwise construct URL from video ID
  // Sprout Video initially returns state="inspecting" with no embedded_url
  const videoUrl =
    response.embedded_url || `https://sproutvideo.com/videos/${response.id}`

  if (!response.embedded_url) {
    logger.log(
      `Video ${response.id} state: ${response.state}, adding with constructed URL...`
    )
  }

  const videoLink: VideoLink = {
    url: videoUrl,
    sproutVideoId: response.id,
    title: response.title || filename,
    thumbnailUrl: response.assets?.poster_frames?.[0] || undefined,
    uploadDate: response.created_at,
    sourceRenderFile: sourceFilename
  }

  return {
    videoLink,
    shouldAdd: true,
    error: undefined
  }
}

/**
 * Custom hook for processing Sprout Video upload responses
 * Uses React Query mutation pattern with automatic response watching
 */
export function useSproutVideoProcessor(options: UseSproutVideoProcessorOptions) {
  const { response, selectedFile, uploading, enabled, onVideoReady, onError } = options

  // Track which response we've already processed to prevent loops
  const processedResponseId = useRef<string | null>(null)

  // React Query mutation for processing the upload
  const processMutation = useMutation({
    mutationFn: async ({
      response,
      selectedFile
    }: {
      response: SproutUploadResponse
      selectedFile: string
    }) => {
      return processUploadResponse(response, selectedFile)
    },
    onSuccess: (result) => {
      if (result.error) {
        onError(result.error)
      } else if (result.shouldAdd && result.videoLink) {
        onVideoReady(result.videoLink)
      }
      // If neither error nor shouldAdd, video is still processing (silent wait)
    },
    onError: (error: Error) => {
      onError(error.message || 'Failed to process upload response')
    }
  })

  // Watch for response changes and trigger mutation
  // This replaces the useEffect pattern with a more controlled approach
  useEffect(() => {
    if (!enabled || !response || uploading || !selectedFile) {
      return
    }

    // Don't process the same response twice
    if (processedResponseId.current === response.id) {
      return
    }

    // Mark as processed before triggering mutation
    processedResponseId.current = response.id

    // Trigger the mutation
    processMutation.mutate({ response, selectedFile })
  }, [response, uploading, enabled, selectedFile, processMutation])

  // Reset processed ID when needed
  const reset = () => {
    processedResponseId.current = null
  }

  return {
    isProcessing: processMutation.isPending,
    error: processMutation.error,
    reset
  }
}
