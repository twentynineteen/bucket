import { CACHE } from '@shared/constants/timing'
import { queryKeys } from '@shared/lib/query-keys'
import {
  createQueryError,
  createQueryOptions,
  shouldRetry
} from '@shared/lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { loadApiKeys } from '@shared/utils/storage'
import { useMemo } from 'react'

import { logger } from '@shared/utils/logger'

import { fetchBoardCards, fetchBoardLists } from '../api'
import { groupCardsByList } from '../internal/TrelloCards'
import type { TrelloCard } from '../types'

interface TrelloBoardData {
  grouped: Record<string, TrelloCard[]>
  allCards: TrelloCard[]
  isLoading: boolean
  apiKey: string | null
  token: string | null
}

/**
 * Custom hook to fetch Trello cards and lists for a board,
 * then group the cards by their list.
 */
export function useTrelloBoard(boardId: string): TrelloBoardData {
  // Use a simpler approach - direct query for credentials
  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: loadApiKeys,
    staleTime: CACHE.STANDARD,
    refetchOnWindowFocus: false
  })

  const apiKey = credentials?.trello || null
  const token = credentials?.trelloToken || null

  // Fetch cards with proper error handling
  const { data: cards, isLoading: cardsLoading } = useQuery({
    ...createQueryOptions(
      queryKeys.trello.cards(boardId),
      async () => {
        if (!apiKey || !token)
          throw createQueryError('API key or token missing', 'AUTHENTICATION')
        return fetchBoardCards(boardId, apiKey, token)
      },
      'DYNAMIC',
      {
        enabled: !!apiKey && !!token && !credentialsLoading,
        staleTime: CACHE.QUICK, // 2 minutes
        retry: (failureCount, error) =>
          shouldRetry(error, failureCount, 'external')
      }
    )
  })

  // Fetch lists with proper error handling
  const { data: lists, isLoading: listsLoading } = useQuery({
    ...createQueryOptions(
      queryKeys.trello.lists(boardId),
      async () => {
        if (!apiKey || !token)
          throw createQueryError('API key or token missing', 'AUTHENTICATION')
        return fetchBoardLists(boardId, apiKey, token)
      },
      'DYNAMIC',
      {
        enabled: !!apiKey && !!token && !credentialsLoading,
        staleTime: CACHE.QUICK, // 2 minutes
        retry: (failureCount, error) =>
          shouldRetry(error, failureCount, 'external')
      }
    )
  })

  // Use React Query's computed state pattern instead of useEffect
  const isDataReady = cards && lists && !cardsLoading && !listsLoading
  const isLoading = credentialsLoading || cardsLoading || listsLoading

  // Compute grouped cards as a derived value using useMemo
  const grouped = useMemo(() => {
    if (isDataReady) {
      try {
        return groupCardsByList(cards, lists)
      } catch (error) {
        logger.error('Error grouping Trello cards:', error)
        return {}
      }
    }
    return {}
  }, [cards, lists, isDataReady])

  // Flatten all cards for search/filtering
  const allCards = useMemo(() => {
    return cards || []
  }, [cards])

  return {
    grouped,
    allCards,
    isLoading,
    apiKey,
    token
  }
}
