/**
 * Tests for useTrelloBoard hook
 * Handles board data fetching, searching, and filtering
 */

import { useTrelloBoard } from '@features/Trello'
import { loadApiKeys } from '@shared/utils/storage'
import { fetchBoardCards, fetchBoardLists } from '@features/Trello/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock dependencies
vi.mock('@features/Trello/api', () => ({
  fetchBoardCards: vi.fn(),
  fetchBoardLists: vi.fn()
}))

vi.mock('@features/Trello/internal/TrelloCards', () => ({
  groupCardsByList: vi.fn((cards: any[], lists: any[]) => {
    const grouped: Record<string, any[]> = {}
    const listMap = lists.reduce((acc: Record<string, string>, list: any) => {
      acc[list.id] = list.name
      return acc
    }, {})

    cards.forEach((card: any) => {
      const listName = listMap[card.idList]
      if (listName) {
        if (!grouped[listName]) grouped[listName] = []
        grouped[listName].push(card)
      }
    })
    return grouped
  })
}))

vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    trello: {
      cards: (boardId: string) => ['trello', 'cards', boardId],
      lists: (boardId: string) => ['trello', 'lists', boardId]
    }
  }
}))

vi.mock('@shared/utils/storage', () => ({
  loadApiKeys: vi.fn()
}))

vi.mock('@shared/lib/query-utils', () => ({
  createQueryError: vi.fn((message: string) => new Error(message)),
  createQueryOptions: vi.fn((queryKey, queryFn, type, options) => ({
    queryKey,
    queryFn,
    ...options
  })),
  shouldRetry: vi.fn(() => false)
}))

const mockCards = [
  { id: 'card1', name: 'Card One', desc: 'Description one', idList: 'list1' },
  { id: 'card2', name: 'Card Two', desc: 'Description two', idList: 'list1' },
  { id: 'card3', name: 'Card Three', desc: 'Description three', idList: 'list2' }
]

const mockLists = [
  { id: 'list1', name: 'To Do' },
  { id: 'list2', name: 'In Progress' }
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useTrelloBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadApiKeys).mockResolvedValue({
      trello: 'test-api-key',
      trelloToken: 'test-token'
    })
    vi.mocked(fetchBoardCards).mockResolvedValue(mockCards)
    vi.mocked(fetchBoardLists).mockResolvedValue(mockLists)
  })

  describe('data fetching', () => {
    test('fetches board data with API credentials', async () => {
      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(loadApiKeys).toHaveBeenCalled()
      expect(fetchBoardCards).toHaveBeenCalledWith(
        'board123',
        'test-api-key',
        'test-token'
      )
      expect(fetchBoardLists).toHaveBeenCalledWith(
        'board123',
        'test-api-key',
        'test-token'
      )
    })

    test('returns loading state while fetching', () => {
      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      expect(result.current.isLoading).toBe(true)
    })

    test('groups cards by list after loading', async () => {
      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.grouped).toEqual({
        'To Do': [mockCards[0], mockCards[1]],
        'In Progress': [mockCards[2]]
      })
    })

    test('returns API credentials', async () => {
      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.apiKey).toBe('test-api-key')
      expect(result.current.token).toBe('test-token')
    })

    test('handles missing API credentials', async () => {
      vi.mocked(loadApiKeys).mockResolvedValue({
        trello: null,
        trelloToken: null
      })

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.apiKey).toBeNull()
      expect(result.current.token).toBeNull()
      expect(fetchBoardCards).not.toHaveBeenCalled()
      expect(fetchBoardLists).not.toHaveBeenCalled()
    })

    test('handles fetch errors gracefully', async () => {
      vi.mocked(fetchBoardCards).mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.grouped).toEqual({})
    })
  })

  describe('flattened cards list', () => {
    test('provides flat list of all cards for search', async () => {
      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.allCards).toHaveLength(3)
      expect(result.current.allCards).toEqual(mockCards)
    })

    test('returns empty array when no cards loaded', async () => {
      vi.mocked(fetchBoardCards).mockResolvedValue([])

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.allCards).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('handles empty board (no cards)', async () => {
      vi.mocked(fetchBoardCards).mockResolvedValue([])
      vi.mocked(fetchBoardLists).mockResolvedValue(mockLists)

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.allCards).toEqual([])
      expect(result.current.grouped).toEqual({})
    })

    test('handles empty lists', async () => {
      vi.mocked(fetchBoardCards).mockResolvedValue(mockCards)
      vi.mocked(fetchBoardLists).mockResolvedValue([])

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.grouped).toEqual({})
    })

    test('handles cards with missing list association', async () => {
      const cardsWithOrphan = [
        ...mockCards,
        { id: 'orphan', name: 'Orphan Card', desc: '', idList: 'nonexistent' }
      ]
      vi.mocked(fetchBoardCards).mockResolvedValue(cardsWithOrphan)

      const { result } = renderHook(() => useTrelloBoard('board123'), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Orphan card should not appear in grouped results
      expect(result.current.allCards).toHaveLength(4)
      expect(Object.values(result.current.grouped).flat()).toHaveLength(3)
    })

    test('updates when board ID changes', async () => {
      const { result, rerender } = renderHook<
        { boardId: string },
        ReturnType<typeof useTrelloBoard>
      >(({ boardId }) => useTrelloBoard(boardId), {
        wrapper: createWrapper(),
        initialProps: { boardId: 'board1' }
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(fetchBoardCards).toHaveBeenCalledWith(
        'board1',
        'test-api-key',
        'test-token'
      )

      // Change board ID
      vi.clearAllMocks()
      rerender({ boardId: 'board2' })

      await waitFor(() => {
        expect(fetchBoardCards).toHaveBeenCalledWith(
          'board2',
          'test-api-key',
          'test-token'
        )
      })
    })
  })
})
