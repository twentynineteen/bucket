/**
 * useTrelloActions - External actions for Trello integration
 * Handles opening cards in browser and dialog management
 */

import type { SelectedCard } from '../types'
import { openExternalUrl } from '../api'
import { useCallback } from 'react'

export function useTrelloActions(
  selectedCard: SelectedCard | null,
  onClose?: () => void
) {
  const handleOpenInTrello = useCallback(async () => {
    if (!selectedCard) return

    const url = `https://trello.com/c/${selectedCard.id}`
    await openExternalUrl(url)
  }, [selectedCard])

  const handleCloseDialog = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])

  return {
    handleOpenInTrello,
    handleCloseDialog
  }
}
