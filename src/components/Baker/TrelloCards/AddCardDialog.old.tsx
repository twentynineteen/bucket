/**
 * AddCardDialog - Dialog for adding new Trello cards
 * Extracted from TrelloCardsManager to reduce complexity (DEBT-002)
 */

import TrelloCardList from '@utils/trello/TrelloCardList'
import { AlertCircle, Loader2, Plus, Search } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AddCardDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canAddCard: boolean
  hasApiCredentials: boolean
  addMode: 'url' | 'select'
  onAddModeChange: (mode: 'url' | 'select') => void
  // URL mode
  cardUrl: string
  onCardUrlChange: (url: string) => void
  onFetchAndAdd: () => void
  // Select mode
  searchTerm: string
  onSearchTermChange: (term: string) => void
  filteredGrouped: Record<string, Array<{ id: string; name: string; desc?: string }>>
  onSelectCard: (card: { id: string; name: string }) => void
  isBoardLoading: boolean
  // Common
  isFetchingCard: boolean
  onClose: () => void
  // Errors
  validationErrors: string[]
  addError: Error | null
  fetchError: Error | null
}

export function AddCardDialog({
  isOpen,
  onOpenChange,
  canAddCard,
  hasApiCredentials,
  addMode,
  onAddModeChange,
  cardUrl,
  onCardUrlChange,
  onFetchAndAdd,
  searchTerm,
  onSearchTermChange,
  filteredGrouped,
  onSelectCard,
  isBoardLoading,
  isFetchingCard,
  onClose,
  validationErrors,
  addError,
  fetchError
}: AddCardDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!canAddCard}>
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Trello Card</DialogTitle>
          <DialogDescription>
            {hasApiCredentials
              ? 'Select a card from your board or enter a URL'
              : 'Enter the URL of a Trello card'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={addMode}
          onValueChange={(v) => onAddModeChange(v as 'url' | 'select')}
        >
          {hasApiCredentials && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select">Select from Board</TabsTrigger>
              <TabsTrigger value="url">Enter URL</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="select" className="space-y-4">
            <SelectFromBoardContent
              searchTerm={searchTerm}
              onSearchTermChange={onSearchTermChange}
              filteredGrouped={filteredGrouped}
              onSelectCard={onSelectCard}
              isBoardLoading={isBoardLoading}
              isFetchingCard={isFetchingCard}
            />
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <UrlInputContent
              cardUrl={cardUrl}
              onCardUrlChange={onCardUrlChange}
              onFetchAndAdd={onFetchAndAdd}
              onClose={onClose}
              isFetchingCard={isFetchingCard}
              hasApiCredentials={hasApiCredentials}
            />
          </TabsContent>
        </Tabs>

        <ErrorDisplay
          validationErrors={validationErrors}
          addError={addError}
          fetchError={fetchError}
        />
      </DialogContent>
    </Dialog>
  )
}

// Sub-components
function SelectFromBoardContent({
  searchTerm,
  onSearchTermChange,
  filteredGrouped,
  onSelectCard,
  isBoardLoading,
  isFetchingCard
}: {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  filteredGrouped: Record<string, Array<{ id: string; name: string; desc?: string }>>
  onSelectCard: (card: { id: string; name: string }) => void
  isBoardLoading: boolean
  isFetchingCard: boolean
}) {
  if (isBoardLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading cards...</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="search">Search Cards</Label>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="search"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border p-4">
        {isFetchingCard ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Adding card...</span>
          </div>
        ) : (
          <TrelloCardList grouped={filteredGrouped} onSelect={onSelectCard} />
        )}
      </div>
    </>
  )
}

function UrlInputContent({
  cardUrl,
  onCardUrlChange,
  onFetchAndAdd,
  onClose,
  isFetchingCard,
  hasApiCredentials
}: {
  cardUrl: string
  onCardUrlChange: (url: string) => void
  onFetchAndAdd: () => void
  onClose: () => void
  isFetchingCard: boolean
  hasApiCredentials: boolean
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="card-url">Trello Card URL *</Label>
        <Input
          id="card-url"
          placeholder="https://trello.com/c/abc12345/card-name"
          value={cardUrl}
          onChange={(e) => onCardUrlChange(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          {hasApiCredentials
            ? 'Card details will be fetched automatically'
            : 'Enter the full URL from your Trello board'}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onFetchAndAdd} disabled={isFetchingCard || !cardUrl.trim()}>
          {isFetchingCard ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            'Add Card'
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

function ErrorDisplay({
  validationErrors,
  addError,
  fetchError
}: {
  validationErrors: string[]
  addError: Error | null
  fetchError: Error | null
}) {
  return (
    <>
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {addError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {addError instanceof Error ? addError.message : String(addError)}
          </AlertDescription>
        </Alert>
      )}

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {fetchError instanceof Error ? fetchError.message : String(fetchError)}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
