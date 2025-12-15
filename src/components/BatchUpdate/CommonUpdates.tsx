/**
 * CommonUpdates - Common update operations display
 * Extracted from BatchUpdateConfirmationDialog (DEBT-002)
 */

import type { BatchUpdateSummary } from '@utils/batchUpdateSummary'
import { Clock, Edit, HardDrive, User } from 'lucide-react'
import React from 'react'

interface CommonUpdatesProps {
  summary: BatchUpdateSummary
}

export const CommonUpdates: React.FC<CommonUpdatesProps> = ({ summary }) => {
  const { commonChanges } = summary

  const hasAnyCommonChanges =
    commonChanges.folderSizeCalculated > 0 ||
    commonChanges.filesUpdated > 0 ||
    commonChanges.timestampsUpdated > 0 ||
    commonChanges.createdByUpdated > 0

  if (!hasAnyCommonChanges) return null

  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-foreground mb-3 font-medium">Common Updates</h4>
      <div className="space-y-2 text-sm">
        {commonChanges.folderSizeCalculated > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-foreground flex items-center">
              <HardDrive className="mr-2 h-4 w-4" />
              Folder sizes will be calculated
            </div>
            <span className="text-muted-foreground">
              {commonChanges.folderSizeCalculated} projects
            </span>
          </div>
        )}
        {commonChanges.filesUpdated > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-foreground flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              File lists will be updated
            </div>
            <span className="text-muted-foreground">
              {commonChanges.filesUpdated} projects
            </span>
          </div>
        )}
        {commonChanges.timestampsUpdated > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-foreground flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Last modified timestamps will be updated
            </div>
            <span className="text-muted-foreground">
              {commonChanges.timestampsUpdated} projects
            </span>
          </div>
        )}
        {commonChanges.createdByUpdated > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-foreground flex items-center">
              <User className="mr-2 h-4 w-4" />
              "Created by" fields will be updated
            </div>
            <span className="text-muted-foreground">
              {commonChanges.createdByUpdated} projects
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
