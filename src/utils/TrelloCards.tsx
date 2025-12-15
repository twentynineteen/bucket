import { useQuery } from '@tanstack/react-query'

import { logger } from './logger'

// Define an interface for a Trello card (adjust fields as needed)
export interface TrelloCard {
  id: string
  name: string
  desc: string
  idList: string
  // Add more properties as required by your display needs.
}

export interface TrelloList {
  id: string
  name: string
}

/**
 * Fetches all lists on a Trello board.
 * @param apiKey - Your Trello API key.
 * @param token - Your Trello token.
 * @param boardId - The ID of the Trello board.
 * @returns A promise resolving to an array of TrelloList objects.
 */
export async function fetchTrelloLists(
  apiKey: string,
  token: string,
  boardId: string
): Promise<TrelloList[]> {
  const url = `https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${token}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }
    const lists: TrelloList[] = await response.json()
    return lists
  } catch (error) {
    logger.error('Error fetching Trello lists:', error)
    throw error
  }
}

/**
 * Fetches the cards for the "Small Projects" Trello board.
 * @param apiKey - Your Trello API key.
 * @param token - Your Trello authentication token.
 * @returns A promise that resolves to an array of TrelloCard objects.
 */
export async function fetchTrelloCards(
  apiKey: string,
  token: string,
  boardId: string
): Promise<TrelloCard[]> {
  // Construct the URL with both key and token.
  const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }
    // Parse and return the cards as an array of TrelloCard objects.
    const cards: TrelloCard[] = await response.json()
    return cards
  } catch (error) {
    logger.error('Error fetching Trello cards:', error)
    throw error
  }
}

/**
 * Groups Trello cards by their list.
 * @param cards - Array of TrelloCard objects.
 * @param lists - Array of TrelloList objects.
 * @returns An object where keys are list names and values are arrays of cards in that list.
 */
export function groupCardsByList(
  cards: TrelloCard[],
  lists: TrelloList[]
): Record<string, TrelloCard[]> {
  const listMap = new Map<string, string>()
  lists.forEach((list) => {
    listMap.set(list.id, list.name)
  })

  const grouped: Record<string, TrelloCard[]> = {}

  cards.forEach((card) => {
    const listName = listMap.get(card.idList) || 'Unknown List'
    if (!grouped[listName]) {
      grouped[listName] = []
    }
    grouped[listName].push(card)
  })

  return grouped
}

export interface TrelloMember {
  id: string
  fullName: string
  username: string
  avatarUrl?: string // Optional if API provides avatars
}

/**
 * Custom hook to fetch Trello card members using React Query.
 * @param cardId - The id for the requested Trello card.
 * @param apiKey - Your Trello API key.
 * @param token - Your Trello authentication token.
 * @returns The query result with data, error, and status.
 */
export function useTrelloCardMembers(cardId: string, apiKey: string, token: string) {
  const query = useQuery({
    queryKey: ['trelloCardMembers', cardId],
    queryFn: async () => {
      const url = `https://api.trello.com/1/cards/${cardId}/members?key=${apiKey}&token=${token}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const members: TrelloMember[] = await response.json()
      return members
    }
  })

  return query
}

/**
 * Updates a Trello card with the provided fields.
 *
 * @param cardId - The ID of the Trello card to update.
 * @param updates - Fields to update (name and/or desc).
 * @param apiKey - Your Trello API key.
 * @param token - Your Trello authentication token.
 */
export async function updateCard(
  cardId: string,
  updates: Partial<{ name: string; desc: string }>,
  apiKey: string,
  token: string
): Promise<void> {
  const url = `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${token}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update Trello card: ${error}`)
  }
}
