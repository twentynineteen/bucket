/**
 * useTrelloBoardId - Hook for managing configurable Trello board ID
 * DEBT-014: Make Trello board ID configurable in Settings
 *
 * This hook provides access to the configured Trello board ID with fallback to default.
 * It loads the board ID from storage/app store and provides a setter to update it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CACHE } from '@/constants/timing'
import { queryKeys } from '@/lib/query-keys'
import { useAppStore } from '@/store/useAppStore'
import { TrelloBoard } from '@/types/media'
import { loadApiKeys, saveApiKeys } from '@/utils/storage'
import { validateBoardAccess } from '@/utils/trelloBoardValidation'

// Default board ID (original hardcoded value)
const DEFAULT_BOARD_ID = '55a504d70bed2bd21008dc5a'

interface UseTrelloBoardIdReturn {
  boardId: string
  setBoardId: (newBoardId: string) => Promise<void>
  isLoading: boolean
  /** Validates if the stored board ID is accessible */
  validateStoredBoardId: (availableBoards: TrelloBoard[]) => boolean
}

/**
 * Hook for managing Trello board ID configuration
 * Returns the configured board ID or falls back to default
 */
export function useTrelloBoardId(): UseTrelloBoardIdReturn {
  const queryClient = useQueryClient()
  const storeBoardId = useAppStore((state) => state.trelloBoardId)
  const setStoreBoardId = useAppStore((state) => state.setTrelloBoardId)

  // Load board ID from storage
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: queryKeys.settings.apiKeys(),
    queryFn: loadApiKeys,
    staleTime: CACHE.STANDARD, // 5 minutes
    gcTime: CACHE.GC_MEDIUM // 10 minutes
  })

  // Mutation for saving board ID
  const saveBoardIdMutation = useMutation({
    mutationFn: async (newBoardId: string) => {
      // Update app store first
      setStoreBoardId(newBoardId)

      // Persist to storage
      const updatedKeys = {
        ...apiKeys,
        trelloBoardId: newBoardId
      }
      await saveApiKeys(updatedKeys)

      return updatedKeys
    },
    onSuccess: (updatedKeys) => {
      // Update query cache
      queryClient.setQueryData(queryKeys.settings.apiKeys(), updatedKeys)
    }
  })

  // Determine effective board ID (priority: store > api keys > default)
  const effectiveBoardId = (() => {
    // If store has a value, use it
    if (storeBoardId && storeBoardId.trim()) {
      return storeBoardId
    }

    // If API keys have a value, use it
    if (apiKeys?.trelloBoardId && apiKeys.trelloBoardId.trim()) {
      return apiKeys.trelloBoardId
    }

    // Fall back to default
    return DEFAULT_BOARD_ID
  })()

  // Setter function
  const setBoardId = async (newBoardId: string) => {
    // Empty string should revert to default
    const valueToSave = newBoardId.trim() || ''
    await saveBoardIdMutation.mutateAsync(valueToSave)
  }

  // Validation function
  const validateStoredBoardId = (availableBoards: TrelloBoard[]): boolean => {
    return validateBoardAccess(effectiveBoardId, availableBoards)
  }

  return {
    boardId: effectiveBoardId,
    setBoardId,
    isLoading,
    validateStoredBoardId
  }
}
