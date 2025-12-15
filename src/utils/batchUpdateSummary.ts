/**
 * Batch Update Summary Utilities
 * Purpose: Calculate and format batch update summaries
 * Extracted from BatchUpdateConfirmationDialog to reduce complexity (DEBT-002)
 */

import type { BreadcrumbsPreview } from '@/types/baker'

export interface BatchUpdateSummary {
  totalProjects: number
  projectsWithChanges: number
  projectsWithoutChanges: number
  totalChanges: {
    added: number
    modified: number
    removed: number
  }
  commonChanges: {
    folderSizeCalculated: number
    filesUpdated: number
    timestampsUpdated: number
    createdByUpdated: number
  }
  estimatedDuration: string
}

/**
 * Calculate batch update summary from previews
 */
export function calculateBatchUpdateSummary(
  selectedProjects: string[],
  previews: BreadcrumbsPreview[]
): BatchUpdateSummary {
  const projectsWithChanges = previews.filter((p) => {
    const meaningfulDiff = p.meaningfulDiff || p.diff
    return meaningfulDiff.hasChanges
  }).length

  const projectsWithoutChanges = previews.filter((p) => {
    const meaningfulDiff = p.meaningfulDiff || p.diff
    return !meaningfulDiff.hasChanges
  }).length

  const totalChanges = previews.reduce(
    (acc, preview) => {
      const meaningfulDiff = preview.meaningfulDiff || preview.diff
      return {
        added: acc.added + meaningfulDiff.summary.added,
        modified: acc.modified + meaningfulDiff.summary.modified,
        removed: acc.removed + meaningfulDiff.summary.removed
      }
    },
    { added: 0, modified: 0, removed: 0 }
  )

  const commonChanges = {
    folderSizeCalculated: previews.filter((p) => {
      const meaningfulDiff = p.meaningfulDiff || p.diff
      return meaningfulDiff.changes.some(
        (c) => c.field === 'folderSizeBytes' && c.type === 'added'
      )
    }).length,
    filesUpdated: previews.filter((p) => {
      const meaningfulDiff = p.meaningfulDiff || p.diff
      return meaningfulDiff.changes.some(
        (c) => c.field === 'files' && c.type === 'modified'
      )
    }).length,
    timestampsUpdated: previews.filter((p) =>
      p.diff.changes.some((c) => c.field === 'lastModified')
    ).length,
    createdByUpdated: previews.filter((p) => {
      const meaningfulDiff = p.meaningfulDiff || p.diff
      return meaningfulDiff.changes.some(
        (c) => c.field === 'createdBy' && c.type === 'modified'
      )
    }).length
  }

  const estimatedDuration =
    selectedProjects.length > 10 ? '2-3 minutes' : 'Less than 1 minute'

  return {
    totalProjects: selectedProjects.length,
    projectsWithChanges,
    projectsWithoutChanges,
    totalChanges,
    commonChanges,
    estimatedDuration
  }
}

/**
 * Check if summary has any changes
 */
export function hasAnyChanges(summary: BatchUpdateSummary): boolean {
  return (
    summary.totalChanges.added > 0 ||
    summary.totalChanges.modified > 0 ||
    summary.totalChanges.removed > 0
  )
}
