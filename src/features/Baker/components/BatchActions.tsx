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
  isUpdating: boolean
  onClearSelection: () => void
  onApplyChanges: () => void
}

function selectionBreakdown(selected: number, needingUpdate: number): string {
  const current = selected - needingUpdate
  if (needingUpdate === 0) return 'All already current'
  if (current === 0) return needingUpdate === 1 ? 'Needs updating' : 'All need updating'
  return `${needingUpdate} to update, ${current} current`
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedProjects,
  needingUpdateCount,
  isUpdating,
  onClearSelection,
  onApplyChanges
}) => {
  if (selectedProjects.length === 0) return null

  return (
    <div className="border-border bg-card flex-shrink-0 space-y-2 border-t p-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <p className="min-w-0">
          <span className="text-foreground font-semibold">
            {selectedProjects.length} selected
          </span>
          <span className="text-muted-foreground">
            {' · '}
            {selectionBreakdown(selectedProjects.length, needingUpdateCount)}
          </span>
        </p>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground flex-shrink-0 font-medium underline-offset-2 hover:underline"
        >
          Clear selection
        </button>
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
