/**
 * SproutFolderIndexPanel (issue #155, search)
 *
 * Builds and reports on the saved folder index, for the Settings page.
 *
 * It lives here rather than inside the folder picker because a full pass over a
 * large account runs for minutes: it should not be started from a dropdown that
 * closes, and its progress should be visible somewhere stable. Search still
 * reads the index from the picker — this is only where it is built.
 */
import { Button } from '@shared/ui/button'
import {
  AlertCircle,
  Download,
  FolderSearch,
  Loader2,
  Upload as UploadIcon
} from 'lucide-react'
import React from 'react'

import { useSproutFolderIndex } from '../hooks/useSproutFolderIndex'

export interface SproutFolderIndexPanelProps {
  /** Sprout API key. Without one, indexing is unavailable. */
  apiKey: string | null
}

export const SproutFolderIndexPanel: React.FC<SproutFolderIndexPanelProps> = ({
  apiKey
}) => {
  const index = useSproutFolderIndex(apiKey)

  if (!apiKey) {
    return (
      <p className="text-muted-foreground text-sm">
        Add your Sprout Video API key above to index folders for search.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Sprout cannot search folders by name, so Bucket walks the folder tree once and
        saves what it finds. Searching in the upload folder picker then covers every
        folder — including ones you have never opened — without using any further
        requests.
      </p>

      {index.isBuilding ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Indexing… {index.progress?.folders ?? 0} folders found
              {index.progress?.requests ? ` (${index.progress.requests} requests)` : ''}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Paced to stay well inside Sprout&apos;s request limit, so uploads keep
            working. Progress is saved as it goes — cancelling keeps what has been found
            so far.
          </p>
          <Button variant="outline" size="sm" onClick={index.cancel}>
            Cancel indexing
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            {index.index ? (
              <>
                <span className="font-medium">{index.folders.length} folders</span>{' '}
                indexed
                {index.ageInDays === 0
                  ? ' today'
                  : index.ageInDays !== null
                    ? ` ${index.ageInDays} day${index.ageInDays === 1 ? '' : 's'} ago`
                    : ''}
                {index.index.partial ? ' — partial, so some folders may be missing' : ''}
                {index.isStale ? ' — may be out of date' : ''}
              </>
            ) : (
              'No folders indexed yet. Search will only cover folders you have opened.'
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={index.build}>
              <FolderSearch className="mr-2 h-4 w-4" />
              {index.index ? 'Re-index folders' : 'Index folders now'}
            </Button>

            {/* Sharing turns a multi-minute crawl into a single request for
                everyone else on the team. */}
            <Button
              variant="outline"
              size="sm"
              onClick={index.exportIndex}
              disabled={!index.index || index.isTransferring}
              title={
                index.index
                  ? 'Save the index to a file to share with your team'
                  : 'Index folders first'
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={index.importIndex}
              disabled={index.isTransferring}
              title="Load an index a colleague exported"
            >
              <UploadIcon className="mr-2 h-4 w-4" />
              Import
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Indexing takes a few minutes on a large account. Export it and a colleague can
            import the same index in one step, without walking the tree again.
          </p>
        </div>
      )}

      {index.transferMessage && (
        <p
          className={`flex items-start gap-1.5 text-xs ${
            index.transferFailed ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {index.transferFailed && (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{index.transferMessage}</span>
        </p>
      )}

      {index.incompleteReason && !index.isBuilding && (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{index.incompleteReason}</span>
        </p>
      )}
    </div>
  )
}

export default SproutFolderIndexPanel
