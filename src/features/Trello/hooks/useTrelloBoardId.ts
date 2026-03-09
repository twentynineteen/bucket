/**
 * useTrelloBoardId - Hook for managing configurable Trello board ID
 * DEBT-014: Make Trello board ID configurable in Settings
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CACHE } from '@shared/constants/timing'
import { queryKeys } from '@shared/lib/query-keys'
import { useAppStore } from '@shared/store'
import { TrelloBoard } from '@shared/types/media'
import { loadApiKeys, saveApiKeys } from '@shared/utils/storage'
import { validateBoardAccess } from '../internal/trelloBoardValidation'

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
    if (storeBoardId && storeBoardId.trim()) {
      return storeBoardId
    }

    if (apiKeys?.trelloBoardId && apiKeys.trelloBoardId.trim()) {
      return apiKeys.trelloBoardId
    }

    return DEFAULT_BOARD_ID
  })()

  // Setter function
  const setBoardId = async (newBoardId: string) => {
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
