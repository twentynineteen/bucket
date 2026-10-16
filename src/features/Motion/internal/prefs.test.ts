/**
 * Motion prefs tests (issue #333)
 *
 * Covers behaviours L1.1 - L1.7: defaults, invalid JSON, pruning, defaults
 * per category, favourite toggle, and remembered target selection.
 */
import { describe, expect, it, vi } from 'vitest'
import type { MotionFormat, MotionTarget } from '../types'
import {
  applyTargetSelection,
  DEFAULT_FORMAT,
  parsePrefs,
  prunePrefs,
  setDefault,
  toggleFavourite,
  type MotionPrefs
} from './prefs'

// ---------------------------------------------------------------------------
// L1.1 - Default prefs when file does not exist
// ---------------------------------------------------------------------------
describe('L1.1 parsePrefs defaults', () => {
  it('returns defaults for null input', () => {
    const prefs = parsePrefs(null)
    expect(prefs.libraryFolder).toBeNull()
    expect(prefs.defaultFormat).toEqual<MotionFormat>({
      width: 3840,
      height: 2160,
      fps: 50
    })
    expect(prefs.favourites).toEqual([])
    expect(prefs.defaults).toEqual({})
    expect(prefs.lastProjectFolder).toBeNull()
    expect(prefs.rememberedTargets).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// L1.2 - Invalid JSON or unknown shape returns defaults with warning
// ---------------------------------------------------------------------------
describe('L1.2 parsePrefs with invalid input', () => {
  it('returns defaults for invalid JSON string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prefs = parsePrefs('not valid json {{{')
    expect(prefs.libraryFolder).toBeNull()
    expect(prefs.defaultFormat.fps).toBe(50)
    warnSpy.mockRestore()
  })

  it('returns defaults for an unknown shape (array)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prefs = parsePrefs('[1, 2, 3]')
    expect(prefs.libraryFolder).toBeNull()
    expect(prefs.favourites).toEqual([])
    warnSpy.mockRestore()
  })

  it('logs a warning when input is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    parsePrefs('not valid json')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// L1.4 - Pruning stale favourites and defaults
// ---------------------------------------------------------------------------
describe('L1.4 prunePrefs', () => {
  it('removes favourites and defaults for templates not in the catalogue', () => {
    const prefs: MotionPrefs = {
      libraryFolder: null,
      defaultFormat: DEFAULT_FORMAT,
      favourites: ['a', 'b', 'gone'],
      defaults: { 'lower-third': 'gone2', data: 'b' },
      lastProjectFolder: null,
      rememberedTargets: null
    }
    const catalogueIds = new Set(['a', 'b', 'c'])
    const pruned = prunePrefs(prefs, catalogueIds)
    expect(pruned.favourites).toEqual(['a', 'b'])
    expect(pruned.defaults).toEqual({ data: 'b' })
  })

  it('does not prune when catalogueIds is null (Settings context)', () => {
    const prefs: MotionPrefs = {
      libraryFolder: null,
      defaultFormat: DEFAULT_FORMAT,
      favourites: ['a', 'b', 'gone'],
      defaults: { 'lower-third': 'gone2', data: 'b' },
      lastProjectFolder: null,
      rememberedTargets: null
    }
    const result = prunePrefs(prefs, null)
    expect(result.favourites).toEqual(['a', 'b', 'gone'])
    expect(result.defaults).toEqual({ 'lower-third': 'gone2', data: 'b' })
  })
})

// ---------------------------------------------------------------------------
// L1.5 - Setting and unsetting category defaults
// ---------------------------------------------------------------------------
describe('L1.5 setDefault', () => {
  it('replaces the existing default for the same category', () => {
    const prefs: MotionPrefs = {
      libraryFolder: null,
      defaultFormat: DEFAULT_FORMAT,
      favourites: [],
      defaults: { 'lower-third': 'x' },
      lastProjectFolder: null,
      rememberedTargets: null
    }
    const updated = setDefault(prefs, 'y', 'lower-third', true)
    expect(updated.defaults['lower-third']).toBe('y')
    expect(Object.values(updated.defaults).filter(v => v === 'x')).toHaveLength(0)
  })

  it('removes the default when toggled off', () => {
    const prefs: MotionPrefs = {
      libraryFolder: null,
      defaultFormat: DEFAULT_FORMAT,
      favourites: [],
      defaults: { 'lower-third': 'x' },
      lastProjectFolder: null,
      rememberedTargets: null
    }
    const updated = setDefault(prefs, 'x', 'lower-third', false)
    expect(updated.defaults['lower-third']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// L1.6 - Favourite toggle
// ---------------------------------------------------------------------------
describe('L1.6 toggleFavourite', () => {
  it('adds then removes a favourite', () => {
    let prefs: MotionPrefs = {
      libraryFolder: null,
      defaultFormat: DEFAULT_FORMAT,
      favourites: [],
      defaults: {},
      lastProjectFolder: null,
      rememberedTargets: null
    }
    prefs = toggleFavourite(prefs, 'a')
    expect(prefs.favourites).toContain('a')
    prefs = toggleFavourite(prefs, 'a')
    expect(prefs.favourites).not.toContain('a')
  })
})

// ---------------------------------------------------------------------------
// L1.7 - Remembered target selection intersection
// ---------------------------------------------------------------------------
describe('L1.7 applyTargetSelection', () => {
  it('returns the remembered set for a non-particle template', () => {
    const remembered: MotionTarget[] = ['ae', 'video']
    const supported: MotionTarget[] = ['ae', 'resolve', 'mogrt-via-ae', 'video', 'prompt']
    const result = applyTargetSelection(remembered, supported, false)
    expect(result).toEqual(['ae', 'video'])
  })

  it('returns the intersection for a particle template', () => {
    const remembered: MotionTarget[] = ['ae', 'video']
    const supported: MotionTarget[] = ['video', 'prompt']
    const result = applyTargetSelection(remembered, supported, true)
    expect(result).toEqual(['video'])
  })

  it('returns all supported when intersection is empty', () => {
    const remembered: MotionTarget[] = ['ae', 'resolve']
    const supported: MotionTarget[] = ['video', 'prompt']
    const result = applyTargetSelection(remembered, supported, true)
    expect(result).toEqual(['video', 'prompt'])
  })
})
