/**
 * ReplaceVideoDialog - replaces the source file of a Sprout video that is
 * already linked to the project (issue #282).
 *
 * Purely presentational: every value here is owned by useReplaceVideo. The
 * dialog is itself the confirmation for an irreversible replace, so it carries
 * the warning and there is no second modal on top of it.
 */

import { AlertCircle, AlertTriangle, FileVideo, Loader2, Replace } from 'lucide-react'

import type { ReplaceUploadProgress, ReplaceUploadStatus } from '@features/Upload'
import { formatTransferredBytes } from '@features/Upload'

import { Alert, AlertDescription } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/ui/dialog'
import { Label } from '@shared/ui/label'
import { Progress } from '@shared/ui/progress'

export type ReplacePosterMode = 'keep' | 'new'

export interface ReplaceVideoUploadState {
  selectedFile: string | null
  onSelectFile: () => void
  status: ReplaceUploadStatus
  progress: ReplaceUploadProgress
  error: string | null
  onCancel: () => void
}

export interface ReplaceVideoTrelloState {
  /** False when the project has no cards or Trello is not configured */
  available: boolean
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  cards: Array<{ cardId: string; title: string; boardName?: string }>
  selectedCardIds: string[]
  onToggleCard: (cardId: string) => void
  text: string
  onTextChange: (text: string) => void
  validationMessage: string | null
}

export interface ReplaceVideoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Title of the video whose file is being replaced */
  videoTitle: string
  upload: ReplaceVideoUploadState
  posterMode: ReplacePosterMode
  onPosterModeChange: (mode: ReplacePosterMode) => void
  trello: ReplaceVideoTrelloState
  canSubmit: boolean
  onConfirm: () => void
}

export function ReplaceVideoDialog({
  open,
  onOpenChange,
  videoTitle,
  upload,
  posterMode,
  onPosterModeChange,
  trello,
  canSubmit,
  onConfirm
}: ReplaceVideoDialogProps) {
  const uploading = upload.status === 'uploading'
  const cancelling = upload.status === 'cancelling'
  const transferring = uploading || cancelling
  const fileName = upload.selectedFile?.split('/').pop() ?? null
  const percent = Math.round(upload.progress.percentage)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-transfer would leave Rust streaming with nothing watching it
        if (!next && transferring) return
        onOpenChange(next)
      }}
    >
      <DialogContent hideClose={transferring}>
        <DialogHeader>
          <DialogTitle>Replace video</DialogTitle>
          <DialogDescription>
            Upload a new file for a video that is already on Sprout Video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Video</p>
            <p className="text-muted-foreground text-sm">{videoTitle}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Replacement file</p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={upload.onSelectFile}
                disabled={transferring}
              >
                <FileVideo className="mr-2 h-4 w-4" />
                Choose file
              </Button>
              {fileName ? (
                <span className="truncate text-sm">{fileName}</span>
              ) : (
                <span className="text-muted-foreground text-sm">No file chosen</span>
              )}
            </div>
            <p className="text-warning flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The current file on Sprout Video will be permanently replaced. Embed and
                share links stay the same.
              </span>
            </p>
          </div>

          <fieldset className="space-y-2" disabled={transferring}>
            <legend className="text-sm font-medium">Poster frame</legend>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="replace-poster-keep"
                name="replace-poster-mode"
                className="accent-primary h-4 w-4"
                checked={posterMode === 'keep'}
                onChange={() => onPosterModeChange('keep')}
              />
              <Label htmlFor="replace-poster-keep" className="cursor-pointer font-normal">
                Keep the current poster frame
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="replace-poster-new"
                name="replace-poster-mode"
                className="accent-primary h-4 w-4"
                checked={posterMode === 'new'}
                onChange={() => onPosterModeChange('new')}
              />
              <Label htmlFor="replace-poster-new" className="cursor-pointer font-normal">
                Set a new poster frame after the upload
              </Label>
            </div>
          </fieldset>

          {trello.available && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="replace-trello-comment"
                  checked={trello.enabled}
                  onCheckedChange={(checked) => trello.onEnabledChange(checked === true)}
                  disabled={transferring}
                />
                <Label htmlFor="replace-trello-comment" className="cursor-pointer">
                  Comment on Trello
                </Label>
              </div>

              {trello.enabled && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    {trello.cards.map((card) => {
                      const id = `replace-trello-card-${card.cardId}`
                      return (
                        <div key={card.cardId} className="flex items-start gap-2">
                          <Checkbox
                            id={id}
                            checked={trello.selectedCardIds.includes(card.cardId)}
                            onCheckedChange={() => trello.onToggleCard(card.cardId)}
                            disabled={transferring}
                          />
                          <Label htmlFor={id} className="cursor-pointer font-normal">
                            <span>{card.title}</span>
                            {card.boardName && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                {card.boardName}
                              </span>
                            )}
                          </Label>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="replace-trello-text">Comment</Label>
                    <textarea
                      id="replace-trello-text"
                      value={trello.text}
                      onChange={(event) => trello.onTextChange(event.target.value)}
                      rows={3}
                      maxLength={1000}
                      disabled={transferring}
                      className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  {trello.validationMessage && (
                    <p className="text-warning text-xs">{trello.validationMessage}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {transferring && (
            <div className="space-y-2">
              <Progress value={upload.progress.percentage} />
              <p className="text-muted-foreground text-xs">
                {`${percent}% · ${formatTransferredBytes(upload.progress.bytesSent)} of ${formatTransferredBytes(upload.progress.totalBytes)}`}
              </p>
            </div>
          )}

          {upload.status === 'error' && upload.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{upload.error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {transferring ? (
            <Button variant="outline" onClick={upload.onCancel} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel'
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onConfirm} disabled={!canSubmit}>
                <Replace className="mr-2 h-4 w-4" />
                Replace video
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
