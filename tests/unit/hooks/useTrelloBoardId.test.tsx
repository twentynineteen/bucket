/**
 * Tests for Trello board ID configuration hook
 * DEBT-014: Hook integration for configurable board ID
 *
 * TDD Phase: RED (Writing failing tests first)
 */

import { useTrelloBoardId } from '@/hooks/useTrelloBoardId'
import { queryKeys } from '@/lib/query-keys'
import { appStore } from '@/store/useAppStore'
import * as storage from '@/utils/storage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock storage
vi.mock('@/utils/storage', () => ({
  loadApiKeys: vi.fn(),
  saveApiKeys: vi.fn()
}))

// Mock app store
vi.mock('@/store/useAppStore', () => ({
  appStore: {
    getState: vi.fn(() => ({
      trelloBoardId: '',
      setTrelloBoardId: vi.fn()
    }))
  },
  useAppStore: vi.fn(selector => {
    const mockState = {
      trelloBoardId: '',
      setTrelloBoardId: vi.fn()
    }
    return selector ? selector(mockState) : mockState
  })
}))

describe('useTrelloBoardId hook (DEBT-014)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
    vi.mocked(storage.loadApiKeys).mockResolvedValue({})
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('Hook Creation', () => {
    it('should exist and be callable', () => {
      expect(useTrelloBoardId).toBeDefined()
      expect(typeof useTrelloBoardId).toBe('function')
    })

    it('should return board ID and setter', () => {
      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      expect(result.current).toHaveProperty('boardId')
      expect(result.current).toHaveProperty('setBoardId')
    })

    it('should return loading state', () => {
      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      expect(result.current).toHaveProperty('isLoading')
      expect(typeof result.current.isLoading).toBe('boolean')
    })
  })

  describe('Default Board ID', () => {
    const DEFAULT_BOARD_ID = '55a504d70bed2bd21008dc5a'

    it('should return default board ID when none is configured', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({})

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(DEFAULT_BOARD_ID)
      })
    })

    it('should return default board ID when stored value is empty', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: ''
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(DEFAULT_BOARD_ID)
      })
    })

    it('should return default board ID when stored value is undefined', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: undefined
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(DEFAULT_BOARD_ID)
      })
    })
  })

  describe('Loading Configured Board ID', () => {
    it('should load board ID from storage', async () => {
      const customBoardId = 'custom-board-123'
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: customBoardId
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(customBoardId)
      })
    })

    it('should prioritize storage over default', async () => {
      // This test verifies that storage is checked and used if available
      const storedBoardId = 'stored-board-456'
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: storedBoardId
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(storedBoardId)
      })
    })

    it('should show loading state while fetching', () => {
      vi.mocked(storage.loadApiKeys).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      )

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('should clear loading state after fetching', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: 'test-board'
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Setting Board ID', () => {
    it('should update board ID when setBoardId is called', async () => {
      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newBoardId = 'new-board-789'
      result.current.setBoardId(newBoardId)

      await waitFor(() => {
        expect(result.current.boardId).toBe(newBoardId)
      })
    })

    it('should persist board ID to storage when set', async () => {
      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newBoardId = 'persistent-board'
      result.current.setBoardId(newBoardId)

      await waitFor(() => {
        expect(storage.saveApiKeys).toHaveBeenCalledWith(
          expect.objectContaining({
            trelloBoardId: newBoardId
          })
        )
      })
    })

    it('should persist board ID when set', async () => {
      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await result.current.setBoardId('persisted-board')

      await waitFor(() => {
        // Should save to storage
        expect(storage.saveApiKeys).toHaveBeenCalledWith(
          expect.objectContaining({
            trelloBoardId: 'persisted-board'
          })
        )
      })
    })

    it('should allow clearing board ID (revert to default)', async () => {
      const DEFAULT_BOARD_ID = '55a504d70bed2bd21008dc5a'
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: 'custom-board'
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe('custom-board')
      })

      result.current.setBoardId('')

      await waitFor(() => {
        expect(result.current.boardId).toBe(DEFAULT_BOARD_ID)
      })
    })
  })

  describe('Integration with useTrelloBoard', () => {
    it('should provide boardId that can be passed to useTrelloBoard', async () => {
      const customBoardId = 'integration-board-123'
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: customBoardId
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(customBoardId)
      })

      // The boardId should be a string that can be passed to useTrelloBoard
      expect(typeof result.current.boardId).toBe('string')
      expect(result.current.boardId.length).toBeGreaterThan(0)
    })

    it('should always return a valid board ID (never null or undefined)', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({})

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBeDefined()
        expect(result.current.boardId).not.toBeNull()
        expect(result.current.boardId).not.toBe('')
      })
    })
  })

  describe('Error Handling', () => {
    it('should return default board ID on storage load error', async () => {
      const DEFAULT_BOARD_ID = '55a504d70bed2bd21008dc5a'
      vi.mocked(storage.loadApiKeys).mockRejectedValue(new Error('Load failed'))

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe(DEFAULT_BOARD_ID)
      })
    })

    it('should handle save errors gracefully', async () => {
      vi.mocked(storage.saveApiKeys).mockRejectedValue(new Error('Save failed'))

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should throw when save fails (mutations propagate errors)
      await expect(result.current.setBoardId('error-board')).rejects.toThrow(
        'Save failed'
      )
    })
  })

  describe('Reactivity', () => {
    it('should react to external changes via refetch', async () => {
      // This test verifies reactivity by updating the mocked storage
      // and invalidating the query cache
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: 'initial-board'
      })

      const { result } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(result.current.boardId).toBe('initial-board')
        expect(result.current.isLoading).toBe(false)
      })

      // Simulate external change by updating storage mock
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: 'updated-board'
      })

      // Invalidate the query to trigger refetch
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys() })

      // Wait for query to refetch and update
      await waitFor(
        () => {
          expect(result.current.boardId).toBe('updated-board')
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Performance', () => {
    it('should not re-fetch on every render', async () => {
      vi.mocked(storage.loadApiKeys).mockResolvedValue({
        trelloBoardId: 'cached-board'
      })

      const { rerender } = renderHook(() => useTrelloBoardId(), { wrapper })

      await waitFor(() => {
        expect(storage.loadApiKeys).toHaveBeenCalledTimes(1)
      })

      rerender()
      rerender()
      rerender()

      // Should still be called only once due to React Query caching
      expect(storage.loadApiKeys).toHaveBeenCalledTimes(1)
    })
  })
})
