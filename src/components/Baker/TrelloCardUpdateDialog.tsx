/**
 * TrelloCardUpdateDialog - Dialog for selecting which Trello cards to update with new video
 * Feature: 004-embed-multiple-video
 */

import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { TrelloCard } from '@/types/baker'

interface TrelloCardUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trelloCards: TrelloCard[]
  onUpdate: (selectedCardIndexes: number[]) => Promise<void>
  onAddTrelloCard: () => void
}

export function TrelloCardUpdateDialog({
  open,
  onOpenChange,
  trelloCards,
  onUpdate,
  onAddTrelloCard
}: TrelloCardUpdateDialogProps) {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  const handleUpdate = async () => {
    if (selectedIndexes.length === 0) return

    setUpdating(true)
    setError(null)

    try {
      await onUpdate(selectedIndexes)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Trello cards')
    } finally {
      setUpdating(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      setSelectedIndexes([])
      setError(null)
    }
    onOpenChange(open)
  }

  // No Trello cards - show option to add one
  if (trelloCards.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Trello Cards</DialogTitle>
            <DialogDescription>
              No Trello cards are linked to this project yet.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Add a Trello card to automatically sync video links with your project
              management workflow.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Skip for Now
            </Button>
            <Button
              onClick={() => {
                handleDialogChange(false)
                onAddTrelloCard()
              }}
            >
              Add Trello Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Show card selection
  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Trello Cards</DialogTitle>
          <DialogDescription>
            Select which Trello card(s) to update with the new video link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {trelloCards.map((card, index) => (
            <div key={index} className="flex items-start space-x-3 rounded-lg border p-3">
              <Checkbox
                checked={selectedIndexes.includes(index)}
                onCheckedChange={() => handleToggle(index)}
              />
              <div className="flex-1">
                <p className="font-medium">{card.title}</p>
                {card.boardName && (
                  <p className="text-muted-foreground text-sm">{card.boardName}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleDialogChange(false)}
            disabled={updating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={selectedIndexes.length === 0 || updating}
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Update ${selectedIndexes.length} Card${selectedIndexes.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
