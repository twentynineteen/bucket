/**
 * useTrelloActions - External actions for Trello integration
 * Handles opening cards in browser and dialog management
 */

import { useCallback } from 'react'
import { openExternalUrl } from '../api'
import type { SelectedCard } from '../types'

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
