/**
 * useTrelloBoardId - Hook for managing configurable Trello board ID
 * DEBT-014: Make Trello board ID configurable in Settings
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@shared/lib'
import { useAppStore } from '@shared/store'
import { TrelloBoard } from '@shared/types'
import { useApiKeys } from '@shared/hooks'
import { saveApiKeys } from '@shared/utils'
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
  // One definition of this query, in @shared/hooks (issue #155 P5-a).
  const { data: apiKeys, isLoading } = useApiKeys()

  // Mutation for saving board ID
  const saveBoardIdMutation = useMutation({
    mutationFn: async (newBoardId: string) => {
      // The store is updated optimistically, before the write. Capture the
      // previous value so a failed write can be rolled back -- saveApiKeys now
      // rethrows, so without this the store would hold a board id that never
      // reached disk (issue #155 P5-b).
      const previousBoardId = storeBoardId
      setStoreBoardId(newBoardId)

      const updatedKeys = {
        ...apiKeys,
        trelloBoardId: newBoardId
      }

      try {
        await saveApiKeys(updatedKeys)
      } catch (error) {
        setStoreBoardId(previousBoardId)
        throw error
      }

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
