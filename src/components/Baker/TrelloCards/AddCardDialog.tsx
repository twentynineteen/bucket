/**
 * AddCardDialog - Dialog for adding new Trello cards
 * DEBT-007: Refactored with grouped parameters (19 → 6 parameter groups)
 * Reduced from 19 individual parameters to 6 logical parameter groups
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

// Type definitions for grouped parameters
export interface DialogState {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canAddCard: boolean
  hasApiCredentials: boolean
}

export interface ModeState {
  addMode: 'url' | 'select'
  onAddModeChange: (mode: 'url' | 'select') => void
}

export interface UrlModeState {
  cardUrl: string
  onCardUrlChange: (url: string) => void
  onFetchAndAdd: () => void
}

export interface SelectModeState {
  searchTerm: string
  onSearchTermChange: (term: string) => void
  filteredGrouped: Record<string, Array<{ id: string; name: string; desc?: string }>>
  onSelectCard: (card: { id: string; name: string }) => void
  isBoardLoading: boolean
}

export interface CommonState {
  isFetchingCard: boolean
  onClose: () => void
}

export interface ErrorState {
  validationErrors: string[]
  addError: Error | null
  fetchError: Error | null
}

// Refactored props interface - 6 grouped parameters instead of 19 individual ones
export interface AddCardDialogProps {
  dialog: DialogState
  mode: ModeState
  urlMode: UrlModeState
  selectMode: SelectModeState
  common: CommonState
  errors: ErrorState
}

export function AddCardDialog({
  dialog,
  mode,
  urlMode,
  selectMode,
  common,
  errors
}: AddCardDialogProps) {
  return (
    <Dialog open={dialog.isOpen} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!dialog.canAddCard}>
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Trello Card</DialogTitle>
          <DialogDescription>
            {dialog.hasApiCredentials
              ? 'Select a card from your board or enter a URL'
              : 'Enter the URL of a Trello card'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode.addMode}
          onValueChange={(v) => mode.onAddModeChange(v as 'url' | 'select')}
        >
          {dialog.hasApiCredentials && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select">Select from Board</TabsTrigger>
              <TabsTrigger value="url">Enter URL</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="select" className="space-y-4">
            <SelectFromBoardContent selectMode={selectMode} common={common} />
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <UrlInputContent
              urlMode={urlMode}
              common={common}
              hasApiCredentials={dialog.hasApiCredentials}
            />
          </TabsContent>
        </Tabs>

        <ErrorDisplay errors={errors} />
      </DialogContent>
    </Dialog>
  )
}

// Sub-components
function SelectFromBoardContent({
  selectMode,
  common
}: {
  selectMode: SelectModeState
  common: CommonState
}) {
  if (selectMode.isBoardLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading cards...</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="search">Search Cards</Label>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="search"
            placeholder="Search by name or description..."
            value={selectMode.searchTerm}
            onChange={(e) => selectMode.onSearchTermChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border p-4">
        {common.isFetchingCard ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">Adding card...</span>
          </div>
        ) : (
          <TrelloCardList
            grouped={selectMode.filteredGrouped}
            onSelect={selectMode.onSelectCard}
          />
        )}
      </div>
    </>
  )
}

function UrlInputContent({
  urlMode,
  common,
  hasApiCredentials
}: {
  urlMode: UrlModeState
  common: CommonState
  hasApiCredentials: boolean
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="card-url">Trello Card URL *</Label>
        <Input
          id="card-url"
          placeholder="https://trello.com/c/abc12345/card-name"
          value={urlMode.cardUrl}
          onChange={(e) => urlMode.onCardUrlChange(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {hasApiCredentials
            ? 'Card details will be fetched automatically'
            : 'Enter the full URL from your Trello board'}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={common.onClose}>
          Cancel
        </Button>
        <Button
          onClick={urlMode.onFetchAndAdd}
          disabled={common.isFetchingCard || !urlMode.cardUrl.trim()}
        >
          {common.isFetchingCard ? (
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

function ErrorDisplay({ errors }: { errors: ErrorState }) {
  return (
    <>
      {errors.validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {errors.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {errors.addError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.addError instanceof Error
              ? errors.addError.message
              : String(errors.addError)}
          </AlertDescription>
        </Alert>
      )}

      {errors.fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.fetchError instanceof Error
              ? errors.fetchError.message
              : String(errors.fetchError)}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
