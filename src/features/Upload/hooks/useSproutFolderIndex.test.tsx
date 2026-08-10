/**
 * useSproutFolderIndex (issue #155, search)
 *
 * Exercises the **build** path, which nothing else did — so a missing import in
 * it survived a green suite and would have thrown the moment the button was
 * clicked. The behavioural half is the merge: a full pass over a 1200-folder
 * account runs for minutes, so an interrupted re-index must add to the saved
 * index rather than replace it with the little it managed to find.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({
  getFolders: vi.fn(),
  readFolderIndex: vi.fn(),
  writeFolderIndex: vi.fn()
}))

import type { SproutFolder } from '@shared/types'

import { getFolders, readFolderIndex, writeFolderIndex } from '../api'
import { accountFingerprint } from '../internal/folderIndex'
import { paceFromBudget, useSproutFolderIndex } from './useSproutFolderIndex'
import {
  __resetBudget,
  recordBudget,
  recordRateLimited
} from '../internal/sproutRateBudget'

const KEY = 'key-1'

const TREE: SproutFolder[] = [
  { id: 'p1', name: 'Postgraduate', parent_id: null },
  { id: 'm1', name: 'IB9X7', parent_id: 'p1' }
]

function page(folders: SproutFolder[]) {
  return {
    folders,
    total: folders.length,
    truncated: false,
    rate_limit_remaining: 190,
    rate_limit_reset: null
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  __resetBudget()
  vi.mocked(readFolderIndex).mockResolvedValue(null)
  vi.mocked(writeFolderIndex).mockResolvedValue(undefined)
  vi.mocked(getFolders).mockImplementation(async (_key, parentId) =>
    page(TREE.filter((f) => f.parent_id === parentId))
  )
})

describe('building an index', () => {
  it('crawls and saves, without throwing', async () => {
    // The regression this file exists for: the build path referenced two
    // identifiers that were never imported, which no other test touched.
    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })

    await act(async () => {
      result.current.build()
    })
    await waitFor(() => expect(result.current.isBuilding).toBe(false), {
      timeout: 10_000
    })

    expect(writeFolderIndex).toHaveBeenCalled()
    const saved = vi.mocked(writeFolderIndex).mock.calls.at(-1)![0] as {
      folders: SproutFolder[]
      partial: boolean
    }
    expect(saved.folders.map((f) => f.id).sort()).toEqual(['m1', 'p1'])
    expect(saved.partial).toBe(false)
  })

  it('exposes the crawled folders with full breadcrumb paths', async () => {
    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })

    await act(async () => {
      result.current.build()
    })
    await waitFor(() => expect(result.current.isBuilding).toBe(false), {
      timeout: 10_000
    })

    expect(result.current.folders.map((f) => f.path)).toContain('Postgraduate / IB9X7')
  })
})

describe('an interrupted re-index never shrinks the saved index', () => {
  it('merges a partial crawl into what was already known', async () => {
    // The reported bug: a re-index that stopped early replaced a good index with
    // the handful of folders it had reached, losing findable folders.
    vi.mocked(readFolderIndex).mockResolvedValue({
      version: 1,
      account: accountFingerprint(KEY),
      indexedAt: new Date().toISOString(),
      partial: false,
      folders: [
        { id: 'old1', name: 'Archive 2019', parent_id: null },
        { id: 'old2', name: 'Archive 2020', parent_id: null }
      ]
    })

    // Fails after the root level, so the crawl stops with a partial result.
    vi.mocked(getFolders).mockImplementation(async (_key, parentId) => {
      if (parentId === null) return page([{ id: 'p1', name: 'New', parent_id: null }])
      throw 'Sprout rate limit reached (HTTP 429).'
    })

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await act(async () => {
      result.current.build()
    })
    await waitFor(() => expect(result.current.isBuilding).toBe(false), {
      timeout: 10_000
    })

    const saved = vi.mocked(writeFolderIndex).mock.calls.at(-1)![0] as {
      folders: SproutFolder[]
      partial: boolean
    }
    // Previously findable folders survive, and the new one is added.
    expect(saved.folders.map((f) => f.id).sort()).toEqual(['old1', 'old2', 'p1'])
    expect(saved.partial).toBe(true)
  })

  it('says so when a crawl stopped early', async () => {
    vi.mocked(getFolders).mockRejectedValue('Sprout rate limit reached (HTTP 429).')

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await act(async () => {
      result.current.build()
    })
    await waitFor(() => expect(result.current.isBuilding).toBe(false), {
      timeout: 10_000
    })

    expect(result.current.incompleteReason).toMatch(/429|stopped early/i)
  })
})

describe('pacing adapts to the reported budget', () => {
  it('slows right down when the account budget is nearly spent', () => {
    // Browsing can wait; an upload cannot. Backing off protects the upload.
    recordBudget(10)
    expect(paceFromBudget()).toBeGreaterThanOrEqual(1500)
  })

  it('moves faster when there is plenty of headroom', () => {
    recordBudget(190)
    expect(paceFromBudget()).toBeLessThanOrEqual(250)
  })

  it('uses the conservative default when the budget is unknown', () => {
    // Guessing high is what would 429 an upload, so absence means caution.
    expect(paceFromBudget()).toBe(500)
  })

  it('backs off hard once a rate limit has actually been hit', () => {
    recordRateLimited()
    expect(paceFromBudget()).toBeGreaterThanOrEqual(1500)
  })
})

describe('no API key', () => {
  it('stays idle and reads nothing', () => {
    renderHook(() => useSproutFolderIndex(null), { wrapper })
    expect(readFolderIndex).not.toHaveBeenCalled()
  })
})
