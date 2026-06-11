/**
 * Change Row Utilities
 *
 * Converts a BreadcrumbsPreview into per-file diff rows shared by the
 * project detail change preview and the batch update confirmation dialog.
 * Files are matched by path: present only in the new scan = added, present
 * only in breadcrumbs = removed, same path with a different camera = modified.
 */

import { categorizeField, formatFieldName, formatFieldValue } from '@shared/utils'

import type { BreadcrumbsPreview, FileInfo } from '../types'

export type ChangeRowType = 'added' | 'modified' | 'removed'

export interface ChangeRow {
  type: ChangeRowType
  label: string
  detail?: string
  impact: 'high' | 'medium' | 'low'
}

export interface ProjectChangeRows {
  rows: ChangeRow[]
  counts: { added: number; modified: number; removed: number }
  /** Display names of maintenance fields Baker will stamp on write */
  maintenanceFields: string[]
  /** True when no breadcrumbs file exists and one will be created */
  isNewBreadcrumbs: boolean
  /** True when at least one non-maintenance change will be written */
  hasChanges: boolean
  /** True when a change warrants extra reviewer attention */
  hasHighImpact: boolean
}

/**
 * Diff two file lists into per-file change rows.
 */
export function diffFileLists(
  current: FileInfo[] | null | undefined,
  updated: FileInfo[]
): ChangeRow[] {
  const currentByPath = new Map((current ?? []).map((file) => [file.path, file]))
  const updatedPaths = new Set(updated.map((file) => file.path))
  const rows: ChangeRow[] = []

  for (const file of updated) {
    const existing = currentByPath.get(file.path)
    if (!existing) {
      rows.push({ type: 'added', label: file.path, detail: 'new file', impact: 'low' })
    } else if (existing.camera !== file.camera) {
      rows.push({
        type: 'modified',
        label: file.path,
        detail: `camera ${existing.camera} → ${file.camera}`,
        impact: 'high'
      })
    }
  }

  for (const file of current ?? []) {
    if (!updatedPaths.has(file.path)) {
      rows.push({
        type: 'removed',
        label: file.path,
        detail: 'missing on disk',
        impact: 'medium'
      })
    }
  }

  return rows
}

function scalarRow(
  type: ChangeRowType,
  field: string,
  oldValue: unknown,
  newValue: unknown
): ChangeRow {
  const { impact } = categorizeField(field)
  const label = formatFieldName(field)

  if (type === 'modified') {
    return {
      type,
      label,
      detail: `${formatFieldValue(oldValue, field)} → ${formatFieldValue(newValue, field)}`,
      impact
    }
  }
  if (type === 'removed') {
    return { type, label, detail: formatFieldValue(oldValue, field), impact }
  }
  return { type, label, detail: formatFieldValue(newValue, field), impact }
}

/**
 * Build display rows for one project's preview. Counts are derived from the
 * per-file expansion so summary arithmetic matches the rows on screen.
 */
export function buildProjectChangeRows(preview: BreadcrumbsPreview): ProjectChangeRows {
  const meaningful = preview.meaningfulDiff ?? preview.diff
  const rows: ChangeRow[] = []

  for (const change of meaningful.changes) {
    if (change.type === 'unchanged') continue
    if (categorizeField(change.field).category === 'maintenance') continue

    if (change.field === 'files') {
      rows.push(...diffFileLists(preview.current?.files, preview.updated.files))
    } else {
      rows.push(scalarRow(change.type, change.field, change.oldValue, change.newValue))
    }
  }

  // Maintenance fields come from the full diff — meaningfulDiff filters them out
  const maintenanceFields = preview.diff.changes
    .filter(
      (change) =>
        change.type !== 'unchanged' &&
        categorizeField(change.field).category === 'maintenance'
    )
    .map((change) => formatFieldName(change.field))

  const counts = {
    added: rows.filter((row) => row.type === 'added').length,
    modified: rows.filter((row) => row.type === 'modified').length,
    removed: rows.filter((row) => row.type === 'removed').length
  }

  return {
    rows,
    counts,
    maintenanceFields,
    isNewBreadcrumbs: preview.current === null,
    hasChanges: rows.length > 0,
    hasHighImpact: rows.some((row) => row.type === 'modified' && row.impact === 'high')
  }
}

/**
 * Aggregate per-project counts for the batch dialog summary line.
 */
export function sumChangeCounts(
  projects: ProjectChangeRows[]
): ProjectChangeRows['counts'] {
  return projects.reduce(
    (acc, project) => ({
      added: acc.added + project.counts.added,
      modified: acc.modified + project.counts.modified,
      removed: acc.removed + project.counts.removed
    }),
    { added: 0, modified: 0, removed: 0 }
  )
}
