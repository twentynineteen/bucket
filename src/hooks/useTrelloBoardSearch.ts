/**
 * useTrelloBoardSearch - Search and filter Trello cards
 * Provides fuzzy search across card names and descriptions
 */

import type { TrelloCard } from '@utils/TrelloCards'
import { useMemo } from 'react'

import { useFuzzySearch } from './useFuzzySearch'

/**
 * Hook to search and filter Trello cards with fuzzy matching
 * @param allCards - Flat array of all Trello cards
 * @param grouped - Cards grouped by list name
 * @returns Filtered grouped cards and search controls
 */
export function useTrelloBoardSearch(
  allCards: TrelloCard[],
  grouped: Record<string, TrelloCard[]>
) {
  // Use fuzzy search hook with name and desc as searchable fields
  const {
    searchTerm,
    setSearchTerm,
    results: filteredCards
  } = useFuzzySearch(allCards, {
    keys: ['name', 'desc'],
    threshold: 0.4
  })

  // Re-group filtered cards by list
  const filteredGrouped = useMemo(() => {
    // If no search term (or whitespace only), return all cards
    if (!searchTerm.trim()) {
      return grouped
    }

    const result: Record<string, TrelloCard[]> = {}

    // Match filtered cards back to their original lists
    filteredCards.forEach((card) => {
      // Find which list this card belongs to
      Object.entries(grouped).forEach(([listName, cards]) => {
        if (cards.some((c) => c.id === card.id)) {
          if (!result[listName]) {
            result[listName] = []
          }
          result[listName].push(card)
        }
      })
    })

    return result
  }, [searchTerm, filteredCards, grouped])

  return {
    searchTerm,
    setSearchTerm,
    filteredGrouped
  }
}
