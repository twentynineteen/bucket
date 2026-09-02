/**
 * Sprout title naming-guide preference (issue #270, B1/B2)
 *
 * Mirrors useKavanaghForUpload's preference: a localStorage-backed choice, read
 * defensively so a corrupt or partial stored value never throws and never turns
 * the guide into a broken state. Two fields rather than one - whether the guide
 * shows, and which category is selected - so the load has to tolerate a legacy
 * object that only carries one of them.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/utils', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}))

const { useTitleNamingGuide } = await import('./useTitleNamingGuide')

const PREFS_KEY = 'sprout-title-guide-preferences'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('naming-guide preference', () => {
  it('B1.1 shows the guide by default when nothing is stored', () => {
    const { result } = renderHook(() => useTitleNamingGuide())

    expect(result.current.showGuide).toBe(true)
  })

  it('B1.2/B1.3 remembers being switched off across a reload', async () => {
    const first = renderHook(() => useTitleNamingGuide())
    act(() => first.result.current.setShowGuide(false))
    await waitFor(() => expect(first.result.current.showGuide).toBe(false))

    // A second mount is what a reload looks like from here.
    const second = renderHook(() => useTitleNamingGuide())

    expect(second.result.current.showGuide).toBe(false)
  })

  it('B2.4 remembers the last-selected category across a reload', async () => {
    const first = renderHook(() => useTitleNamingGuide())
    act(() => first.result.current.setCategory('ptes'))
    await waitFor(() => expect(first.result.current.category).toBe('ptes'))

    const second = renderHook(() => useTitleNamingGuide())

    expect(second.result.current.category).toBe('ptes')
  })

  it('B2.4 tolerates a partial/legacy stored object', () => {
    // Only showGuide stored, no category - the category must fall back rather
    // than becoming undefined.
    localStorage.setItem(PREFS_KEY, JSON.stringify({ showGuide: false }))

    const { result } = renderHook(() => useTitleNamingGuide())

    expect(result.current.showGuide).toBe(false)
    expect(result.current.category).toBeTruthy()
  })

  it('ignores an unknown stored category and falls back to a known one', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ category: 'no-such-category' }))

    const { result } = renderHook(() => useTitleNamingGuide())

    expect(result.current.category).not.toBe('no-such-category')
    expect(result.current.category).toBeTruthy()
  })

  it('stays on the default rather than throwing when the stored value is corrupt', () => {
    localStorage.setItem(PREFS_KEY, 'not json')

    const { result } = renderHook(() => useTitleNamingGuide())

    expect(result.current.showGuide).toBe(true)
    expect(result.current.category).toBeTruthy()
  })
})
