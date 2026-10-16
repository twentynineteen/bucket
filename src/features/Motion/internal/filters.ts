/**
 * Filter predicate and sort for the marketplace grid (issue #336).
 *
 * Combines category, status, favourites-only, target and text search
 * with AND logic. Sort order: defaults first, then favourites, then
 * alphabetical by name.
 */
import type { CatalogueEntry, MotionCategory, MotionStatus, MotionTarget } from '../types'

// ---------------------------------------------------------------------------
// Filter criteria
// ---------------------------------------------------------------------------

export interface FilterCriteria {
  category: MotionCategory | 'all'
  status: MotionStatus | 'all'
  favouritesOnly: boolean
  target: MotionTarget | 'all'
  search: string
}

export const DEFAULT_FILTERS: FilterCriteria = {
  category: 'all',
  status: 'all',
  favouritesOnly: false,
  target: 'all',
  search: ''
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/** Filter catalogue entries by the given criteria (AND). */
export function filterEntries(
  entries: CatalogueEntry[],
  criteria: FilterCriteria,
  favourites: string[],
  derivedTargets: (entry: CatalogueEntry) => MotionTarget[]
): CatalogueEntry[] {
  void entries
  void criteria
  void favourites
  void derivedTargets
  throw new Error('not implemented')
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** Sort entries: defaults first, then favourites by name, then rest by name. */
export function sortEntries(
  entries: CatalogueEntry[],
  defaults: Partial<Record<MotionCategory, string>>,
  favourites: string[]
): CatalogueEntry[] {
  void entries
  void defaults
  void favourites
  throw new Error('not implemented')
}
