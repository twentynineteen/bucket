/**
 * useUploadTrello - Custom hook for UploadTrello page state and actions
 * Extracted from UploadTrello.tsx (DEBT-002)
 */

import { useAppendBreadcrumbs } from '@features/Baker'
import { useFuzzySearch } from '@shared/hooks'
import { queryKeys } from '@shared/lib'
import { appStore } from '@shared/store'
import type { Breadcrumb, SproutUploadResponse } from '@shared/types'
import { logger } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { openExternalUrl, writeBreadcrumbsFile } from '../api'
import {
  createDefaultSproutUploadResponse,
  type SelectedCard,
  type TrelloCard
} from '../types'
import { useAppendVideoInfo } from './useAppendVideoInfo'
import { useParsedTrelloDescription } from './useParsedTrelloDescription'
import { useTrelloBoard } from './useTrelloBoard'
import { useTrelloBoardId } from './useTrelloBoardId'
import { useTrelloBoards } from './useTrelloBoards'
import { useTrelloCardDetails } from './useTrelloCardDetails'
import { useVideoInfoBlock } from './useVideoInfoBlock'

/** Re-group filtered cards back into their original list buckets. */
function regroupFilteredCards(
  filteredCards: TrelloCard[],
  grouped: Record<string, TrelloCard[]>
): Record<string, TrelloCard[]> {
  const result: Record<string, TrelloCard[]> = {}
  for (const card of filteredCards) {
    for (const [listName, cards] of Object.entries(grouped)) {
      if (cards.some(c => c.id === card.id)) {
        if (!result[listName]) {
          result[listName] = []
        }
        result[listName].push(card)
      }
    }
  }
  return result
}

/** Persist updated breadcrumbs to disk when the project path is known. */
async function saveBreadcrumbsToFile(
  currentBreadcrumbs: Breadcrumb | null,
  updatedBreadcrumbs: Record<string, unknown>
): Promise<void> {
  if (
    !currentBreadcrumbs ||
    !currentBreadcrumbs.parentFolder ||
    !currentBreadcrumbs.projectTitle
  ) {
    return
  }
  const breadcrumbsPath = `${currentBreadcrumbs.parentFolder}/${currentBreadcrumbs.projectTitle}/breadcrumbs.json`
  try {
    await writeBreadcrumbsFile(
      breadcrumbsPath,
      JSON.stringify(updatedBreadcrumbs, null, 2)
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    toast.error('Failed to save breadcrumbs: ' + errorMessage)
    logger.error('Failed to write breadcrumbs file:', error)
  }
}

const DEFAULT_BOARD_NAME = 'Small Projects'

/** Read the most recent Sprout upload from the global store. */
function getUploadedVideo(): SproutUploadResponse | null {
  const latestUpload = appStore.getState()?.latestSproutUpload
  return latestUpload ? { ...createDefaultSproutUploadResponse(), ...latestUpload } : null
}

export function useUploadTrello() {
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null)

  // DEBT-014: Use configurable board ID
  const { boardId } = useTrelloBoardId()
  const { grouped, isLoading: isBoardLoading, apiKey, token } = useTrelloBoard(boardId)

  // Fetch all boards to get the selected board's name
  const { boards } = useTrelloBoards()
  const selectedBoard = boards.find(board => board.id === boardId)
  const boardName = selectedBoard?.name ?? DEFAULT_BOARD_NAME

  // Flatten all cards for search
  const allCards = useMemo(() => Object.values(grouped).flat(), [grouped])

  // Use fuzzy search hook
  const {
    searchTerm,
    setSearchTerm,
    results: filteredCards
  } = useFuzzySearch(allCards, {
    keys: ['name', 'desc'],
    threshold: 0.4
  })

  // Re-group filtered cards by list
  const filteredGrouped = useMemo(
    () => (searchTerm.trim() ? regroupFilteredCards(filteredCards, grouped) : grouped),
    [searchTerm, filteredCards, grouped]
  )

  const {
    card: selectedCardDetails,
    members,
    isLoading: isCardLoading,
    refetchCard,
    refetchMembers
  } = useTrelloCardDetails(selectedCard?.id ?? null, apiKey, token)

  const hasCardCredentials = !!(selectedCard && apiKey && token)

  // Auto-sync card details when selection changes
  useQuery({
    queryKey: queryKeys.trello.cardDetailsSync(selectedCard?.id, apiKey, token),
    queryFn: async () => {
      if (hasCardCredentials) {
        refetchCard()
        refetchMembers()
      }
      return null
    },
    enabled: hasCardCredentials
  })

  const cardNotFound = !!(selectedCard && !selectedCardDetails && !isCardLoading)

  // Validate card exists and reset if not found
  useQuery({
    queryKey: ['cardValidation', selectedCard?.id, selectedCardDetails, isCardLoading],
    queryFn: async () => {
      if (cardNotFound) {
        setSelectedCard(null)
      }
      return null
    },
    enabled: cardNotFound
  })

  const { getBreadcrumbsBlock, applyBreadcrumbsToCard } = useAppendBreadcrumbs(
    apiKey,
    token
  )
  const { applyVideoInfoToCard } = useAppendVideoInfo(apiKey, token)

  const uploadedVideo = getUploadedVideo()

  // Parse card description
  const rawDescription = selectedCardDetails?.desc ?? ''
  const { videoInfoData, videoInfoBlock } = useVideoInfoBlock(rawDescription)
  const { mainDescription, breadcrumbsData, breadcrumbsBlock } =
    useParsedTrelloDescription(rawDescription)

  // Action handlers
  const handleAppendBreadcrumbs = async () => {
    if (!selectedCardDetails) return

    // First, add the Trello card URL to the breadcrumbs data
    const currentBreadcrumbs = appStore.getState().breadcrumbs
    const trelloCardUrl = `https://trello.com/c/${selectedCardDetails.id}`
    const updatedBreadcrumbs = {
      ...currentBreadcrumbs,
      trelloCardUrl
    }

    // Temporarily update the in-app store so getBreadcrumbsBlock includes the URL
    appStore.getState().setBreadcrumbs(updatedBreadcrumbs)

    const block = await getBreadcrumbsBlock(selectedCardDetails)
    if (block && selectedCardDetails) {
      await applyBreadcrumbsToCard(selectedCardDetails, block)
      await saveBreadcrumbsToFile(currentBreadcrumbs, updatedBreadcrumbs)
      refetchCard()
    }
  }

  const handleAppendVideoInfo = async () => {
    if (!selectedCardDetails || !uploadedVideo) return
    await applyVideoInfoToCard(selectedCardDetails, uploadedVideo)
    refetchCard()
  }

  const handleOpenInTrello = async () => {
    if (!selectedCard) return
    const url = new URL(`https://trello.com/c/${selectedCard.id}`)
    await openExternalUrl(url.toString())
  }

  const handleCloseDialog = () => {
    setSelectedCard(null)
  }

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
    boardName,
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
