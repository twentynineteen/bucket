import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useTrelloCardDetails } from '@hooks/useTrelloCardDetails'
import type { ReactNode } from 'react'
import { createElement } from 'react'

// Mock fetch globally
global.fetch = vi.fn()

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useTrelloCardDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('batched API request (optimized)', () => {
    test('should make single API call with members included', async () => {
      const mockCard = {
        id: 'card123',
        name: 'Test Card',
        desc: 'Test Description',
        members: [
          { id: 'member1', fullName: 'John Doe', username: 'johndoe' },
          { id: 'member2', fullName: 'Jane Smith', username: 'janesmith' }
        ]
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard
      })

      const { result } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify only ONE API call was made (batched request)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Verify the call includes members parameter
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.trello.com/1/cards/card123?key=test-key&token=test-token&members=true'
      )

      // Verify both card and members data are returned
      expect(result.current.card).toEqual(mockCard)
      expect(result.current.members).toEqual(mockCard.members)
    })

    test('should handle card with no members', async () => {
      const mockCard = {
        id: 'card456',
        name: 'Solo Card',
        desc: 'No members',
        members: []
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard
      })

      const { result } = renderHook(
        () => useTrelloCardDetails('card456', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.card).toEqual(mockCard)
      expect(result.current.members).toEqual([])
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    test('should parse members from card response', async () => {
      const mockCard = {
        id: 'card789',
        name: 'Team Card',
        members: [
          { id: 'm1', fullName: 'Alice', username: 'alice' },
          { id: 'm2', fullName: 'Bob', username: 'bob' },
          { id: 'm3', fullName: 'Charlie', username: 'charlie' }
        ]
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard
      })

      const { result } = renderHook(
        () => useTrelloCardDetails('card789', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.members).toHaveLength(3)
      })

      expect(result.current.members).toEqual(mockCard.members)
    })
  })

  describe('error handling', () => {
    test('should handle API error gracefully', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const { result } = renderHook(
        () => useTrelloCardDetails('invalid', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.card).toBeUndefined()
      expect(result.current.members).toBeUndefined()
    })

    test('should handle network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const { result } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.card).toBeUndefined()
      expect(result.current.members).toBeUndefined()
    })
  })

  describe('query state management', () => {
    test('should not fetch when cardId is null', () => {
      renderHook(() => useTrelloCardDetails(null, 'test-key', 'test-token'), {
        wrapper: createWrapper()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should not fetch when apiKey is null', () => {
      renderHook(() => useTrelloCardDetails('card123', null, 'test-token'), {
        wrapper: createWrapper()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should not fetch when token is null', () => {
      renderHook(() => useTrelloCardDetails('card123', 'test-key', null), {
        wrapper: createWrapper()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should show loading state initially', () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.card).toBeUndefined()
      expect(result.current.members).toBeUndefined()
    })
  })

  describe('refetch functionality', () => {
    test('should provide refetch function', async () => {
      const mockCard = {
        id: 'card123',
        name: 'Test Card',
        members: []
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockCard
      })

      const { result } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear previous fetch calls
      vi.clearAllMocks()

      // Call refetch
      await result.current.refetch()

      // Should make another API call
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    test('refetch should update data', async () => {
      const mockCard1 = {
        id: 'card123',
        name: 'Original Name',
        members: []
      }

      const mockCard2 = {
        id: 'card123',
        name: 'Updated Name',
        members: [{ id: 'm1', fullName: 'New Member', username: 'newmember' }]
      }

      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCard1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCard2
        })

      const { result } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.card?.name).toBe('Original Name')
      })

      await result.current.refetch()

      await waitFor(() => {
        expect(result.current.card?.name).toBe('Updated Name')
      })

      expect(result.current.members).toHaveLength(1)
    })
  })

  describe('caching and performance', () => {
    test('should cache results with React Query', async () => {
      const mockCard = {
        id: 'card123',
        name: 'Test Card',
        members: []
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockCard
      })

      const { result, rerender } = renderHook(
        () => useTrelloCardDetails('card123', 'test-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const fetchCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls.length

      // Rerender should use cached data
      rerender()

      // Should still have data from cache
      expect(result.current.card).toBeDefined()
      expect(result.current.members).toEqual([])

      // Should not make another API call on rerender
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
        fetchCallCount
      )
    })
  })
})
