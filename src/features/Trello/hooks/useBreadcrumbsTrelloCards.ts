/**
 * Custom hook for managing Trello cards in breadcrumbs
 * Feature: 004-embed-multiple-video
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BreadcrumbsFile, TrelloCard } from '@/types/baker'

import {
  bakerAssociateTrelloCard,
  bakerFetchTrelloCardDetails,
  bakerGetTrelloCards,
  bakerRemoveTrelloCard
} from '../api'

interface UseBreadcrumbsTrelloCardsOptions {
  projectPath: string
  enabled?: boolean
}

export function useBreadcrumbsTrelloCards({
  projectPath,
  enabled = true
}: UseBreadcrumbsTrelloCardsOptions) {
  const queryClient = useQueryClient()

  // Query: Get Trello cards
  const {
    data: trelloCards = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['breadcrumbs', 'trelloCards', projectPath],
    queryFn: async () => {
      return (await bakerGetTrelloCards(projectPath)) as TrelloCard[]
    },
    enabled: enabled && !!projectPath
  })

  // Mutation: Add Trello card
  const addTrelloCard = useMutation({
    mutationFn: async (trelloCard: TrelloCard) => {
      return (await bakerAssociateTrelloCard(
        projectPath,
        trelloCard
      )) as BreadcrumbsFile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'trelloCards', projectPath]
      })
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', projectPath]
      })
    }
  })

  // Mutation: Remove Trello card
  const removeTrelloCard = useMutation({
    mutationFn: async (cardIndex: number) => {
      return (await bakerRemoveTrelloCard(
        projectPath,
        cardIndex
      )) as BreadcrumbsFile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'trelloCards', projectPath]
      })
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', projectPath]
      })
    }
  })

  // Mutation: Fetch Trello card details from API
  const fetchCardDetails = useMutation({
    mutationFn: async ({
      cardUrl,
      apiKey,
      apiToken
    }: {
      cardUrl: string
      apiKey: string
      apiToken: string
    }) => {
      return (await bakerFetchTrelloCardDetails(
        cardUrl,
        apiKey,
        apiToken
      )) as TrelloCard
    }
  })

  const isUpdating = addTrelloCard.isPending || removeTrelloCard.isPending
  const isFetchingDetails = fetchCardDetails.isPending

  return {
    trelloCards,
    isLoading,
    error,
    addTrelloCard: addTrelloCard.mutate,
    addTrelloCardAsync: addTrelloCard.mutateAsync,
    removeTrelloCard: removeTrelloCard.mutate,
    removeTrelloCardAsync: removeTrelloCard.mutateAsync,
    fetchCardDetails: fetchCardDetails.mutate,
    fetchCardDetailsAsync: fetchCardDetails.mutateAsync,
    isUpdating,
    isFetchingDetails,
    addError: addTrelloCard.error,
    removeError: removeTrelloCard.error,
    fetchError: fetchCardDetails.error,
    fetchedCardData: fetchCardDetails.data
  }
}
