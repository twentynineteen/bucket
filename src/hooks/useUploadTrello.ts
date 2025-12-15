/**
 * useUploadTrello - Custom hook for UploadTrello page state and actions
 * Extracted from UploadTrello.tsx (DEBT-002)
 */

import {
  useCardDetailsSync,
  useCardValidation
} from '@pages/UploadTrello/UploadTrelloHooks'
import {
  createDefaultSproutUploadResponse,
  SelectedCard
} from '@pages/UploadTrello/UploadTrelloTypes'
import { appStore } from '@store/useAppStore'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-shell'
import { TrelloCard } from '@utils/TrelloCards'
import { SproutUploadResponse } from '@utils/types'
import { useMemo, useState } from 'react'

import {
  useAppendBreadcrumbs,
  useAppendVideoInfo,
  useFuzzySearch,
  useParsedTrelloDescription,
  useTrelloBoard,
  useTrelloBoardId,
  useTrelloCardDetails,
  useVideoInfoBlock
} from '@/hooks'
import { useTrelloBoards } from '@/hooks/useTrelloBoards'
import { logger } from '@/utils/logger'

export function useUploadTrello() {
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null)

  // DEBT-014: Use configurable board ID
  const { boardId } = useTrelloBoardId()
  const { grouped, isLoading: isBoardLoading, apiKey, token } = useTrelloBoard(boardId)

  // Fetch all boards to get the selected board's name
  const { boards } = useTrelloBoards()
  const selectedBoard = boards.find((board) => board.id === boardId)
  const boardName = selectedBoard?.name || 'Small Projects'

  // Flatten all cards for search
  const allCards = useMemo(() => {
    const cards: TrelloCard[] = []
    Object.values(grouped).forEach((cardList) => {
      cards.push(...cardList)
    })
    return cards
  }, [grouped])

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
  const filteredGrouped = useMemo(() => {
    if (!searchTerm.trim()) {
      return grouped
    }

    const result: Record<string, TrelloCard[]> = {}
    filteredCards.forEach((card) => {
      Object.entries(grouped).forEach(([listName, cards]) => {
        if (cards.some((c) => c.id === card.id)) {
          if (!result[listName]) {
            result[listName] = []
          }
          result[listName].push(card)
        }
      })
    })
    return result
  }, [searchTerm, filteredCards, grouped])

  const {
    card: selectedCardDetails,
    members,
    isLoading: isCardLoading,
    refetchCard,
    refetchMembers
  } = useTrelloCardDetails(selectedCard?.id ?? null, apiKey, token)

  useCardDetailsSync(selectedCard, apiKey, token, refetchCard, refetchMembers)

  useCardValidation(selectedCard, selectedCardDetails, isCardLoading, () =>
    setSelectedCard(null)
  )

  const { getBreadcrumbsBlock, applyBreadcrumbsToCard } = useAppendBreadcrumbs(
    apiKey,
    token
  )
  const { applyVideoInfoToCard } = useAppendVideoInfo(apiKey, token)

  // Get uploaded video from app state
  const state = appStore.getState()
  let uploadedVideo: SproutUploadResponse | null = null

  if (state?.latestSproutUpload) {
    uploadedVideo = {
      ...createDefaultSproutUploadResponse(),
      ...state.latestSproutUpload
    }
  }

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

      // Save the updated breadcrumbs to the local file if we have the path info
      if (
        currentBreadcrumbs &&
        currentBreadcrumbs.parentFolder &&
        currentBreadcrumbs.projectTitle
      ) {
        const breadcrumbsPath = `${currentBreadcrumbs.parentFolder}/${currentBreadcrumbs.projectTitle}/breadcrumbs.json`
        try {
          await writeTextFile(
            breadcrumbsPath,
            JSON.stringify(updatedBreadcrumbs, null, 2)
          )
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          alert('Failed to save breadcrumbs: ' + errorMessage)
          logger.error('Failed to write breadcrumbs file:', error)
        }
      }

      // Refresh card details to show updated breadcrumbs
      refetchCard()
    }
  }

  const handleAppendVideoInfo = async () => {
    if (selectedCardDetails && uploadedVideo) {
      await applyVideoInfoToCard(selectedCardDetails, uploadedVideo)
      // Refresh card details to show updated video info
      refetchCard()
    }
  }

  const handleOpenInTrello = async () => {
    if (selectedCard) {
      const url = new URL(`https://trello.com/c/${selectedCard.id}`)
      await open(url.toString())
    }
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
