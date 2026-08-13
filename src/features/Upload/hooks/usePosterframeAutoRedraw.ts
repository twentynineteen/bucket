import { CACHE } from '@shared/constants'
import { queryKeys, createQueryError, createQueryOptions, shouldRetry } from '@shared/lib'
import { useQuery } from '@tanstack/react-query'
import { debounce } from '@shared/utils'
import { useEffect, useMemo, useRef } from 'react'

import type { PosterframeTemplateId } from '../internal/posterframeTemplates'

interface AutoRedrawProps {
  draw: (
    imageUrl: string,
    title: string,
    templateId: PosterframeTemplateId
  ) => Promise<void>
  imageUrl: string | null
  title: string
  templateId: PosterframeTemplateId
  debounceMs?: number
}

export function usePosterframeAutoRedraw({
  draw,
  imageUrl,
  title,
  templateId,
  debounceMs = 300
}: AutoRedrawProps) {
  // Create stable keys for the drawing operation. The template is part of the
  // key: both templates can resolve to the same background file, and a
  // template switch must repaint even then (issue #189 B3.7).
  const drawKey = useMemo(
    () => (imageUrl && title.trim() ? `${templateId}-${imageUrl}-${title.trim()}` : null),
    [imageUrl, title, templateId]
  )

  // Use React Query to manage the debounced drawing operation
  const { refetch: triggerRedraw } = useQuery({
    ...createQueryOptions(
      queryKeys.images.posterframe.autoRedraw(drawKey || 'pending'),
      async () => {
        if (!imageUrl || !title.trim()) return null

        try {
          await draw(imageUrl, title, templateId)
          return {
            imageUrl,
            title,
            templateId,
            drawnAt: new Date().toISOString()
          }
        } catch (error) {
          throw createQueryError(`Failed to draw posterframe: ${error}`, 'DRAW_OPERATION')
        }
      },
      'STATIC', // Use static profile for draw operations
      {
        enabled: false, // Only run when manually triggered
        staleTime: CACHE.STANDARD, // 5 minutes - don't redraw same content too often
        gcTime: CACHE.GC_MEDIUM, // Keep cached for 10 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'canvas')
      }
    )
  })

  // Create debounced trigger function using React Query's refetch
  const debouncedTriggerRef = useRef(
    debounce(() => {
      if (drawKey) {
        triggerRedraw()
      }
    }, debounceMs)
  )

  // Update debounce timing when it changes
  useEffect(() => {
    debouncedTriggerRef.current = debounce(() => {
      if (drawKey) {
        triggerRedraw()
      }
    }, debounceMs)
  }, [debounceMs, triggerRedraw, drawKey])

  // Trigger initial draw when image loads (even without title)
  useEffect(() => {
    if (imageUrl && !title.trim()) {
      // Draw just the background image immediately when image is selected
      draw(imageUrl, '', templateId)
    }
  }, [imageUrl, title, templateId, draw])

  // Trigger debounced redraw when dependencies change - the template
  // included, or switching it with the same image and title paints nothing.
  useEffect(() => {
    if (imageUrl && title.trim()) {
      debouncedTriggerRef.current()
    } else {
      // Cancel pending draws if inputs become invalid
      debouncedTriggerRef.current.cancel?.()
    }

    // Cleanup on unmount
    return () => {
      debouncedTriggerRef.current.cancel?.()
    }
  }, [imageUrl, title, templateId])
}
