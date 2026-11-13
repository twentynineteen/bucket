/**
 * The one place that decides what state a scanned project's breadcrumbs are in,
 * and how that state is worded and coloured.
 *
 * The project list, its filter chips, the scan summary, the detail header and
 * the storage map all show this state. They used to derive and name it
 * separately, which let the summary count stale projects as healthy while the
 * list flagged them, and gave one state three different names.
 */

import type { ProjectFolder } from '../types'

export type BreadcrumbsStatus = 'current' | 'stale' | 'missing' | 'unparseable'

export function breadcrumbsStatus(project: ProjectFolder): BreadcrumbsStatus {
  if (project.invalidBreadcrumbs) return 'unparseable'
  if (!project.hasBreadcrumbs) return 'missing'
  return project.staleBreadcrumbs ? 'stale' : 'current'
}

/** True when the project has something to fix: its breadcrumbs or its structure. */
export function needsAttention(project: ProjectFolder): boolean {
  return breadcrumbsStatus(project) !== 'current' || !project.isValid
}

interface StatusPresentation {
  /** The single word used for this state everywhere it appears. */
  label: string
  /** Text colour class. Current is deliberately quiet: only exceptions get colour. */
  text: string
  /**
   * Classes for the small marker beside the label (list dots, legend swatches).
   * Missing is a hollow ring: there is no file, and it still needs action.
   */
  marker: string
  /** Tile classes for the storage map: fill plus a readable label colour. */
  tile: string
}

export const STATUS_PRESENTATION: Record<BreadcrumbsStatus, StatusPresentation> = {
  current: {
    label: 'Current',
    text: 'text-muted-foreground',
    marker: 'bg-success',
    tile: 'border-background bg-success/15 hover:bg-success/25 text-foreground'
  },
  stale: {
    label: 'Stale',
    text: 'text-warning',
    marker: 'bg-warning',
    tile: 'border-background bg-warning/25 hover:bg-warning/35 text-foreground'
  },
  missing: {
    label: 'Missing',
    text: 'text-warning',
    marker: 'border-warning border-[1.5px] bg-transparent',
    tile: 'border-warning/70 bg-warning/5 hover:bg-warning/15 text-foreground border-dashed'
  },
  unparseable: {
    label: 'Unparseable',
    text: 'text-destructive',
    marker: 'bg-destructive',
    tile: 'border-background bg-destructive/20 hover:bg-destructive/30 text-foreground'
  }
}
