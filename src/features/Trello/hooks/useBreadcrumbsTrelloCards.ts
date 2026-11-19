/**
 * Custom hook for managing Trello cards in breadcrumbs
 * Feature: 004-embed-multiple-video
 */

import type { BreadcrumbsFile, TrelloCard } from '@features/Baker'
import { applyBreadcrumbsChange } from '@features/Breadcrumbs'
import { logger } from '@shared/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
    error,
    refetch
  } = useQuery({
    queryKey: ['breadcrumbs', 'trelloCards', projectPath],
    queryFn: async () => {
      try {
        return (await bakerGetTrelloCards(projectPath)) as TrelloCard[]
      } catch (err) {
        // What the user is shown is deliberately not the raw message any more
        // (issue #212), so log the backend's own words once, here, where they
        // are still exact.
        logger.error('Failed to read Trello cards from breadcrumbs:', projectPath, err)
        throw err
      }
    },
    enabled: enabled && !!projectPath
  })

  // Mutation: Add Trello card
  const addTrelloCard = useMutation({
    mutationFn: async (trelloCard: TrelloCard) => {
      return (await bakerAssociateTrelloCard(projectPath, trelloCard)) as BreadcrumbsFile
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

  // Mutation: Replace a linked card's details in place (#371).
  //
  // One write, so the card keeps its place in the list and is never missing
  // from the file part-way through. Refreshing by removing the card and adding
  // it back is two writes that can land out of order on a slow volume, which
  // deleted the card instead of updating it.
  const updateTrelloCard = useMutation({
    mutationFn: async (trelloCard: TrelloCard) => {
      const [outcome] = await applyBreadcrumbsChange([projectPath], {
        kind: 'updateTrelloCard',
        card: trelloCard
      })
      if (outcome.status === 'failed') {
        throw new Error(outcome.message)
      }
      return outcome.file
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
      return (await bakerRemoveTrelloCard(projectPath, cardIndex)) as BreadcrumbsFile
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
      return (await bakerFetchTrelloCardDetails(cardUrl, apiKey, apiToken)) as TrelloCard
    }
  })

  const isUpdating =
    addTrelloCard.isPending || updateTrelloCard.isPending || removeTrelloCard.isPending
  const isFetchingDetails = fetchCardDetails.isPending

  return {
    trelloCards,
    isLoading,
    error,
    /** Re-runs the breadcrumbs read, so a failure can offer the user a retry. */
    refetch,
    addTrelloCard: addTrelloCard.mutate,
    addTrelloCardAsync: addTrelloCard.mutateAsync,
    /** Replaces the linked card with the same `cardId`, keeping its position. */
    updateTrelloCardAsync: updateTrelloCard.mutateAsync,
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
