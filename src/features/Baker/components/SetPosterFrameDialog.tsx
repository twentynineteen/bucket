/**
 * SetPosterFrameDialog - sets a branded poster frame on an already-linked
 * Sprout video (Issue #141).
 *
 * Purely presentational: every value here is owned by useCardPosterFrame. The
 * dialog is itself the confirmation step — it
 * shows the exact frame that will be sent before the irreversible PUT — so no
 * second AlertDialog sits on top of it.
 */

import { AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react'
import type { RefObject } from 'react'

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
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'

/** Poster frame state the dialog renders but never owns */
export interface SetPosterFramePanelState {
  /** Why a poster frame cannot be built or sent; disables the action when set */
  unavailableReason: string | null
  backgrounds: string[]
  selectedBackground: string | null
  onBackgroundChange: (path: string) => void
  text: string
  onTextChange: (text: string) => void
  previewImageUrl: string | null
  saveCopy: boolean
  onSaveCopyChange: (saveCopy: boolean) => void
  status: 'idle' | 'working' | 'success' | 'error'
  error: string | null
}

export interface SetPosterFrameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Title of the video whose poster frame is being replaced */
  videoTitle: string
  posterFrame: SetPosterFramePanelState
  /**
   * Ref for the preview canvas. Kept out of the posterFrame group because a
   * member expression used as `ref=` reads as a render-time ref access.
   */
  canvasRef: RefObject<HTMLCanvasElement | null>
  onConfirm: () => void
  onRetry: () => void
}

export function SetPosterFrameDialog({
  open,
  onOpenChange,
  videoTitle,
  posterFrame,
  canvasRef,
  onConfirm,
  onRetry
}: SetPosterFrameDialogProps) {
  const working = posterFrame.status === 'working'
  // A background-only frame is never sent to Sprout (B3.8)
  const textMissing = posterFrame.text.trim().length === 0
  const blocked = posterFrame.unavailableReason !== null || textMissing
  const selectedName = posterFrame.selectedBackground?.split('/').pop() ?? ''

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-request would tear down the in-flight PUT (B5.3)
        if (!next && working) return
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set poster frame</DialogTitle>
          <DialogDescription>
            This replaces the current poster frame on Sprout Video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Video</Label>
            <p className="text-muted-foreground text-sm">{videoTitle}</p>
          </div>

          {posterFrame.unavailableReason ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{posterFrame.unavailableReason}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="card-poster-frame-background">Background</Label>
                <Select
                  value={posterFrame.selectedBackground ?? ''}
                  onValueChange={posterFrame.onBackgroundChange}
                  disabled={working}
                >
                  <SelectTrigger id="card-poster-frame-background" className="w-full">
                    <SelectValue placeholder="Select a background">
                      {selectedName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[240px]">
                    {posterFrame.backgrounds.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file.split('/').pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-poster-frame-text">Poster frame text</Label>
                <Input
                  id="card-poster-frame-text"
                  value={posterFrame.text}
                  onChange={(event) => posterFrame.onTextChange(event.target.value)}
                  maxLength={200}
                  disabled={working}
                />
                {textMissing ? (
                  <p className="text-warning text-xs">Poster frame text is required.</p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Taken from the last part of the video title. Edit it to change the
                    thumbnail only.
                  </p>
                )}
              </div>

              {posterFrame.previewImageUrl && (
                <div className="border-border overflow-hidden rounded border">
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label="Poster frame preview"
                    className="aspect-video w-full"
                  />
                </div>
              )}

              <div className="flex items-start gap-2">
                <Checkbox
                  id="card-poster-frame-save-copy"
                  checked={posterFrame.saveCopy}
                  onCheckedChange={(checked) =>
                    posterFrame.onSaveCopyChange(checked === true)
                  }
                  disabled={working}
                />
                <Label htmlFor="card-poster-frame-save-copy" className="cursor-pointer">
                  Save a copy to the project&apos;s Graphics folder
                </Label>
              </div>
            </>
          )}

          {posterFrame.status === 'error' && posterFrame.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{posterFrame.error}</span>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={working}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={blocked || working}>
            {working ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting poster frame...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Set poster frame
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
