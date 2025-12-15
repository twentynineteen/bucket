/**
 * useTrelloCardSelection - Card selection and details management
 * Handles card selection state, fetching details, and validation
 */

import {
  useCardDetailsSync,
  useCardValidation
} from '@pages/UploadTrello/UploadTrelloHooks'
import type { SelectedCard } from '@pages/UploadTrello/UploadTrelloTypes'
import { useState } from 'react'

import { useTrelloCardDetails } from './useTrelloCardDetails'

/**
 * Hook to manage Trello card selection and details
 * @param apiKey - Trello API key
 * @param token - Trello auth token
 * @returns Card selection state and details
 */
export function useTrelloCardSelection(apiKey: string | null, token: string | null) {
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null)

  // Fetch card details and members
  const {
    card: selectedCardDetails,
    members,
    isLoading: isCardLoading,
    refetchCard,
    refetchMembers
  } = useTrelloCardDetails(selectedCard?.id ?? null, apiKey, token)

  // Auto-sync card details when selection changes
  useCardDetailsSync(selectedCard, apiKey, token, refetchCard, refetchMembers)

  // Validate card exists and reset if not found
  useCardValidation(selectedCard, selectedCardDetails, isCardLoading, () =>
    setSelectedCard(null)
  )

  return {
    selectedCard,
    setSelectedCard,
    selectedCardDetails,
    members,
    isCardLoading,
    refetchCard,
    refetchMembers
  }
}
