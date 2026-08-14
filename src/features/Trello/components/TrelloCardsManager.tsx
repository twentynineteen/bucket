/**
 * TrelloCardsManager - Container component for managing Trello cards
 * Feature: 004-embed-multiple-video
 * Refactored: 2025-11-18 - Extracted state to useTrelloCardsManager, dialog to AddCardDialog
 */

import { useMemo } from 'react'

import { useTrelloCardsManager } from '../hooks/useTrelloCardsManager'
import { useTrelloSelfAssignment } from '../hooks/useTrelloSelfAssignment'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'

import { describeTrelloCardsError } from '../internal/trelloCardsError'
import { TrelloCardItem } from './TrelloCardItem'
import { AddCardDialog } from './AddCardDialog'

interface TrelloCardsManagerProps {
  projectPath: string
  trelloApiKey?: string
  trelloApiToken?: string
  autoSyncToTrello?: boolean
}

export function TrelloCardsManager({
  projectPath,
  trelloApiKey,
  trelloApiToken,
  autoSyncToTrello = false
}: TrelloCardsManagerProps) {
  const {
    // Data
    trelloCards,
    isLoading,
    error,
    refetchTrelloCards,
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
    hasApiCredentials,
    canAddCard,

    // Handlers
    handleSelectCard,
    handleFetchAndAdd,
    handleRefresh,

    // AlertDialog state
    pendingRemoveCardIndex,
    requestRemoveCard,
    confirmRemoveCard,
    cancelRemoveCard
  } = useTrelloCardsManager({
    projectPath,
    trelloApiKey,
    trelloApiToken,
    autoSyncToTrello
  })

  const cardIds = useMemo(() => trelloCards.map((card) => card.cardId), [trelloCards])
  const assignment = useTrelloSelfAssignment({
    cardIds,
    trelloApiKey,
    trelloApiToken
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Error state. What failed here is reading this project's local breadcrumbs
  // file, not anything to do with Trello, so lead with a headline naming the
  // real cause and a remedy the user can act on. The backend's own words stay
  // reachable in the disclosure below, and are logged by the query (issue #212).
  if (error) {
    const failure = describeTrelloCardsError(error)

    return (
      <Alert variant="destructive" data-test="trello-cards-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{failure.title}</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p>{failure.description}</p>

          <details className="bg-muted/50 border-border rounded-md border p-3 text-left text-xs">
            <summary className="text-foreground cursor-pointer font-medium">
              Technical Details
            </summary>
            <p className="text-muted-foreground mt-2 break-words">{failure.detail}</p>
          </details>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetchTrelloCards()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Trello Cards</h3>
          <p className="text-muted-foreground text-sm">
            {trelloCards.length} {trelloCards.length === 1 ? 'card' : 'cards'} {'\u2022'}{' '}
            Project management
          </p>
        </div>

        <AddCardDialog
          dialog={{
            isOpen: isDialogOpen,
            onOpenChange: setIsDialogOpen,
            canAddCard: canAddCard,
            hasApiCredentials: hasApiCredentials
          }}
          mode={{
            addMode: addMode,
            onAddModeChange: setAddMode
          }}
          urlMode={{
            cardUrl: cardUrl,
            onCardUrlChange: setCardUrl,
            onFetchAndAdd: handleFetchAndAdd
          }}
          selectMode={{
            searchTerm: searchTerm,
            onSearchTermChange: setSearchTerm,
            filteredGrouped: filteredGrouped,
            onSelectCard: handleSelectCard,
            isBoardLoading: isBoardLoading
          }}
          common={{
            isFetchingCard: isFetchingCard,
            onClose: () => {
              setIsDialogOpen(false)
              setCardUrl('')
            }
          }}
          errors={{
            validationErrors: validationErrors,
            addError: addError,
            fetchError: fetchError
          }}
        />
      </div>

      {/* Card List */}
      {trelloCards.length === 0 ? (
        <div
          data-test="trello-cards-empty"
          className="border-border bg-muted rounded-lg border border-dashed p-12 text-center"
        >
          <p className="text-muted-foreground text-sm">No Trello cards added yet</p>
          <p className="text-muted-foreground/50 mt-1 text-xs">
            Link Trello cards to track project management tasks
          </p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 border-border border-b">
              <tr>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  Title
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  Board
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-medium">
                  Last Updated
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {trelloCards.map((card, index) => (
                <TrelloCardItem
                  key={`${card.cardId}-${index}`}
                  trelloCard={card}
                  onRemove={() => requestRemoveCard(index)}
                  onRefresh={hasApiCredentials ? () => handleRefresh(index) : undefined}
                  canAssign={assignment.canAssign}
                  isAssigned={assignment.isAssigned(card.cardId)}
                  isAssignmentLoading={assignment.isCardLoading(card.cardId)}
                  isAssignmentToggling={assignment.isToggling(card.cardId)}
                  onToggleAssign={() => assignment.toggleAssignment(card.cardId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading indicator */}
      {(isUpdating || isFetchingDetails || isSyncingToTrello) && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          <span className="text-muted-foreground ml-2 text-sm">
            {isSyncingToTrello
              ? 'Syncing breadcrumbs to Trello...'
              : isFetchingDetails
                ? 'Fetching card details...'
                : 'Updating...'}
          </span>
        </div>
      )}

      {/* Remove card confirmation dialog */}
      <AlertDialog
        open={pendingRemoveCardIndex !== null}
        onOpenChange={(open) => !open && cancelRemoveCard()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Trello Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this Trello card?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveCard}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
