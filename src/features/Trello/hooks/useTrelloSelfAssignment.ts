/**
 * useTrelloSelfAssignment Hook
 *
 * Lets the current user assign or unassign themselves to linked Trello cards
 * via a simple toggle. Assignment state is read live from each card's Trello
 * membership (the source of truth) rather than persisted in breadcrumbs, so the
 * toggle always reflects reality and no schema migration is required.
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { logger } from '@shared/utils'

import {
  addMemberToCard,
  fetchCardMembers,
  fetchCurrentTrelloMember,
  removeMemberFromCard
} from '../api'
import type { TrelloMember } from '../types'

interface UseTrelloSelfAssignmentProps {
  /** Trello card IDs to track assignment state for */
  cardIds: string[]
  trelloApiKey?: string
  trelloApiToken?: string
}

const ME_STALE_TIME = 5 * 60 * 1000

/**
 * Manage self-assignment for a set of Trello cards.
 *
 * Returns per-card predicates (`isAssigned`, `isCardLoading`, `isToggling`) and
 * a `toggleAssignment` action. `canAssign` is false until credentials are
 * present and the current Trello user has been resolved.
 */
export function useTrelloSelfAssignment({
  cardIds,
  trelloApiKey,
  trelloApiToken
}: UseTrelloSelfAssignmentProps) {
  const queryClient = useQueryClient()
  const enabled = !!(trelloApiKey && trelloApiToken)

  // The Trello member that owns the current token -- cached across cards.
  const { data: currentMember } = useQuery({
    queryKey: ['trello', 'me', trelloApiKey],
    queryFn: () => fetchCurrentTrelloMember(trelloApiKey!, trelloApiToken!),
    enabled,
    staleTime: ME_STALE_TIME
  })

  // Members for each card -- the source of truth for assignment state.
  const memberQueries = useQueries({
    queries: cardIds.map((cardId) => ({
      queryKey: ['trello', 'cardMembers', cardId],
      queryFn: () => fetchCardMembers(cardId, trelloApiKey!, trelloApiToken!),
      enabled
    }))
  })

  const membersByCard = useMemo(() => {
    const map = new Map<string, { members: TrelloMember[]; isLoading: boolean }>()
    cardIds.forEach((cardId, index) => {
      const query = memberQueries[index]
      map.set(cardId, {
        members: (query?.data as TrelloMember[] | undefined) ?? [],
        isLoading: query?.isLoading ?? false
      })
    })
    return map
    // memberQueries is a new array each render; cardIds + their data drive output
  }, [cardIds, memberQueries])

  const toggle = useMutation({
    mutationFn: async (cardId: string) => {
      if (!currentMember?.id) {
        throw new Error('Current Trello user is not available')
      }
      const assigned = (membersByCard.get(cardId)?.members ?? []).some(
        (member) => member.id === currentMember.id
      )
      if (assigned) {
        await removeMemberFromCard(
          cardId,
          currentMember.id,
          trelloApiKey!,
          trelloApiToken!
        )
      } else {
        await addMemberToCard(cardId, currentMember.id, trelloApiKey!, trelloApiToken!)
      }
      return { cardId, nowAssigned: !assigned }
    },
    onSuccess: ({ cardId, nowAssigned }) => {
      queryClient.invalidateQueries({ queryKey: ['trello', 'cardMembers', cardId] })
      toast.success(
        nowAssigned ? 'Assigned you to the card' : 'Removed you from the card'
      )
    },
    onError: (error) => {
      logger.error('Failed to toggle Trello card assignment:', error)
      toast.error(
        `Failed to update assignment: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  })

  const isAssigned = (cardId: string): boolean => {
    if (!currentMember?.id) return false
    return (membersByCard.get(cardId)?.members ?? []).some(
      (member) => member.id === currentMember.id
    )
  }

  const isCardLoading = (cardId: string): boolean =>
    membersByCard.get(cardId)?.isLoading ?? false

  const isToggling = (cardId: string): boolean =>
    toggle.isPending && toggle.variables === cardId

  return {
    /** The current authenticated Trello user, once resolved */
    currentMember,
    /** True when credentials are present and the current user is known */
    canAssign: enabled && !!currentMember?.id,
    isAssigned,
    isCardLoading,
    isToggling,
    toggleAssignment: (cardId: string) => toggle.mutate(cardId)
  }
}
