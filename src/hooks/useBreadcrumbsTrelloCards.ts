/**
 * Custom hook for managing Trello cards in breadcrumbs
 * Feature: 004-embed-multiple-video
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

import type { BreadcrumbsFile, TrelloCard } from '@/types/baker'

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
      return await invoke<TrelloCard[]>('baker_get_trello_cards', { projectPath })
    },
    enabled: enabled && !!projectPath
  })

  // Mutation: Add Trello card
  const addTrelloCard = useMutation({
    mutationFn: async (trelloCard: TrelloCard) => {
      return await invoke<BreadcrumbsFile>('baker_associate_trello_card', {
        projectPath,
        trelloCard
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'trelloCards', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
    }
  })

  // Mutation: Remove Trello card
  const removeTrelloCard = useMutation({
    mutationFn: async (cardIndex: number) => {
      return await invoke<BreadcrumbsFile>('baker_remove_trello_card', {
        projectPath,
        cardIndex
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'trelloCards', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
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
      return await invoke<TrelloCard>('baker_fetch_trello_card_details', {
        cardUrl,
        apiKey,
        apiToken
      })
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
