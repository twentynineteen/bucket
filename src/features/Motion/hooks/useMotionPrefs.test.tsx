/**
 * useMotionPrefs hook tests (issue #333)
 *
 * Covers behaviour L1.3: prefs are saved to motion_prefs.json via
 * writeTextFile, never to api_keys.json.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { readMotionPrefsText, writeMotionPrefsText } from '../api'
import { useMotionPrefs } from './useMotionPrefs'

// Mock the api module - the I/O boundary
vi.mock('../api', () => ({
  readMotionPrefsText: vi.fn(),
  writeMotionPrefsText: vi.fn()
}))

const mockedRead = vi.mocked(readMotionPrefsText)
const mockedWrite = vi.mocked(writeMotionPrefsText)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// M4 - prunePrefs is wired into the save path
// ---------------------------------------------------------------------------
describe('M4 prunePrefs wired into save', () => {
  it('prunes favourites that reference templates no longer in the catalogue', async () => {
    const prefsWithStaleFavourite = JSON.stringify({
      libraryFolder: null,
      defaultFormat: { width: 3840, height: 2160, fps: 50 },
      favourites: ['existing-template', 'deleted-template'],
      defaults: { 'lower-third': 'deleted-template' },
      lastProjectFolder: null,
      rememberedTargets: null
    })
    mockedRead.mockResolvedValue(prefsWithStaleFavourite)
    mockedWrite.mockResolvedValue(undefined)

    const { result } = renderHook(() => useMotionPrefs(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Save with catalogue IDs that exclude the deleted template
    const catalogueIds = new Set(['existing-template'])
    await act(async () => {
      await result.current.saveWithPrune(catalogueIds)
    })

    expect(mockedWrite).toHaveBeenCalledTimes(1)
    const written = JSON.parse(mockedWrite.mock.calls[0][0])
    // The deleted template should be pruned from favourites and defaults
    expect(written.favourites).toEqual(['existing-template'])
    expect(written.defaults).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// L1.3 - Save writes to motion_prefs.json, never api_keys.json
// ---------------------------------------------------------------------------
describe('L1.3 useMotionPrefs save', () => {
  it('calls writeMotionPrefsText with JSON ending in motion_prefs.json semantics', async () => {
    mockedRead.mockResolvedValue(null)
    mockedWrite.mockResolvedValue(undefined)

    const { result } = renderHook(() => useMotionPrefs(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updatePrefs({
        libraryFolder: '/Users/e/motion'
      })
    })

    expect(mockedWrite).toHaveBeenCalledTimes(1)
    const written = mockedWrite.mock.calls[0][0]
    expect(() => JSON.parse(written)).not.toThrow()
    const parsed = JSON.parse(written)
    expect(parsed.libraryFolder).toBe('/Users/e/motion')
  })
})
