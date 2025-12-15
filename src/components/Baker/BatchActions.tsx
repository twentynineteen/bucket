/**
 * Batch Actions Component
 *
 * Handles project selection and batch update operations for Baker.
 */

import { Button } from '@components/ui/button'
import { CheckCircle, RefreshCw } from 'lucide-react'
import React from 'react'

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
  if (totalProjects === 0) return null

  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
          4
        </div>
        <h2 className="text-foreground text-sm font-semibold">Batch Actions</h2>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">
            {selectedProjects.length} of {totalProjects} projects selected
          </span>
          <Button variant="link" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="link" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
        <Button
          onClick={onApplyChanges}
          disabled={selectedProjects.length === 0 || isUpdating}
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
