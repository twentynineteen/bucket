/**
 * React Query hook for fetching SproutVideo details including HLS URL
 *
 * Fetches video metadata from the SproutVideo API, including the HLS manifest
 * URL for direct streaming playback.
 */

import type { SproutVideoDetails } from '@shared/types/media'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

interface UseVideoDetailsOptions {
  /** Whether to enable the query */
  enabled?: boolean
}

interface UseVideoDetailsReturn {
  /** Video details including HLS URL */
  details: SproutVideoDetails | null

  /** HLS manifest URL for streaming */
  hlsUrl: string | null

  /** Poster/thumbnail URL */
  posterUrl: string | null

  /** Whether details are loading */
  isLoading: boolean

  /** Error if fetch failed */
  error: Error | null

  /** Refetch video details */
  refetch: () => void
}

/**
 * Hook for fetching video details with HLS streaming URL
 *
 * @param videoId - SproutVideo video ID
 * @param apiKey - SproutVideo API key
 * @param options - Query options
 * @returns Video details including HLS manifest URL
 *
 * @example
 * const { hlsUrl, posterUrl, isLoading } = useVideoDetails(videoId, apiKey)
 *
 * if (hlsUrl) {
 *   return <VideoPlayer hlsUrl={hlsUrl} posterUrl={posterUrl} />
 * }
 */
export function useVideoDetails(
  videoId: string | null,
  apiKey: string | null,
  options: UseVideoDetailsOptions = {}
): UseVideoDetailsReturn {
  const { enabled = true } = options

  const query = useQuery({
    queryKey: ['video-details', videoId],
    queryFn: async (): Promise<SproutVideoDetails> => {
      if (!videoId || !apiKey) {
        throw new Error('Video ID and API key are required')
      }

      const details = await invoke<SproutVideoDetails>('fetch_sprout_video_details', {
        videoId,
        apiKey
      })

      return details
    },
    enabled: enabled && !!videoId && !!apiKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes
  })

  const details = query.data ?? null
  const hlsUrl = details?.assets?.hls_manifest ?? null
  const posterUrl = details?.assets?.poster_frames?.[0] ?? null

  return {
    details,
    hlsUrl,
    posterUrl,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}
