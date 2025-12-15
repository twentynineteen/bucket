/**
 * DetailedChangesSection - Simplified detailed changes view
 * Extracted from BatchUpdateConfirmationDialog (DEBT-002)
 * Refactored: 2025-11-18 - Flattened nesting from 6 levels to 2 levels
 */

import { cn } from '@components/lib/utils'
import { ChevronRight, Edit, Info, Minus, Plus } from 'lucide-react'
import React, { useState } from 'react'

import type { BreadcrumbsPreview } from '@/types/baker'

interface DetailedChangesSectionProps {
  previews: BreadcrumbsPreview[]
  selectedProjects: string[]
}

const getChangeIcon = (type: string) => {
  switch (type) {
    case 'added':
      return <Plus className="text-success h-3 w-3" />
    case 'modified':
      return <Edit className="text-warning h-3 w-3" />
    case 'removed':
      return <Minus className="text-destructive h-3 w-3" />
    default:
      return <Info className="text-muted-foreground h-3 w-3" />
  }
}

export const DetailedChangesSection: React.FC<DetailedChangesSectionProps> = ({
  previews
}) => {
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  const projectsWithChanges = previews.filter((p) => p.detailedChanges?.hasChanges)

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted border-border border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground font-medium">Project-by-Project Changes</h4>
          <span className="text-muted-foreground text-sm">
            {projectsWithChanges.length} projects with changes
          </span>
        </div>
      </div>

      {/* Simplified project list - no nesting */}
      <div className="divide-border max-h-96 divide-y overflow-y-auto">
        {projectsWithChanges.map((preview, index) => {
          if (!preview.detailedChanges) return null

          const detail = preview.detailedChanges
          const isExpanded = expandedProject === detail.projectPath

          // Collect all changes (content + metadata, skip maintenance)
          const allChanges = [
            ...detail.changeCategories.content,
            ...detail.changeCategories.metadata
          ]

          return (
            <div key={`${detail.projectPath}-${index}`} className="bg-card">
              {/* Compact project header with inline summary */}
              <button
                onClick={() => setExpandedProject(isExpanded ? null : detail.projectPath)}
                className="hover:bg-accent/50 flex w-full items-center justify-between px-4 py-3 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ChevronRight
                    className={cn(
                      'text-muted-foreground h-4 w-4 flex-shrink-0 transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-foreground truncate text-sm font-medium">
                      {detail.projectName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {detail.summary.contentChanges > 0 && (
                        <span className="bg-destructive/20 text-destructive rounded px-1.5 py-0.5 text-xs">
                          {detail.summary.contentChanges} content
                        </span>
                      )}
                      {detail.summary.metadataChanges > 0 && (
                        <span className="bg-warning/20 text-warning rounded px-1.5 py-0.5 text-xs">
                          {detail.summary.metadataChanges} metadata
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-muted-foreground ml-2 text-sm">
                  {detail.summary.totalChanges} changes
                </span>
              </button>

              {/* Inline field changes - no category grouping */}
              {isExpanded && (
                <div className="space-y-2 px-4 pb-4">
                  {allChanges.map((change, changeIndex) => (
                    <div
                      key={`${change.field}-${changeIndex}`}
                      className="bg-muted/50 flex items-start gap-2 rounded-lg p-2 text-sm"
                    >
                      {getChangeIcon(change.type)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">
                            {change.fieldDisplayName}
                          </span>
                          {change.impact !== 'low' && (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-medium',
                                change.impact === 'high'
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-warning/20 text-warning'
                              )}
                            >
                              {change.impact}
                            </span>
                          )}
                        </div>
                        {change.type === 'modified' && (
                          <div className="mt-1 space-y-0.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">From:</span>
                              <span className="text-destructive font-mono line-through">
                                {change.formattedOldValue}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">To:</span>
                              <span className="text-success font-mono">
                                {change.formattedNewValue}
                              </span>
                            </div>
                          </div>
                        )}
                        {change.type === 'added' && (
                          <div className="mt-1 text-xs">
                            <span className="text-success font-mono">
                              {change.formattedNewValue}
                            </span>
                          </div>
                        )}
                        {change.type === 'removed' && (
                          <div className="mt-1 text-xs">
                            <span className="text-destructive font-mono line-through">
                              {change.formattedOldValue}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
