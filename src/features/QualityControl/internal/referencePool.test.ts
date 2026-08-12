/**
 * Reference pool resolution (issue #180, B2)
 *
 * Pure tests: no Tauri, no filesystem, no mocks. The behaviour worth guarding
 * is which state each situation resolves to, because conflating them is the
 * defect issue #166 already produced once in the background folder.
 */

import { describe, expect, it } from 'vitest'

import {
  filterReferenceImages,
  resolveReferencePoolState,
  type ReferencePool,
  type ReferencePoolListing
} from './referencePool'

/** A resolved-and-happy baseline that each test perturbs one field of. */
function scenario(overrides: {
  pool?: ReferencePool
  settingsPending?: boolean
  settingsError?: boolean
  folder?: string | null
  isLoading?: boolean
  isError?: boolean
  listing?: ReferencePoolListing | null
}) {
  return resolveReferencePoolState({
    pool: 'watermarks',
    settingsPending: false,
    settingsError: false,
    folder: '/Volumes/Brand/QC references',
    isLoading: false,
    isError: false,
    listing: { status: 'ok', files: ['/Volumes/Brand/QC references/watermarks/wbs.png'] },
    ...overrides
  })
}

describe('resolveReferencePoolState', () => {
  it('B2.1 reports ready when the pool holds at least one reference', () => {
    expect(scenario({})).toEqual({ status: 'ready', reason: null })
  })

  it('B2.2 reports not-configured when no folder is set, distinct from empty', () => {
    const state = scenario({ folder: null })

    expect(state.status).toBe('not-configured')
    expect(state.reason).toMatch(/Settings/i)
  })

  it('B2.3 reports empty when the pool subfolder holds no images', () => {
    const state = scenario({ listing: { status: 'ok', files: [] } })

    expect(state.status).toBe('empty')
    // The reason must name the pool: "no images" is useless when two pools
    // exist and only one is empty.
    expect(state.reason).toMatch(/watermarks/i)
  })

  it('B2.3 names the sting pool when that is the empty one', () => {
    const state = scenario({ pool: 'stings', listing: { status: 'ok', files: [] } })

    expect(state.status).toBe('empty')
    expect(state.reason).toMatch(/stings/i)
  })

  it('B2.4 reports cannot-read when the subfolder is missing', () => {
    const state = scenario({ listing: { status: 'missing' } })

    expect(state.status).toBe('cannot-read')
    expect(state.reason).toContain('/Volumes/Brand/QC references')
  })

  it('B2.4 reports cannot-read when the subfolder is unreadable', () => {
    const state = scenario({ listing: { status: 'unreadable', detail: 'EACCES' } })

    expect(state.status).toBe('cannot-read')
    // Tauri error text is logged, never shown: it is not something a user acts on.
    expect(state.reason).not.toContain('EACCES')
  })

  it('B2.4 treats an unexpected query rejection as cannot-read', () => {
    expect(scenario({ isError: true, listing: null }).status).toBe('cannot-read')
  })

  it('B2.2 reports settings-error ahead of anything else', () => {
    // A folder we cannot know about must not be reported as not-configured:
    // that sends the user to re-enter a path that may be perfectly correct.
    const state = scenario({ settingsError: true, folder: null })

    expect(state.status).toBe('settings-error')
  })

  it('B2.2 claims nothing while settings are still loading', () => {
    const state = scenario({ settingsPending: true, folder: null })

    expect(state).toEqual({ status: 'unknown', reason: null })
  })

  it('B2.1 claims nothing while the listing is in flight', () => {
    const state = scenario({ isLoading: true, listing: null })

    expect(state).toEqual({ status: 'loading', reason: null })
  })
})

describe('filterReferenceImages', () => {
  it('B2.5 keeps jpg, jpeg and png references', () => {
    expect(filterReferenceImages(['a.jpg', 'b.jpeg', 'c.png'])).toEqual([
      'a.jpg',
      'b.jpeg',
      'c.png'
    ])
  })

  it('B2.5 ignores non-image files without discarding the rest', () => {
    // A stray .DS_Store or a notes file must not empty the pool.
    expect(
      filterReferenceImages(['.DS_Store', 'wbs.png', 'notes.txt', 'brand.ai'])
    ).toEqual(['wbs.png'])
  })

  it('B2.5 matches extensions case-insensitively', () => {
    expect(filterReferenceImages(['STING.JPG', 'Mark.PNG'])).toEqual([
      'STING.JPG',
      'Mark.PNG'
    ])
  })

  it('B2.5 ignores a file whose name is only an extension', () => {
    expect(filterReferenceImages(['.png'])).toEqual([])
  })

  it('B2.5 returns an empty list for an empty folder', () => {
    expect(filterReferenceImages([])).toEqual([])
  })
})
