/**
 * useTrelloCardsManager Hook
 * Purpose: Manages state and handlers for TrelloCardsManager component
 * Extracted to reduce component complexity (DEBT-002)
 */

import { extractTrelloCardId, validateTrelloCard, logger } from '@shared/utils'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { TrelloCard } from '@features/Baker'

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
    addTrelloCardAsync,
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

  // Sync the breadcrumbs block to ALL linked Trello cards.
  //
  // Reads the freshly persisted breadcrumbs file (source of truth for the full
  // trelloCards + videoLinks set) and updates every linked card, not just the
  // one most recently added. Each card's current description is fetched first so
  // existing content is preserved and the breadcrumbs block is replaced in place.
  const syncAllCardsToTrello = async () => {
    if (!autoSyncToTrello || !trelloApiKey || !trelloApiToken) {
      return
    }

    const apiKey = trelloApiKey
    const token = trelloApiToken

    try {
      setIsSyncingToTrello(true)

      const breadcrumbsPath = `${projectPath}/breadcrumbs.json`
      const breadcrumbsContent = await readBreadcrumbsFile(breadcrumbsPath)
      const breadcrumbsData = JSON.parse(breadcrumbsContent)

      const cards = (breadcrumbsData.trelloCards ?? []) as Array<{
        cardId: string
        url: string
      }>
      if (cards.length === 0) {
        return
      }

      const { generateBreadcrumbsBlock, updateTrelloCardWithBreadcrumbs } = await import(
        '@features/Baker'
      )

      const block = generateBreadcrumbsBlock(breadcrumbsData)
      if (!block) {
        return
      }

      const results = await Promise.allSettled(
        cards.map(async (card) => {
          const apiCard = { id: card.cardId, name: '', desc: '', idList: '' }

          try {
            const currentCard = await fetchTrelloCardById(card.cardId, apiKey, token)
            apiCard.name = currentCard.name || ''
            apiCard.desc = currentCard.desc || ''
            apiCard.idList = currentCard.idList || ''
          } catch (err) {
            logger.warn(`Could not fetch Trello card ${card.cardId}, proceeding:`, err)
          }

          await updateTrelloCardWithBreadcrumbs(apiCard, block, apiKey, token, {
            autoReplace: true,
            silentErrors: false
          })
        })
      )

      const failed = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      )
      if (failed.length > 0) {
        logger.error(
          'Some Trello cards failed to sync:',
          failed.map((r) => r.reason)
        )
        toast.error(
          `${failed.length} of ${cards.length} Trello card(s) failed to update`
        )
      }
    } catch (err) {
      logger.error('Failed to sync breadcrumbs to Trello:', err)
      toast.error('Failed to sync breadcrumbs to Trello')
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

        // Await persistence before syncing so the breadcrumbs file we read
        // includes the just-added card (and any prior cards / video links).
        await addTrelloCardAsync(cardData)
        await syncAllCardsToTrello()
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

        // Await persistence before syncing so the breadcrumbs file we read
        // includes the just-added card (and any prior cards / video links).
        await addTrelloCardAsync(cardData)
        await syncAllCardsToTrello()
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

      // No API credentials: persist the card locally only. Trello sync requires
      // credentials, so there is nothing to push to Trello here.
      addTrelloCard(newCard)
      setCardUrl('')
      setIsDialogOpen(false)
    }
  }

  // AlertDialog state for card removal confirmation
  const [pendingRemoveCardIndex, setPendingRemoveCardIndex] = useState<number | null>(
    null
  )

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
      toast.error(
        `Failed to refresh card: ${err instanceof Error ? err.message : String(err)}`
      )
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
