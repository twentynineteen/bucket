/**
 * Batch Actions Component
 *
 * Footer of the project list, shown only while at least one project is ticked.
 * It sits directly under the rows it acts on, says how many of them actually
 * have something to write, and opens the review dialog. Nothing is written
 * from here.
 *
 * It used to float over the detail panel, where it covered the last list row
 * and sat away from the selection it belonged to.
 */

import { Button } from '@shared/ui/button'
import { RefreshCw } from 'lucide-react'
import React from 'react'

interface BatchActionsProps {
  selectedProjects: string[]
  /** How many of the ticked projects are not already current. */
  needingUpdateCount: number
  /** How many ticked projects the list's current filter is not showing. */
  hiddenByFilterCount?: number
  isUpdating: boolean
  onClearSelection: () => void
  onApplyChanges: () => void
}

/** What will happen to the ticked projects, in the order it matters. */
function selectionBreakdown(selected: number, needingUpdate: number): string {
  const current = selected - needingUpdate
  const parts: string[] = []
  if (needingUpdate > 0) parts.push(`${needingUpdate} to update`)
  if (current > 0) parts.push(`${current} already current, skipped`)
  return parts.join(' · ')
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedProjects,
  needingUpdateCount,
  hiddenByFilterCount = 0,
  isUpdating,
  onClearSelection,
  onApplyChanges
}) => {
  if (selectedProjects.length === 0) return null

  return (
    // The upward shadow marks the edge the rows scroll under.
    <div className="border-border bg-card z-10 flex-shrink-0 space-y-2 border-t p-3 shadow-[0_-6px_12px_-6px_rgb(0_0_0/0.18)]">
      <div className="space-y-0.5 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-foreground font-semibold">
            {selectedProjects.length} selected
            {hiddenByFilterCount > 0 && (
              <span className="text-muted-foreground font-normal">
                {' '}
                ({hiddenByFilterCount} hidden by filter)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground flex-shrink-0 font-medium underline-offset-2 hover:underline"
          >
            Clear selection
          </button>
        </div>
        <p className="text-muted-foreground">
          {selectionBreakdown(selectedProjects.length, needingUpdateCount)}
        </p>
      </div>
      <Button
        onClick={onApplyChanges}
        disabled={isUpdating}
        size="sm"
        className="w-full gap-1.5"
      >
        {isUpdating ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Updating...
          </>
        ) : (
          'Review and update breadcrumbs'
        )}
      </Button>
    </div>
  )
}
