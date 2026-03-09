import { useQuery } from '@tanstack/react-query'

import { fetchCardWithMembers } from '../api'
import type { TrelloCard, TrelloMember } from '../types'

interface CardWithMembers extends TrelloCard {
  members?: TrelloMember[]
}

interface CardDetailsResult {
  card: TrelloCard | undefined
  members: TrelloMember[] | undefined
  isLoading: boolean
  refetchCard: () => Promise<unknown>
  refetchMembers: () => Promise<unknown>
  refetch: () => Promise<unknown>
}

/**
 * Fetch Trello card details with members in a single batched API request
 *
 * @performance Optimization - Uses single API call with `members=true` parameter
 * instead of separate requests for card and members. Reduces API calls by 50%.
 */
export function useTrelloCardDetails(
  cardId: string | null,
  apiKey: string | null,
  token: string | null
): CardDetailsResult {
  const query = useQuery({
    queryKey: ['trello-card-with-members', cardId],
    queryFn: async () => {
      return fetchCardWithMembers(
        cardId!,
        apiKey!,
        token!
      ) as Promise<CardWithMembers>
    },
    enabled: !!cardId && !!apiKey && !!token
  })

  return {
    card: query.data,
    members: query.data?.members,
    isLoading: query.isLoading,
    refetchCard: query.refetch,
    refetchMembers: query.refetch,
    refetch: query.refetch
  }
}
