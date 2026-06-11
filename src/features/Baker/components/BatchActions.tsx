/**
 * Batch Actions Component
 *
 * Floating action bar for batch update operations. Appears centered at the
 * bottom of the workspace only while at least one project is selected, so it
 * never consumes layout space during inspection.
 */

import { CheckCircle, RefreshCw } from 'lucide-react'
import React from 'react'

import { Button } from '@shared/ui/button'

interface BatchActionsProps {
  selectedProjects: string[]
  totalProjects: number
  isUpdating: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onApplyChanges: () => void
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedProjects,
  totalProjects,
  isUpdating,
  onSelectAll,
  onClearSelection,
  onApplyChanges
}) => {
  if (totalProjects === 0 || selectedProjects.length === 0) return null

  return (
    <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
      <div className="bg-popover border-border flex items-center gap-2 rounded-2xl border py-2 pr-2 pl-4 shadow-lg">
        <span className="text-sm whitespace-nowrap">
          <span className="text-primary font-semibold">{selectedProjects.length}</span> of{' '}
          {totalProjects} selected
        </span>
        <Button variant="link" size="sm" onClick={onSelectAll}>
          Select All
        </Button>
        <Button variant="link" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
        <Button
          onClick={onApplyChanges}
          disabled={isUpdating}
          size="sm"
          className="gap-1.5 shadow-sm hover:shadow"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Apply Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
