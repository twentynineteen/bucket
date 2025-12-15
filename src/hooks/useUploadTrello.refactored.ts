/**
 * useUploadTrello - Refactored orchestrator hook
 * Composes all sub-hooks for Trello upload workflow
 *
 * This is the new refactored version. Once tested, replace the original.
 */

import { useTrelloActions } from './useTrelloActions'
import { useTrelloBoard } from './useTrelloBoard'
import { useTrelloBoardId } from './useTrelloBoardId'
import { useTrelloBoardSearch } from './useTrelloBoardSearch'
import { useTrelloBreadcrumbs } from './useTrelloBreadcrumbs'
import { useTrelloCardSelection } from './useTrelloCardSelection'
import { useTrelloVideoInfo } from './useTrelloVideoInfo'

/**
 * Main hook for UploadTrello page
 * Orchestrates all Trello-related operations
 * DEBT-014: Now uses configurable board ID from settings
 */
export function useUploadTrello() {
  // 1. Get configurable board ID (DEBT-014 resolved)
  const { boardId } = useTrelloBoardId()

  // 2. Fetch board data
  const {
    grouped,
    allCards,
    isLoading: isBoardLoading,
    apiKey,
    token
  } = useTrelloBoard(boardId)

  // 2. Search and filter cards
  const { searchTerm, setSearchTerm, filteredGrouped } = useTrelloBoardSearch(
    allCards,
    grouped
  )

  // 3. Card selection and details
  const {
    selectedCard,
    setSelectedCard,
    selectedCardDetails,
    members,
    isCardLoading,
    refetchCard
  } = useTrelloCardSelection(apiKey, token)

  // 4. Video info operations
  const { uploadedVideo, videoInfoData, videoInfoBlock, handleAppendVideoInfo } =
    useTrelloVideoInfo(apiKey, token, selectedCardDetails, refetchCard)

  // 5. Breadcrumbs operations
  const { mainDescription, breadcrumbsData, breadcrumbsBlock, handleAppendBreadcrumbs } =
    useTrelloBreadcrumbs(apiKey, token, selectedCardDetails, refetchCard)

  // 6. External actions (open in Trello, close dialog)
  const { handleOpenInTrello, handleCloseDialog } = useTrelloActions(selectedCard, () =>
    setSelectedCard(null)
  )

  // Return unified interface (same as original for backward compatibility)
  return {
    // State
    selectedCard,
    setSelectedCard,
    searchTerm,
    setSearchTerm,
    filteredGrouped,
    isBoardLoading,
    isCardLoading,
    selectedCardDetails,
    members,
    uploadedVideo,
    // Parsed description data
    mainDescription,
    breadcrumbsData,
    breadcrumbsBlock,
    videoInfoData,
    videoInfoBlock,
    // Actions
    handleAppendBreadcrumbs,
    handleAppendVideoInfo,
    handleOpenInTrello,
    handleCloseDialog
  }
}
