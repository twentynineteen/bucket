/**
 * UpdateDialog Component
 *
 * A custom dialog for displaying app update information with scrollable
 * release notes and markdown rendering support.
 *
 * Features:
 * - Scrollable release notes container for long changelogs
 * - Markdown rendering with react-markdown
 * - Version info display (current → latest)
 * - Update and Cancel action buttons
 */

import { ArrowRight, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface UpdateDialogProps {
  open: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes: string
  onUpdate: () => void
  onCancel: () => void
}

export function UpdateDialog({
  open,
  currentVersion,
  latestVersion,
  releaseNotes,
  onUpdate,
  onCancel
}: UpdateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of Bucket is available. Review the changes below and update when
            ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Version info */}
          <div className="bg-muted/50 flex items-center justify-center gap-3 rounded-lg p-3">
            <span className="text-muted-foreground font-mono text-sm">
              {currentVersion}
            </span>
            <ArrowRight className="text-muted-foreground h-4 w-4" />
            <span className="font-mono text-sm font-semibold">{latestVersion}</span>
          </div>

          {/* Release notes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Release Notes</h4>
            <div
              data-testid="release-notes-container"
              className="bg-muted/30 max-h-64 overflow-y-auto rounded-lg border p-4"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {releaseNotes || 'No release notes available.'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onUpdate}>
            <Download className="mr-2 h-4 w-4" />
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
