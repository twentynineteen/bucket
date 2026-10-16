/**
 * Filter and sort tests for the marketplace grid (issue #336).
 *
 * Behaviours: G3.1 (combined filters, AND), G3.2 (text search),
 * G3.3 (sort order: defaults, favourites, name).
 */
import { describe, expect, it } from 'vitest'
import type { CatalogueEntry, MotionCategory, MotionTarget } from '../types'
import {
  DEFAULT_FILTERS,
  filterEntries,
  sortEntries,
  type FilterCriteria
} from './filters'
import { deriveTargets } from './resolve'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function entry(
  id: string,
  overrides?: Partial<{
    name: string
    category: MotionCategory
    status: 'stable' | 'experimental'
    tags: string[]
    description: string
    source: 'builtin' | 'library'
    hasParticles: boolean
  }>
): CatalogueEntry {
  const layers = overrides?.hasParticles
    ? [
        {
          kind: 'particles' as const,
          id: 'p',
          anchor: { x: 0, y: 0 },
          points: [],
          seed: 1,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4
        }
      ]
    : [
        {
          kind: 'rect' as const,
          id: 'bg',
          anchor: { x: 0, y: 0 },
          width: 100,
          height: 100,
          fill: '#fff',
          radius: 0
        }
      ]

  return {
    template: {
      schemaVersion: 1,
      id,
      version: '1.0.0',
      name: overrides?.name ?? id.replace(/-/g, ' '),
      description: overrides?.description ?? `Description for ${id}`,
      category: overrides?.category ?? 'lower-third',
      status: overrides?.status ?? 'stable',
      tags: overrides?.tags ?? [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers
    },
    source: overrides?.source ?? 'builtin'
  }
}

function targets(e: CatalogueEntry): MotionTarget[] {
  return deriveTargets(e.template)
}

// ---------------------------------------------------------------------------
// G3.1 - Combined AND filters
// ---------------------------------------------------------------------------

describe('G3.1 filterEntries (combined AND)', () => {
  const entries = [
    entry('score-ring', {
      name: 'Score ring',
      category: 'data',
      status: 'stable',
      tags: ['data']
    }),
    entry('quote-card', {
      name: 'Quote card',
      category: 'title-card',
      status: 'stable',
      tags: ['text']
    }),
    entry('stat-reveal', {
      name: 'Stat reveal',
      category: 'data',
      status: 'experimental',
      tags: ['data']
    }),
    entry('spread-map', {
      name: 'Spread map',
      category: 'data',
      status: 'experimental',
      tags: ['data'],
      hasParticles: true
    })
  ]

  it('filters by category, status, favourites and target together (AND)', () => {
    // Only "score-ring" meets ALL: category=data, status=stable,
    // favourites (it is a favourite) and target=video
    const criteria: FilterCriteria = {
      category: 'data',
      status: 'stable',
      favouritesOnly: true,
      target: 'video',
      search: ''
    }
    const favourites = ['score-ring']
    const result = filterEntries(entries, criteria, favourites, targets)

    expect(result).toHaveLength(1)
    expect(result[0].template.id).toBe('score-ring')
  })

  it('returns all when filters are set to "all" and not favourites-only', () => {
    const result = filterEntries(entries, DEFAULT_FILTERS, [], targets)
    expect(result).toHaveLength(entries.length)
  })
})

// ---------------------------------------------------------------------------
// G3.2 - Text search
// ---------------------------------------------------------------------------

describe('G3.2 filterEntries (text search)', () => {
  const entries = [
    entry('score-ring', {
      name: 'Score ring',
      tags: ['gauge'],
      description: 'Animated gauge'
    }),
    entry('quote-card', {
      name: 'Quote card',
      tags: ['text'],
      description: 'A card for quotes'
    }),
    entry('chapter-title-card', {
      name: 'Chapter title card',
      tags: ['chapter'],
      description: 'Rings the bell'
    })
  ]

  it('matches by name (case-insensitive)', () => {
    const criteria: FilterCriteria = { ...DEFAULT_FILTERS, search: 'ring' }
    const result = filterEntries(entries, criteria, [], targets)
    // "Score ring" matches by name, "Chapter title card" matches by description
    expect(result.map(e => e.template.id)).toContain('score-ring')
    expect(result.map(e => e.template.id)).toContain('chapter-title-card')
  })

  it('matches by tag (case-insensitive)', () => {
    const criteria: FilterCriteria = { ...DEFAULT_FILTERS, search: 'gauge' }
    const result = filterEntries(entries, criteria, [], targets)
    expect(result).toHaveLength(1)
    expect(result[0].template.id).toBe('score-ring')
  })

  it('excludes templates that do not match name, tag or description', () => {
    const criteria: FilterCriteria = {
      ...DEFAULT_FILTERS,
      search: 'nonexistent'
    }
    const result = filterEntries(entries, criteria, [], targets)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// G3.3 - Sort order
// ---------------------------------------------------------------------------

describe('G3.3 sortEntries', () => {
  it('sorts defaults first, then favourites by name, then rest by name', () => {
    const entries = [
      entry('glide', { name: 'Glide', category: 'data' }),
      entry('chapter-title-card', { name: 'Chapter title card' }),
      entry('quote-card', { name: 'Quote card' }),
      entry('score-ring', { name: 'Score ring', category: 'data' })
    ]

    const defaults: Partial<Record<MotionCategory, string>> = {
      data: 'score-ring'
    }
    const favourites = ['quote-card', 'chapter-title-card']

    const sorted = sortEntries(entries, defaults, favourites)
    const ids = sorted.map(e => e.template.id)

    // Score ring (default) first, then favourites alphabetically,
    // then the rest alphabetically
    expect(ids).toEqual(['score-ring', 'chapter-title-card', 'quote-card', 'glide'])
  })
})
