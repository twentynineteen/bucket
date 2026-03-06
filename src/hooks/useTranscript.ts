/**
 * React Query hook for fetching and parsing video transcripts
 *
 * Fetches subtitle data from SproutVideo API and parses WebVTT
 * into word-level timing data for synchronized display.
 */

import type { ParsedTranscript, SubtitleTrack } from '@/types/transcript'
import { parseVttToTranscript } from '@utils/vttParser'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

interface UseTranscriptOptions {
  /** Whether to enable the query (default: true when videoId is provided) */
  enabled?: boolean

  /** Preferred language code (default: 'en') */
  preferredLanguage?: string
}

interface UseTranscriptReturn {
  /** Parsed transcript with word-level timing */
  transcript: ParsedTranscript | null

  /** Available subtitle tracks */
  tracks: SubtitleTrack[]

  /** Currently selected track */
  selectedTrack: SubtitleTrack | null

  /** Whether transcript is loading */
  isLoading: boolean

  /** Error if fetch failed */
  error: Error | null

  /** Refetch transcript data */
  refetch: () => void
}

/**
 * Hook for fetching and parsing video transcripts
 *
 * @param videoId - SproutVideo video ID
 * @param apiKey - SproutVideo API key
 * @param options - Query options
 * @returns Parsed transcript data and loading state
 *
 * @example
 * const { transcript, isLoading, error } = useTranscript(videoId, apiKey)
 *
 * if (transcript) {
 *   console.log(`${transcript.words.length} words loaded`)
 * }
 */
export function useTranscript(
  videoId: string | null,
  apiKey: string | null,
  options: UseTranscriptOptions = {}
): UseTranscriptReturn {
  const { enabled = true, preferredLanguage = 'en' } = options

  const query = useQuery({
    queryKey: ['transcript', videoId],
    queryFn: async (): Promise<{
      tracks: SubtitleTrack[]
      transcript: ParsedTranscript | null
      selectedTrack: SubtitleTrack | null
    }> => {
      if (!videoId || !apiKey) {
        throw new Error('Video ID and API key are required')
      }

      // Fetch subtitle tracks from SproutVideo API
      const tracks = await invoke<SubtitleTrack[]>('fetch_video_subtitles', {
        videoId,
        apiKey
      })

      if (!tracks || tracks.length === 0) {
        return {
          tracks: [],
          transcript: null,
          selectedTrack: null
        }
      }

      // Select preferred track (by language) or first available
      const selectedTrack =
        tracks.find((t) => t.language === preferredLanguage && t.published) ||
        tracks.find((t) => t.published) ||
        tracks[0]

      // Parse WebVTT content to transcript with word-level timing
      const transcript = parseVttToTranscript(
        selectedTrack.content,
        selectedTrack.language
      )

      return {
        tracks,
        transcript,
        selectedTrack
      }
    },
    enabled: enabled && !!videoId && !!apiKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000 // 30 minutes (keep in cache longer)
  })

  return {
    transcript: query.data?.transcript ?? null,
    tracks: query.data?.tracks ?? [],
    selectedTrack: query.data?.selectedTrack ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}
