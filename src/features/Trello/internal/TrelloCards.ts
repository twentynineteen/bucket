/**
 * Internal Trello utility functions
 * Not exported from barrel - module-internal only
 */

import type { TrelloCard, TrelloList } from '../types'

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
