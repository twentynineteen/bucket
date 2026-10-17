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

function matchesSearch(entry: CatalogueEntry, term: string): boolean {
  const lower = term.toLowerCase()
  const t = entry.template
  if (t.name.toLowerCase().includes(lower)) return true
  if (t.description.toLowerCase().includes(lower)) return true
  if (t.tags.some(tag => tag.toLowerCase().includes(lower))) return true
  return false
}

/** Filter catalogue entries by the given criteria (AND). */
export function filterEntries(
  entries: CatalogueEntry[],
  criteria: FilterCriteria,
  favourites: string[],
  derivedTargets: (entry: CatalogueEntry) => MotionTarget[]
): CatalogueEntry[] {
  const favSet = new Set(favourites)

  return entries.filter(entry => {
    const t = entry.template

    if (criteria.category !== 'all' && t.category !== criteria.category) {
      return false
    }

    if (criteria.status !== 'all' && t.status !== criteria.status) {
      return false
    }

    if (criteria.favouritesOnly && !favSet.has(t.id)) {
      return false
    }

    if (criteria.target !== 'all') {
      const targets = derivedTargets(entry)
      if (!targets.includes(criteria.target)) {
        return false
      }
    }

    if (criteria.search.trim() && !matchesSearch(entry, criteria.search.trim())) {
      return false
    }

    return true
  })
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
  const defaultIds = new Set(Object.values(defaults).filter(Boolean) as string[])
  const favSet = new Set(favourites)

  return [...entries].sort((a, b) => {
    const aId = a.template.id
    const bId = b.template.id
    const aDefault = defaultIds.has(aId)
    const bDefault = defaultIds.has(bId)
    const aFav = favSet.has(aId)
    const bFav = favSet.has(bId)

    // Defaults first
    if (aDefault && !bDefault) return -1
    if (!aDefault && bDefault) return 1

    // Favourites next
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1

    // Alphabetical by name
    return a.template.name.localeCompare(b.template.name)
  })
}
