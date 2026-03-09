/**
 * useTrelloCardsManager Hook
 * Purpose: Manages state and handlers for TrelloCardsManager component
 * Extracted to reduce component complexity (DEBT-002)
 */

import { extractTrelloCardId, validateTrelloCard } from '@shared/utils/validation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { TrelloCard } from '@features/Baker'
import { logger } from '@shared/utils/logger'

import { fetchTrelloCardById, readBreadcrumbsFile } from '../api'
import { useBreadcrumbsTrelloCards } from './useBreadcrumbsTrelloCards'
import { useFuzzySearch } from '@shared/hooks'
import { useTrelloBoard } from './useTrelloBoard'

interface UseTrelloCardsManagerProps {
  projectPath: string
  trelloApiKey?: string
  trelloApiToken?: string
  autoSyncToTrello?: boolean
}

/**
 * Validates if a card can be added (checks limit and duplicates)
 */
function validateCardCanBeAdded(
  trelloCards: TrelloCard[],
  cardId: string
): string | null {
  if (trelloCards.length >= 10) {
    return 'Maximum of 10 Trello cards per project reached'
  }
  if (trelloCards.some((card) => card.cardId === cardId)) {
    return 'This Trello card is already associated with the project'
  }
  return null
}

export function useTrelloCardsManager({
  projectPath,
  trelloApiKey,
  trelloApiToken,
  autoSyncToTrello = false
}: UseTrelloCardsManagerProps) {
  // Core data hook
  const {
    trelloCards,
    isLoading,
    error,
    addTrelloCard,
    removeTrelloCard,
    fetchCardDetailsAsync,
    isUpdating,
    isFetchingDetails,
    addError,
    fetchError
  } = useBreadcrumbsTrelloCards({ projectPath })

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cardUrl, setCardUrl] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isFetchingCard, setIsFetchingCard] = useState(false)
  const [addMode, setAddMode] = useState<'url' | 'select'>('url')
  const [isSyncingToTrello, setIsSyncingToTrello] = useState(false)

  // Fetch Trello board cards if API credentials are available
  const boardId = '55a504d70bed2bd21008dc5a' // Small projects board
  const { grouped, isLoading: isBoardLoading } = useTrelloBoard(
    trelloApiKey && trelloApiToken ? boardId : null
  )

  // Flatten all cards for search
  const allCards = useMemo(() => {
    const cards: Array<{ id: string; name: string; desc?: string }> = []
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
    threshold: 0.3
  })

  // Re-group filtered cards by list
  const filteredGrouped = useMemo(() => {
    if (!searchTerm.trim()) {
      return grouped
    }

    const result: Record<string, Array<{ id: string; name: string; desc?: string }>> = {}
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

  // Helper function to sync breadcrumbs to Trello card description
  const syncBreadcrumbsToTrello = async (cardData: TrelloCard) => {
    if (!autoSyncToTrello || !trelloApiKey || !trelloApiToken) {
      return
    }

    try {
      setIsSyncingToTrello(true)

      const breadcrumbsPath = `${projectPath}/breadcrumbs.json`
      const breadcrumbsContent = await readBreadcrumbsFile(breadcrumbsPath)
      const breadcrumbsData = JSON.parse(breadcrumbsContent)

      const { generateBreadcrumbsBlock, updateTrelloCardWithBreadcrumbs } = await import(
        '@features/Baker'
      )

      const apiCard = {
        id: cardData.cardId,
        name: cardData.title,
        desc: '',
        idList: ''
      }

      try {
        const currentCard = await fetchTrelloCardById(
          cardData.cardId,
          trelloApiKey,
          trelloApiToken
        )
        apiCard.desc = currentCard.desc || ''
        apiCard.idList = currentCard.idList || ''
      } catch {
        // Card fetch failed, proceed with empty desc
      }

      const block = generateBreadcrumbsBlock(breadcrumbsData)
      await updateTrelloCardWithBreadcrumbs(
        apiCard,
        block,
        trelloApiKey,
        trelloApiToken,
        { autoReplace: true, silentErrors: false }
      )
    } catch (err) {
      logger.error('Failed to sync breadcrumbs to Trello:', err)
    } finally {
      setIsSyncingToTrello(false)
    }
  }

  // Handler: Select card from board
  const handleSelectCard = async (selectedCard: { id: string; name: string }) => {
    const validationError = validateCardCanBeAdded(trelloCards, selectedCard.id)
    if (validationError) {
      setValidationErrors([validationError])
      return
    }

    setValidationErrors([])
    const url = `https://trello.com/c/${selectedCard.id}`

    if (trelloApiKey && trelloApiToken) {
      try {
        setIsFetchingCard(true)
        const cardData = await fetchCardDetailsAsync({
          cardUrl: url,
          apiKey: trelloApiKey,
          apiToken: trelloApiToken
        })

        addTrelloCard(cardData)
        await syncBreadcrumbsToTrello(cardData)
        setIsDialogOpen(false)
      } catch (err) {
        setValidationErrors([
          err instanceof Error ? err.message : 'Failed to fetch card details'
        ])
      } finally {
        setIsFetchingCard(false)
      }
    }
  }

  // Handler: Add card via URL
  const handleFetchAndAdd = async () => {
    const url = cardUrl.trim()
    const cardId = extractTrelloCardId(url)

    if (!cardId) {
      setValidationErrors(['Invalid Trello card URL format'])
      return
    }

    const validationError = validateCardCanBeAdded(trelloCards, cardId)
    if (validationError) {
      setValidationErrors([validationError])
      return
    }

    setValidationErrors([])

    if (trelloApiKey && trelloApiToken) {
      try {
        setIsFetchingCard(true)
        const cardData = await fetchCardDetailsAsync({
          cardUrl: url,
          apiKey: trelloApiKey,
          apiToken: trelloApiToken
        })

        const errors = validateTrelloCard(cardData)
        if (errors.length > 0) {
          setValidationErrors(errors)
          return
        }

        addTrelloCard(cardData)
        await syncBreadcrumbsToTrello(cardData)
        setCardUrl('')
        setIsDialogOpen(false)
      } catch (err) {
        setValidationErrors([
          err instanceof Error ? err.message : 'Failed to fetch card details'
        ])
      } finally {
        setIsFetchingCard(false)
      }
    } else {
      const newCard: TrelloCard = {
        url,
        cardId,
        title: `Trello Card ${cardId}`
      }

      const errors = validateTrelloCard(newCard)
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }

      addTrelloCard(newCard)
      syncBreadcrumbsToTrello(newCard)
      setCardUrl('')
      setIsDialogOpen(false)
    }
  }

  // AlertDialog state for card removal confirmation
  const [pendingRemoveCardIndex, setPendingRemoveCardIndex] = useState<number | null>(null)

  // Handler: Request card removal (opens AlertDialog)
  const requestRemoveCard = (index: number) => {
    setPendingRemoveCardIndex(index)
  }

  // Handler: Confirm card removal
  const confirmRemoveCard = () => {
    if (pendingRemoveCardIndex !== null) {
      removeTrelloCard(pendingRemoveCardIndex)
      setPendingRemoveCardIndex(null)
    }
  }

  // Handler: Cancel card removal
  const cancelRemoveCard = () => {
    setPendingRemoveCardIndex(null)
  }

  // Handler: Refresh card details
  const handleRefresh = async (index: number) => {
    if (!trelloApiKey || !trelloApiToken) {
      toast.error('Trello API credentials not configured')
      return
    }

    const card = trelloCards[index]
    try {
      const updatedCard = await fetchCardDetailsAsync({
        cardUrl: card.url,
        apiKey: trelloApiKey,
        apiToken: trelloApiToken
      })

      removeTrelloCard(index)
      setTimeout(() => {
        addTrelloCard(updatedCard)
      }, 100)
    } catch (err) {
      toast.error(`Failed to refresh card: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Handler: Close dialog and reset
  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setCardUrl('')
    setValidationErrors([])
  }

  return {
    // Data
    trelloCards,
    isLoading,
    error,
    addError,
    fetchError,
    validationErrors,

    // UI state
    isDialogOpen,
    setIsDialogOpen,
    cardUrl,
    setCardUrl,
    addMode,
    setAddMode,
    searchTerm,
    setSearchTerm,
    filteredGrouped,

    // Loading states
    isUpdating,
    isFetchingDetails,
    isFetchingCard,
    isBoardLoading,
    isSyncingToTrello,

    // Computed
    hasApiCredentials: !!(trelloApiKey && trelloApiToken),
    canAddCard: trelloCards.length < 10 && !isUpdating,

    // Handlers
    handleSelectCard,
    handleFetchAndAdd,
    handleRefresh,
    handleCloseDialog,

    // AlertDialog state for card removal
    pendingRemoveCardIndex,
    requestRemoveCard,
    confirmRemoveCard,
    cancelRemoveCard
  }
}
