/**
 * The one place that decides what state a scanned project's breadcrumbs are in,
 * and how that state is worded and coloured.
 *
 * The project list, the scan summary and the storage map all show this state.
 * They used to derive it separately, which let the summary count stale projects
 * as healthy while the list flagged them.
 */

import type { ProjectFolder } from '../types'

export type BreadcrumbsStatus = 'current' | 'stale' | 'missing' | 'unparseable'

export function breadcrumbsStatus(project: ProjectFolder): BreadcrumbsStatus {
  if (project.invalidBreadcrumbs) return 'unparseable'
  if (!project.hasBreadcrumbs) return 'missing'
  return project.staleBreadcrumbs ? 'stale' : 'current'
}

/** True when applying changes would write something for this project. */
export function needsAttention(project: ProjectFolder): boolean {
  return breadcrumbsStatus(project) !== 'current' || !project.isValid
}

interface StatusPresentation {
  /** Short label for list rows and legends. */
  label: string
  /** Text colour class. */
  text: string
  /** Solid fill class, for dots and legend swatches. */
  fill: string
  /** Tile classes for the storage map: fill plus a readable label colour. */
  tile: string
}

export const STATUS_PRESENTATION: Record<BreadcrumbsStatus, StatusPresentation> = {
  current: {
    label: 'Current',
    text: 'text-success',
    fill: 'bg-success',
    tile: 'bg-success/15 hover:bg-success/25 text-foreground'
  },
  stale: {
    label: 'Stale',
    text: 'text-warning',
    fill: 'bg-warning',
    tile: 'bg-warning/25 hover:bg-warning/35 text-foreground'
  },
  missing: {
    label: 'No breadcrumbs',
    text: 'text-muted-foreground',
    fill: 'bg-muted-foreground',
    tile: 'bg-muted hover:bg-muted/70 text-foreground'
  },
  unparseable: {
    label: 'Unparseable',
    text: 'text-destructive',
    fill: 'bg-destructive',
    tile: 'bg-destructive/20 hover:bg-destructive/30 text-foreground'
  }
}
