/**
 * SummaryStats - Overview statistics for batch update
 * Extracted from BatchUpdateConfirmationDialog (DEBT-002)
 */

import type { BatchUpdateSummary } from '@utils/batchUpdateSummary'
import React from 'react'

interface SummaryStatsProps {
  summary: BatchUpdateSummary
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ summary }) => {
  return (
    <div className="bg-muted grid grid-cols-3 gap-4 rounded-lg p-4">
      <div className="text-center">
        <div className="text-foreground text-2xl font-bold">{summary.totalProjects}</div>
        <div className="text-muted-foreground text-xs">Total Projects</div>
      </div>
      <div className="text-center">
        <div className="text-warning text-2xl font-bold">
          {summary.projectsWithChanges}
        </div>
        <div className="text-muted-foreground text-xs">Will Be Updated</div>
      </div>
      <div className="text-center">
        <div className="text-success text-2xl font-bold">
          {summary.projectsWithoutChanges}
        </div>
        <div className="text-muted-foreground text-xs">No Changes</div>
      </div>
    </div>
  )
}
