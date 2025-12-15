import { useQuery } from '@tanstack/react-query'
import { TrelloCard, TrelloMember } from '@utils/TrelloCards'

interface CardWithMembers extends TrelloCard {
  members?: TrelloMember[]
}

interface CardDetailsResult {
  card: TrelloCard | undefined
  members: TrelloMember[] | undefined
  isLoading: boolean
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
      // Single API call with members included
      const res = await fetch(
        `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}&members=true`
      )
      if (!res.ok) throw new Error('Failed to fetch card')
      return res.json() as Promise<CardWithMembers>
    },
    enabled: !!cardId && !!apiKey && !!token
  })

  return {
    card: query.data,
    members: query.data?.members,
    isLoading: query.isLoading,
    refetch: query.refetch
  }
}
