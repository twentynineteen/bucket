/**
 * Tests for useTrelloBoardSearch hook
 * Handles searching and filtering Trello cards with fuzzy search
 */

import { useTrelloBoardSearch } from '@/hooks/useTrelloBoardSearch'
import type { TrelloCard } from '@/utils/TrelloCards'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

const mockCards: TrelloCard[] = [
  {
    id: 'card1',
    name: 'Fix Login Bug',
    desc: 'User authentication issue',
    idList: 'list1'
  },
  { id: 'card2', name: 'Add Dark Mode', desc: 'Implement dark theme', idList: 'list1' },
  {
    id: 'card3',
    name: 'Fix Payment Bug',
    desc: 'Payment processing error',
    idList: 'list2'
  },
  { id: 'card4', name: 'Update Documentation', desc: 'Update API docs', idList: 'list2' }
]

const mockGrouped = {
  'To Do': [mockCards[0], mockCards[1]],
  'In Progress': [mockCards[2], mockCards[3]]
}

describe('useTrelloBoardSearch', () => {
  describe('initialization', () => {
    test('initializes with empty search term', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      expect(result.current.searchTerm).toBe('')
    })

    test('returns all cards when search term is empty', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      expect(result.current.filteredGrouped).toEqual(mockGrouped)
    })
  })

  describe('search by name', () => {
    test('filters cards by exact name match', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Login')
      })

      expect(result.current.filteredGrouped).toEqual({
        'To Do': [mockCards[0]]
      })
    })

    test('filters cards by partial name match', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Bug')
      })

      expect(result.current.filteredGrouped).toEqual({
        'To Do': [mockCards[0]],
        'In Progress': [mockCards[2]]
      })
    })

    test('search is case-insensitive', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('FIX')
      })

      // Should match "Fix Login Bug" and "Fix Payment Bug"
      expect(Object.values(result.current.filteredGrouped).flat()).toHaveLength(2)
    })
  })

  describe('search by description', () => {
    test('filters cards by description content', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('authentication issue')
      })

      // More specific search term to match only card1
      expect(result.current.filteredGrouped).toEqual({
        'To Do': [mockCards[0]]
      })
    })

    test('searches both name and description', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('API')
      })

      // Should match "Update Documentation" card by description
      expect(result.current.filteredGrouped).toEqual({
        'In Progress': [mockCards[3]]
      })
    })
  })

  describe('fuzzy search', () => {
    test('matches with typos using fuzzy threshold', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Dakr')
      })

      // Should match "Dark Mode" despite typo (threshold 0.4)
      expect(Object.values(result.current.filteredGrouped).flat()).toContainEqual(
        mockCards[1]
      )
    })

    test('does not match when difference exceeds threshold', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('xyz123abc')
      })

      expect(result.current.filteredGrouped).toEqual({})
    })
  })

  describe('clearing search', () => {
    test('returns all cards when search is cleared', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Login')
      })
      expect(Object.keys(result.current.filteredGrouped)).toHaveLength(1)

      act(() => {
        result.current.setSearchTerm('')
      })
      expect(result.current.filteredGrouped).toEqual(mockGrouped)
    })

    test('handles whitespace-only search term', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('   ')
      })

      expect(result.current.filteredGrouped).toEqual(mockGrouped)
    })
  })

  describe('filtered grouping', () => {
    test('maintains list grouping structure in results', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Bug')
      })

      // Should have cards from both lists
      expect(Object.keys(result.current.filteredGrouped)).toHaveLength(2)
      expect(result.current.filteredGrouped['To Do']).toHaveLength(1)
      expect(result.current.filteredGrouped['In Progress']).toHaveLength(1)
    })

    test('excludes empty lists from results', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Dark Mode')
      })

      // Should only have "To Do" list, not empty "In Progress"
      expect(Object.keys(result.current.filteredGrouped)).toEqual(['To Do'])
    })

    test('preserves card order within lists', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('Fix')
      })

      // Cards should appear in original order
      expect(result.current.filteredGrouped['To Do'][0].id).toBe('card1')
      expect(result.current.filteredGrouped['In Progress'][0].id).toBe('card3')
    })
  })

  describe('edge cases', () => {
    test('handles empty cards array', () => {
      const { result } = renderHook(() => useTrelloBoardSearch([], {}))

      act(() => {
        result.current.setSearchTerm('test')
      })

      expect(result.current.filteredGrouped).toEqual({})
    })

    test('handles empty grouped object', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, {}))

      act(() => {
        result.current.setSearchTerm('Login')
      })

      // Should still search but results will be empty since no grouping exists
      expect(result.current.filteredGrouped).toEqual({})
    })

    test('handles cards without descriptions', () => {
      const cardsWithoutDesc = [
        { id: 'c1', name: 'Card One', desc: '', idList: 'l1' },
        { id: 'c2', name: 'Card Two', desc: '', idList: 'l1' }
      ]
      const grouped = { 'List 1': cardsWithoutDesc }

      const { result } = renderHook(() => useTrelloBoardSearch(cardsWithoutDesc, grouped))

      act(() => {
        result.current.setSearchTerm('One')
      })

      expect(result.current.filteredGrouped).toEqual({
        'List 1': [cardsWithoutDesc[0]]
      })
    })

    test('handles special characters in search term', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('[Bug]')
      })

      // Should handle special regex characters safely
      expect(() => result.current.filteredGrouped).not.toThrow()
    })

    test('updates when cards prop changes', () => {
      const { result, rerender } = renderHook<
        { cards: TrelloCard[]; grouped: Record<string, TrelloCard[]> },
        ReturnType<typeof useTrelloBoardSearch>
      >(({ cards, grouped }) => useTrelloBoardSearch(cards, grouped), {
        initialProps: { cards: mockCards, grouped: mockGrouped }
      })

      act(() => {
        result.current.setSearchTerm('Login')
      })
      expect(Object.values(result.current.filteredGrouped).flat()).toHaveLength(1)

      // Update cards
      const newCards = [
        ...mockCards,
        { id: 'card5', name: 'Login System', desc: '', idList: 'list1' }
      ]
      const newGrouped = { 'To Do': [...mockGrouped['To Do'], newCards[4]] }
      rerender({ cards: newCards, grouped: newGrouped })

      // Should re-filter with new cards
      expect(Object.values(result.current.filteredGrouped).flat()).toHaveLength(2)
    })

    test('handles rapid search term changes', () => {
      const { result } = renderHook(() => useTrelloBoardSearch(mockCards, mockGrouped))

      act(() => {
        result.current.setSearchTerm('L')
      })
      act(() => {
        result.current.setSearchTerm('Lo')
      })
      act(() => {
        result.current.setSearchTerm('Log')
      })
      act(() => {
        result.current.setSearchTerm('Login')
      })

      expect(result.current.searchTerm).toBe('Login')
      expect(result.current.filteredGrouped).toEqual({
        'To Do': [mockCards[0]]
      })
    })
  })

  describe('performance', () => {
    test('handles large card lists efficiently', () => {
      const largeCards = Array.from({ length: 1000 }, (_, i) => ({
        id: `card${i}`,
        name: `Card ${i}`,
        desc: `Description ${i}`,
        idList: 'list1'
      }))
      const largeGrouped = { 'List 1': largeCards }

      const { result } = renderHook(() => useTrelloBoardSearch(largeCards, largeGrouped))

      const start = performance.now()
      act(() => {
        result.current.setSearchTerm('Card 5')
      })
      const duration = performance.now() - start

      // Should complete quickly even with 1000 cards
      // Threshold set to 250ms to account for different environments
      expect(duration).toBeLessThan(250)
    })
  })
})
