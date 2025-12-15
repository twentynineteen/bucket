import { useQuery } from '@tanstack/react-query'
import { TrelloCard } from '@utils/TrelloCards'

import { SelectedCard } from './UploadTrelloTypes'

export const useCardDetailsSync = (
  selectedCard: SelectedCard | null,
  apiKey: string | null,
  token: string | null,
  refetchCard: () => void,
  refetchMembers: () => void
) => {
  return useQuery({
    queryKey: ['cardDetailsSync', selectedCard?.id, apiKey, token],
    queryFn: async () => {
      if (selectedCard && selectedCard.id && apiKey && token) {
        refetchCard()
        refetchMembers()
      }
      return null
    },
    enabled: !!(selectedCard && selectedCard.id && apiKey && token)
  })
}

export const useCardValidation = (
  selectedCard: SelectedCard | null,
  selectedCardDetails: TrelloCard | undefined,
  isCardLoading: boolean,
  onCardReset: () => void
) => {
  return useQuery({
    queryKey: ['cardValidation', selectedCard?.id, selectedCardDetails, isCardLoading],
    queryFn: async () => {
      if (selectedCard && !selectedCardDetails && !isCardLoading) {
        onCardReset()
      }
      return null
    },
    enabled: !!(selectedCard && !selectedCardDetails && !isCardLoading)
  })
}
