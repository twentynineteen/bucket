/**
 * TrelloCardsManager - Container component for managing Trello cards
 * Feature: 004-embed-multiple-video
 * Refactored: 2025-11-18 - Extracted state to useTrelloCardsManager, dialog to AddCardDialog
 */

import { useTrelloCardsManager } from '@hooks/useTrelloCardsManager'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { TrelloCardItem } from './TrelloCardItem'
import { AddCardDialog } from './TrelloCards/AddCardDialog'

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
    handleRemove,
    handleRefresh
  } = useTrelloCardsManager({
    projectPath,
    trelloApiKey,
    trelloApiToken,
    autoSyncToTrello
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load Trello cards:{' '}
          {error instanceof Error ? error.message : String(error)}
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
            {trelloCards.length} {trelloCards.length === 1 ? 'card' : 'cards'} • Project
            management
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
        <div className="border-border bg-muted rounded-lg border border-dashed p-12 text-center">
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
                  onRemove={() => handleRemove(index)}
                  onRefresh={hasApiCredentials ? () => handleRefresh(index) : undefined}
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
    </div>
  )
}
