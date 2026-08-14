import { CACHE } from '@shared/constants'
import { queryKeys, createQueryError, createQueryOptions, shouldRetry } from '@shared/lib'
import { useQuery } from '@tanstack/react-query'
import { useApiKeys } from '@shared/hooks'
import { logger } from '@shared/utils'
import { useMemo } from 'react'

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
export function useTrelloBoard(boardId: string | null): TrelloBoardData {
  // Use a simpler approach - direct query for credentials
  // Uses the shared hook so this reads the same cache entry as everything
  // else backed by api_keys.json (issue #155 P5-a).
  const { data: credentials, isLoading: credentialsLoading } = useApiKeys()

  const apiKey = credentials?.trello || null
  const token = credentials?.trelloToken || null

  // Nullable because useTrelloCardsManager passes null to mean "the caller gave
  // me no credentials, do not fetch". That null used to reach the query key
  // unguarded, so when api_keys.json held credentials the props had not passed
  // on, the query ran against board "null" and 404d into an empty card list
  // (#210). The key needs a string; the guard belongs in `enabled`.
  const boardKey = boardId ?? ''
  const canFetch = !!boardId && !!apiKey && !!token && !credentialsLoading

  // Fetch cards with proper error handling
  const { data: cards, isLoading: cardsLoading } = useQuery({
    ...createQueryOptions(
      queryKeys.trello.cards(boardKey),
      async () => {
        if (!apiKey || !token)
          throw createQueryError('API key or token missing', 'AUTHENTICATION')
        return fetchBoardCards(boardKey, apiKey, token)
      },
      'DYNAMIC',
      {
        enabled: canFetch,
        staleTime: CACHE.QUICK, // 2 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'external')
      }
    )
  })

  // Fetch lists with proper error handling
  const { data: lists, isLoading: listsLoading } = useQuery({
    ...createQueryOptions(
      queryKeys.trello.lists(boardKey),
      async () => {
        if (!apiKey || !token)
          throw createQueryError('API key or token missing', 'AUTHENTICATION')
        return fetchBoardLists(boardKey, apiKey, token)
      },
      'DYNAMIC',
      {
        enabled: canFetch,
        staleTime: CACHE.QUICK, // 2 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'external')
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
