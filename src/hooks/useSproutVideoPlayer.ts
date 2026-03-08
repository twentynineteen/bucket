// Target: @features/Upload
/**
 * React hook for SproutVideo Player API integration
 *
 * Manages player instance, event bindings, and playback control
 * for synchronized transcript display.
 */

import type { SproutVideoPlayer } from '@/types/transcript'
import { createNamespacedLogger } from '@shared/utils/logger'
import { useCallback, useEffect, useRef, useState } from 'react'

const logger = createNamespacedLogger('useSproutVideoPlayer')

declare global {
  interface Window {
    SV: {
      Player: new (options: { videoId: string }) => SproutVideoPlayer
    }
  }
}

interface UseSproutVideoPlayerOptions {
  /** Callback when player time updates (fires frequently) */
  onTimeUpdate?: (time: number) => void

  /** Callback when player is ready */
  onReady?: (duration: number) => void

  /** Callback when video completes */
  onComplete?: () => void
}

interface UseSproutVideoPlayerReturn {
  /** Reference to the player instance */
  playerRef: React.RefObject<SproutVideoPlayer | null>

  /** Current playback time in seconds */
  currentTime: number

  /** Video duration in seconds */
  duration: number

  /** Whether the player is ready */
  isReady: boolean

  /** Whether the player is currently playing */
  isPlaying: boolean

  /** Seek to a specific time */
  seek: (time: number) => void

  /** Play the video */
  play: () => void

  /** Pause the video */
  pause: () => void

  /** Toggle play/pause */
  togglePlayback: () => void
}

/**
 * Hook for managing SproutVideo Player instance
 *
 * @param videoId - SproutVideo video ID (null if not loaded)
 * @param options - Player event callbacks
 * @returns Player controls and state
 *
 * @example
 * const { currentTime, seek, isReady } = useSproutVideoPlayer(videoId, {
 *   onTimeUpdate: (time) => setActiveWordIndex(findWordAtTime(words, time)),
 *   onReady: (duration) => console.log(`Video duration: ${duration}s`)
 * })
 */
export function useSproutVideoPlayer(
  videoId: string | null,
  options: UseSproutVideoPlayerOptions = {}
): UseSproutVideoPlayerReturn {
  const { onTimeUpdate, onReady, onComplete } = options

  const playerRef = useRef<SproutVideoPlayer | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Initialize player when videoId changes
  useEffect(() => {
    if (!videoId) {
      playerRef.current = null
      return
    }

    // Check if SV Player API is available
    if (typeof window.SV === 'undefined') {
      logger.error('SproutVideo Player API not loaded')
      return
    }

    // Create new player instance
    const player = new window.SV.Player({ videoId })
    playerRef.current = player

    // Bind ready event
    player.bind('ready', (e) => {
      const videoDuration = e.data.duration || 0
      setDuration(videoDuration)
      setIsReady(true)
      onReady?.(videoDuration)
    })

    // Bind progress event for time updates
    player.bind('progress', (e) => {
      const time = e.data.time || 0
      setCurrentTime(time)
      onTimeUpdate?.(time)
    })

    // Bind play/pause events
    player.bind('play', () => {
      setIsPlaying(true)
    })

    player.bind('pause', () => {
      setIsPlaying(false)
    })

    // Bind completed event
    player.bind('completed', () => {
      setIsPlaying(false)
      onComplete?.()
    })

    // Reset state and unbind events on cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.unbind('ready')
        playerRef.current.unbind('progress')
        playerRef.current.unbind('play')
        playerRef.current.unbind('pause')
        playerRef.current.unbind('completed')
        playerRef.current = null
      }
      setIsReady(false)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
    }
  }, [videoId, onTimeUpdate, onReady, onComplete])

  const seek = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seek(time)
      setCurrentTime(time)
    }
  }, [])

  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.play()
    }
  }, [])

  const pause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause()
    }
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  return {
    playerRef,
    currentTime,
    duration,
    isReady,
    isPlaying,
    seek,
    play,
    pause,
    togglePlayback
  }
}
