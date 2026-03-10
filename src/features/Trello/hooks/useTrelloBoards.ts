import { CACHE } from '@shared/constants'
import { queryKeys } from '@shared/lib'
import { useQuery } from '@tanstack/react-query'
import { TrelloBoard } from '@shared/types'

import { useApiKeys } from '@shared/hooks'

import { fetchTrelloBoards } from '../api'

export interface UseTrelloBoardsReturn {
  /** Array of available Trello boards */
  boards: TrelloBoard[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Refetch function to manually refresh boards */
  refetch: () => void
}

/**
 * Hook to fetch all Trello boards the authenticated user is a member of
 * Caches results for 30 minutes for economical API usage
 */
export function useTrelloBoards(): UseTrelloBoardsReturn {
  const { data: apiKeys } = useApiKeys()

  const {
    data: boards,
    isLoading,
    error,
    refetch
  } = useQuery<TrelloBoard[], Error>({
    queryKey: queryKeys.trello.boards(),
    queryFn: async () => {
      if (!apiKeys?.trello || !apiKeys?.trelloToken) {
        throw new Error('Trello API credentials not configured')
      }

      return fetchTrelloBoards(apiKeys.trello, apiKeys.trelloToken)
    },
    enabled: Boolean(apiKeys?.trello && apiKeys?.trelloToken),
    staleTime: CACHE.LONG, // 30 minutes
    gcTime: CACHE.GC_EXTENDED, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false
  })

  return {
    boards: boards || [],
    isLoading,
    error: error as Error | null,
    refetch: () => {
      refetch()
    }
  }
}
