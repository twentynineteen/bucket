/**
 * useTrelloCardSelection - Card selection and details management
 * Handles card selection state, fetching details, and validation
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { SelectedCard, TrelloCard } from '../types'
import { useTrelloCardDetails } from './useTrelloCardDetails'

/**
 * Hook to manage Trello card selection and details
 * @param apiKey - Trello API key
 * @param token - Trello auth token
 * @returns Card selection state and details
 */
export function useTrelloCardSelection(
  apiKey: string | null,
  token: string | null
) {
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
  useQuery({
    queryKey: [
      'cardDetailsSync',
      selectedCard?.id,
      apiKey,
      token
    ],
    queryFn: async () => {
      if (selectedCard && selectedCard.id && apiKey && token) {
        refetchCard()
        refetchMembers()
      }
      return null
    },
    enabled: !!(selectedCard && selectedCard.id && apiKey && token)
  })

  // Validate card exists and reset if not found
  useQuery({
    queryKey: [
      'cardValidation',
      selectedCard?.id,
      selectedCardDetails,
      isCardLoading
    ],
    queryFn: async () => {
      if (
        selectedCard &&
        !selectedCardDetails &&
        !isCardLoading
      ) {
        setSelectedCard(null)
      }
      return null
    },
    enabled: !!(
      selectedCard &&
      !selectedCardDetails &&
      !isCardLoading
    )
  })

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
