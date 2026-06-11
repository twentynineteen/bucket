/**
 * Batch Update Confirmation Dialog
 *
 * Shows the changes Baker will write across the selected projects before
 * applying a batch update, using the shared per-file diff-row language.
 * Projects auto-expand when five or fewer have changes; larger batches
 * collapse to headers with +/~/− counts.
 */

import { AlertTriangle, CheckCircle, ChevronRight, Clock } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

import { cn } from '@shared/utils'
import type { BreadcrumbsPreview } from '../types'
import { buildProjectChangeRows, sumChangeCounts } from '../utils/changeRows'

import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/ui/dialog'
import { ChangeCounts, ChangeDiffList } from './ChangeDiffList'

import type { ProjectChangeRows } from '../utils/changeRows'

// Above this many changed projects the dialog collapses to accordion headers
const AUTO_EXPAND_THRESHOLD = 5

function confirmLabel(isLoading: boolean, changedCount: number): string {
  if (isLoading) return 'Updating...'
  if (changedCount === 0) return 'Nothing to Update'
  return `Update ${changedCount} Project${changedCount !== 1 ? 's' : ''}`
}

interface ProjectChangeBlockProps {
  projectName: string
  changes: ProjectChangeRows
  isExpanded: boolean
  isRebuild: boolean
  note?: string
  onToggle: () => void
}

const ProjectChangeBlock: React.FC<ProjectChangeBlockProps> = ({
  projectName,
  changes,
  isExpanded,
  isRebuild,
  note,
  onToggle
}) => (
  <div className="border-border overflow-hidden rounded-lg border">
    <button
      type="button"
      onClick={onToggle}
      className="hover:bg-accent/50 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
    >
      <ChevronRight
        className={cn(
          'text-muted-foreground h-4 w-4 flex-shrink-0 transition-transform',
          isExpanded && 'rotate-90'
        )}
      />
      <span className="text-foreground min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
        {projectName}
      </span>
      {(changes.hasHighImpact || isRebuild) && (
        <span className="bg-destructive/20 text-destructive flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
          high impact
        </span>
      )}
      <ChangeCounts counts={changes.counts} />
    </button>

    {isExpanded && (
      <div className="border-border border-t py-1.5">
        <ChangeDiffList
          rows={changes.rows}
          maintenanceFields={changes.maintenanceFields}
          note={note}
        />
      </div>
    )}
  </div>
)

interface BatchUpdateConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  selectedProjects: string[]
  previews?: BreadcrumbsPreview[]
  isLoading?: boolean
  /** Paths whose existing breadcrumbs file is unparseable and will be rebuilt */
  invalidBreadcrumbsPaths?: string[]
}

export const BatchUpdateConfirmationDialog: React.FC<
  BatchUpdateConfirmationDialogProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedProjects,
  previews = [],
  isLoading = false,
  invalidBreadcrumbsPaths = []
}) => {
  const projectChanges = useMemo(
    () =>
      previews.map((preview) => ({
        projectPath: preview.detailedChanges?.projectPath ?? preview.updated.parentFolder,
        projectName: preview.detailedChanges?.projectName ?? preview.updated.projectTitle,
        changes: buildProjectChangeRows(preview)
      })),
    [previews]
  )

  const projectsWithChanges = useMemo(
    () => projectChanges.filter((project) => project.changes.hasChanges),
    [projectChanges]
  )
  const skippedCount = selectedProjects.length - projectsWithChanges.length
  const totals = useMemo(
    () => sumChangeCounts(projectsWithChanges.map((project) => project.changes)),
    [projectsWithChanges]
  )
  const hasChanges = projectsWithChanges.length > 0
  const estimatedDuration =
    selectedProjects.length > 10 ? '2-3 minutes' : 'Less than 1 minute'

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen) return
    setExpandedPaths(
      projectsWithChanges.length <= AUTO_EXPAND_THRESHOLD
        ? new Set(projectsWithChanges.map((project) => project.projectPath))
        : new Set()
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, previews])

  const toggleProject = (projectPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(projectPath)) {
        next.delete(projectPath)
      } else {
        next.add(projectPath)
      }
      return next
    })
  }

  const noteFor = (projectPath: string, isNewBreadcrumbs: boolean) => {
    if (invalidBreadcrumbsPaths.includes(projectPath)) {
      return 'Existing breadcrumbs file is unparseable — it will be rebuilt (a backup will be saved).'
    }
    if (isNewBreadcrumbs) {
      return 'No breadcrumbs file — a new one will be created.'
    }
    return undefined
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {hasChanges ? (
              <AlertTriangle className="text-warning mr-2 h-5 w-5" />
            ) : (
              <CheckCircle className="text-success mr-2 h-5 w-5" />
            )}
            Confirm Batch Update
          </DialogTitle>
          <DialogDescription>
            Review the changes Baker will make before anything is written.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hasChanges && (
            <>
              {/* Summary line in diff language */}
              <div className="bg-muted flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{projectsWithChanges.length}</span>{' '}
                  project{projectsWithChanges.length !== 1 ? 's' : ''} with changes
                </span>
                <div className="bg-border h-3 w-px" />
                <ChangeCounts counts={totals} />
                <div className="bg-border h-3 w-px" />
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  {estimatedDuration}
                </span>
              </div>

              {skippedCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  {skippedCount} selected project{skippedCount !== 1 ? 's have' : ' has'}{' '}
                  no changes and will be skipped.
                </p>
              )}

              {/* Warning for large operations */}
              {selectedProjects.length > 20 && (
                <div className="bg-warning/10 border-warning/20 rounded-lg border p-3">
                  <div className="text-warning flex items-start">
                    <AlertTriangle className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0" />
                    <div className="text-sm">
                      <strong>Large batch operation:</strong> You're updating{' '}
                      {selectedProjects.length} projects. Consider running this operation
                      during off-peak hours to avoid performance impact.
                    </div>
                  </div>
                </div>
              )}

              {/* Per-project change blocks */}
              <div className="space-y-2.5">
                {projectsWithChanges.map((project) => (
                  <ProjectChangeBlock
                    key={project.projectPath}
                    projectName={project.projectName}
                    changes={project.changes}
                    isExpanded={expandedPaths.has(project.projectPath)}
                    isRebuild={invalidBreadcrumbsPaths.includes(project.projectPath)}
                    note={noteFor(project.projectPath, project.changes.isNewBreadcrumbs)}
                    onToggle={() => toggleProject(project.projectPath)}
                  />
                ))}
              </div>
            </>
          )}

          {!hasChanges && (
            <div className="text-muted-foreground py-8 text-center">
              <CheckCircle className="text-success mx-auto mb-3 h-12 w-12" />
              <p className="text-foreground mb-1 text-lg font-medium">
                No Changes Required
              </p>
              <p className="text-sm">
                All selected projects already have up-to-date breadcrumbs files.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !hasChanges}
            className={hasChanges ? 'bg-warning hover:bg-warning/90' : ''}
          >
            {confirmLabel(isLoading, projectsWithChanges.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
