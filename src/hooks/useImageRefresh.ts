import { REFRESH } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryOptions } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { SproutUploadResponse } from '@utils/types'
import { useState } from 'react'

interface UseImageRefreshReturn {
  thumbnailLoaded: boolean
  refreshTimestamp: number
  setThumbnailLoaded: (loaded: boolean) => void
  isRefetching: boolean
  lastRefresh?: string
}

interface ImageRefreshData {
  id: string
  url: string
  lastModified: string
  thumbnailLoaded: boolean
}

export const useImageRefresh = (
  response: SproutUploadResponse | null
): UseImageRefreshReturn => {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)

  // Only create query if response is available
  const videoId = response?.id
  const queryKey = videoId ? queryKeys.images.refresh(videoId) : null

  const { data, isRefetching, dataUpdatedAt } = useQuery(
    createQueryOptions(
      queryKey || ['images', 'refresh', 'disabled'],
      async (): Promise<ImageRefreshData> => {
        if (!response) {
          throw new Error('No video response available')
        }

        // Use dataUpdatedAt (provided by React Query) as timestamp
        // This avoids calling Date.now() during render
        const refreshUrl = response.assets.thumbnails[0]
          ? response.assets.thumbnails[0]
          : `${response.embedded_url}/thumbnail.jpg`

        return {
          id: response.id,
          url: refreshUrl,
          lastModified: new Date().toISOString(),
          thumbnailLoaded: false
        }
      },
      'REALTIME', // 30-second staleTime with auto-refetch
      {
        enabled: !!response && !!videoId,
        refetchInterval: REFRESH.REALTIME, // 30 seconds
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true
        // Note: onSuccess is deprecated in newer React Query versions
        // Consider using useEffect to watch for data changes instead
      }
    )
  )

  // Use dataUpdatedAt from React Query instead of Date.now() or data.lastModified
  // This provides a stable timestamp that updates when the query refetches
  const refreshTimestamp = dataUpdatedAt || 0

  return {
    thumbnailLoaded,
    refreshTimestamp,
    setThumbnailLoaded,
    isRefetching,
    lastRefresh: data?.lastModified
  }
}
