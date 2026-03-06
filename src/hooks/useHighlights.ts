/**
 * React hook for managing transcript highlights
 *
 * Stores and retrieves user-saved highlights from localStorage,
 * allowing users to mark and revisit important sections of video transcripts.
 */

import type { TranscriptHighlight } from '@/types/transcript'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'video-lesson-highlights'

interface UseHighlightsReturn {
  /** All highlights for the current video */
  highlights: TranscriptHighlight[]

  /** All highlights across all videos */
  allHighlights: TranscriptHighlight[]

  /** Add a new highlight */
  addHighlight: (
    highlight: Omit<TranscriptHighlight, 'id' | 'createdAt'>
  ) => TranscriptHighlight

  /** Remove a highlight by ID */
  removeHighlight: (id: string) => void

  /** Clear all highlights for the current video */
  clearHighlights: () => void

  /** Clear all highlights across all videos */
  clearAllHighlights: () => void
}

/**
 * Generate a unique ID for highlights
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Load highlights from localStorage
 */
function loadHighlights(): TranscriptHighlight[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as TranscriptHighlight[]
  } catch (error) {
    console.error('Failed to load highlights from localStorage:', error)
    return []
  }
}

/**
 * Save highlights to localStorage
 */
function saveHighlights(highlights: TranscriptHighlight[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(highlights))
  } catch (error) {
    console.error('Failed to save highlights to localStorage:', error)
  }
}

/**
 * Hook for managing transcript highlights with localStorage persistence
 *
 * @param videoId - Current video ID to filter highlights
 * @returns Highlight management functions and current highlights
 *
 * @example
 * const { highlights, addHighlight, removeHighlight } = useHighlights(videoId)
 *
 * // Add a highlight from text selection
 * const newHighlight = addHighlight({
 *   videoId,
 *   text: selectedText,
 *   startTime: words[startIndex].startTime,
 *   endTime: words[endIndex].endTime,
 *   startWordIndex: startIndex,
 *   endWordIndex: endIndex
 * })
 *
 * // Remove a highlight
 * removeHighlight(highlightId)
 */
export function useHighlights(videoId: string | null): UseHighlightsReturn {
  const [allHighlights, setAllHighlights] = useState<TranscriptHighlight[]>([])

  // Load highlights from localStorage on mount
  useEffect(() => {
    setAllHighlights(loadHighlights())
  }, [])

  // Filter highlights for current video
  const highlights = videoId
    ? allHighlights.filter((h) => h.videoId === videoId)
    : []

  const addHighlight = useCallback(
    (
      highlight: Omit<TranscriptHighlight, 'id' | 'createdAt'>
    ): TranscriptHighlight => {
      const newHighlight: TranscriptHighlight = {
        ...highlight,
        id: generateId(),
        createdAt: new Date().toISOString()
      }

      setAllHighlights((prev) => {
        const updated = [...prev, newHighlight]
        saveHighlights(updated)
        return updated
      })

      return newHighlight
    },
    []
  )

  const removeHighlight = useCallback((id: string) => {
    setAllHighlights((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      saveHighlights(updated)
      return updated
    })
  }, [])

  const clearHighlights = useCallback(() => {
    if (!videoId) return

    setAllHighlights((prev) => {
      const updated = prev.filter((h) => h.videoId !== videoId)
      saveHighlights(updated)
      return updated
    })
  }, [videoId])

  const clearAllHighlights = useCallback(() => {
    setAllHighlights([])
    saveHighlights([])
  }, [])

  return {
    highlights,
    allHighlights,
    addHighlight,
    removeHighlight,
    clearHighlights,
    clearAllHighlights
  }
}
