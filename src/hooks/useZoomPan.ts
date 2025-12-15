import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryOptions } from '@lib/query-utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

interface ZoomPanState {
  zoomLevel: number
  pan: { x: number; y: number }
}

interface ZoomPanData extends ZoomPanState {
  setZoomLevel: (zoom: number | ((prev: number) => number)) => void
  setPan: (pan: { x: number; y: number }) => void
  resetZoomPan: () => void
  isResetting?: boolean
}

export function useZoomPan(
  containerId: string = 'default',
  initialZoom = 1
): ZoomPanData {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.images.zoomPan(containerId)

  const { data } = useQuery(
    createQueryOptions(
      queryKey,
      async (): Promise<ZoomPanState> => {
        // Return default state - this is essentially client-side state
        return {
          zoomLevel: initialZoom,
          pan: { x: 0, y: 0 }
        }
      },
      'STATIC', // Long cache time for UI state
      {
        staleTime: Infinity, // UI state doesn't go stale
        gcTime: CACHE.GC_MEDIUM, // 10 minutes cache
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false
      }
    )
  )

  const currentState = useMemo(
    () => data || { zoomLevel: initialZoom, pan: { x: 0, y: 0 } },
    [data, initialZoom]
  )

  const setZoomLevel = useCallback(
    (zoom: number | ((prev: number) => number)) => {
      const newZoom = typeof zoom === 'function' ? zoom(currentState.zoomLevel) : zoom

      const newState: ZoomPanState = {
        zoomLevel: newZoom,
        pan: newZoom === 1 ? { x: 0, y: 0 } : currentState.pan // Reset pan when zoom is 1
      }

      queryClient.setQueryData(queryKey, newState)
    },
    [queryClient, queryKey, currentState]
  )

  const setPan = useCallback(
    (pan: { x: number; y: number }) => {
      const newState: ZoomPanState = {
        ...currentState,
        pan
      }

      queryClient.setQueryData(queryKey, newState)
    },
    [queryClient, queryKey, currentState]
  )

  const resetZoomPan = useCallback(() => {
    const resetState: ZoomPanState = {
      zoomLevel: initialZoom,
      pan: { x: 0, y: 0 }
    }

    queryClient.setQueryData(queryKey, resetState)
  }, [queryClient, queryKey, initialZoom])

  return {
    zoomLevel: currentState.zoomLevel,
    pan: currentState.pan,
    setZoomLevel,
    setPan,
    resetZoomPan
  }
}
