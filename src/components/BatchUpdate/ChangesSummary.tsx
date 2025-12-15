/**
 * ChangesSummary - Summary of field changes
 * Extracted from BatchUpdateConfirmationDialog (DEBT-002)
 */

import type { BatchUpdateSummary } from '@utils/batchUpdateSummary'
import { Edit, Minus, Plus } from 'lucide-react'
import React from 'react'

interface ChangesSummaryProps {
  summary: BatchUpdateSummary
}

export const ChangesSummary: React.FC<ChangesSummaryProps> = ({ summary }) => {
  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-foreground mb-3 font-medium">Changes Summary</h4>
      <div className="grid grid-cols-3 gap-4 text-sm">
        {summary.totalChanges.added > 0 && (
          <div className="text-success flex items-center">
            <Plus className="mr-1 h-4 w-4" />
            {summary.totalChanges.added} fields added
          </div>
        )}
        {summary.totalChanges.modified > 0 && (
          <div className="text-warning flex items-center">
            <Edit className="mr-1 h-4 w-4" />
            {summary.totalChanges.modified} fields modified
          </div>
        )}
        {summary.totalChanges.removed > 0 && (
          <div className="text-destructive flex items-center">
            <Minus className="mr-1 h-4 w-4" />
            {summary.totalChanges.removed} fields removed
          </div>
        )}
      </div>
    </div>
  )
}
