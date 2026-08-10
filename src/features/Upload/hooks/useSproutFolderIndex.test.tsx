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
  writeFolderIndex: vi.fn(),
  saveFileDialog: vi.fn(),
  openJsonFileDialog: vi.fn(),
  writeFolderIndexTo: vi.fn(),
  readFolderIndexFrom: vi.fn()
}))

import type { SproutFolder } from '@shared/types'

import {
  getFolders,
  openJsonFileDialog,
  readFolderIndex,
  readFolderIndexFrom,
  saveFileDialog,
  writeFolderIndex,
  writeFolderIndexTo
} from '../api'
import { accountFingerprint, createFolderIndex } from '../internal/folderIndex'
import { paceFromBudget, useSproutFolderIndex } from './useSproutFolderIndex'
import {
  __resetBudget,
  recordBudget,
  recordRateLimited
} from '../internal/sproutRateBudget'

const KEY = 'key-1'
const NOW_ISO = '2026-08-10T09:30:00.000Z'

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
  vi.mocked(saveFileDialog).mockResolvedValue('/tmp/index.json')
  vi.mocked(openJsonFileDialog).mockResolvedValue('/tmp/theirs.json')
  vi.mocked(writeFolderIndexTo).mockResolvedValue(undefined)
})

/** Runs an action and waits for its message to settle. */
async function runTransfer(
  result: { current: ReturnType<typeof useSproutFolderIndex> },
  action: 'exportIndex' | 'importIndex'
) {
  await act(async () => {
    result.current[action]()
  })
  await waitFor(() => expect(result.current.isTransferring).toBe(false), {
    timeout: 10_000
  })
}

describe('sharing an index with the team', () => {
  const THEIR_INDEX = createFolderIndex('their-different-key', TREE, false, NOW_ISO)

  it('exports the saved index to the chosen file', async () => {
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(KEY, TREE, false, NOW_ISO)
    )

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'exportIndex')

    expect(writeFolderIndexTo).toHaveBeenCalledWith('/tmp/index.json', expect.anything())
    expect(result.current.transferMessage).toMatch(/Exported 2 folders/)
    expect(result.current.transferFailed).toBe(false)
  })

  it('refuses to export when nothing has been indexed', async () => {
    vi.mocked(readFolderIndex).mockResolvedValue(null)

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'exportIndex')

    expect(writeFolderIndexTo).not.toHaveBeenCalled()
    expect(result.current.transferFailed).toBe(true)
  })

  it('writes nothing when the save dialog is cancelled', async () => {
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(KEY, TREE, false, NOW_ISO)
    )
    vi.mocked(saveFileDialog).mockResolvedValue(null)

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'exportIndex')

    expect(writeFolderIndexTo).not.toHaveBeenCalled()
  })

  it("imports a colleague's index even though their API key differs", async () => {
    // Fingerprints are per key, so requiring a match would strand a legitimate
    // share between two people on the same Sprout account.
    vi.mocked(readFolderIndex).mockResolvedValue(null)
    vi.mocked(readFolderIndexFrom).mockResolvedValue(THEIR_INDEX)

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'importIndex')

    expect(writeFolderIndex).toHaveBeenCalled()
    expect(result.current.transferFailed).toBe(false)
    expect(result.current.transferMessage).toMatch(/Imported 2 folders/)
  })

  it('refuses an index from a different account instead of importing it', async () => {
    // Its folder ids do not exist here, so uploads would be filed against ids
    // Sprout rejects.
    vi.mocked(readFolderIndex).mockResolvedValue(null)
    vi.mocked(readFolderIndexFrom).mockResolvedValue(
      createFolderIndex(
        'k',
        [{ id: 'not-ours', name: 'Elsewhere', parent_id: null }],
        false,
        NOW_ISO
      )
    )

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'importIndex')

    expect(writeFolderIndex).not.toHaveBeenCalled()
    expect(result.current.transferFailed).toBe(true)
    expect(result.current.transferMessage).toMatch(/different Sprout Video account/i)
  })

  it('reports a file it cannot read rather than importing nothing silently', async () => {
    vi.mocked(readFolderIndex).mockResolvedValue(null)
    vi.mocked(readFolderIndexFrom).mockResolvedValue({ not: 'an index' })

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'importIndex')

    expect(writeFolderIndex).not.toHaveBeenCalled()
    expect(result.current.transferMessage).toMatch(/not a folder index/i)
  })

  it('keeps locally known folders when importing a partial index', async () => {
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(
        KEY,
        [{ id: 'mine', name: 'Local only', parent_id: null }],
        false,
        NOW_ISO
      )
    )
    vi.mocked(readFolderIndexFrom).mockResolvedValue(
      createFolderIndex('their-key', TREE, true, NOW_ISO)
    )
    // 'mine' is a real root here, and so is p1, so the import verifies.
    vi.mocked(getFolders).mockResolvedValue(
      page([
        { id: 'mine', name: 'Local only', parent_id: null },
        { id: 'p1', name: 'Postgraduate', parent_id: null }
      ])
    )

    const { result } = renderHook(() => useSproutFolderIndex(KEY), { wrapper })
    await runTransfer(result, 'importIndex')

    const saved = vi.mocked(writeFolderIndex).mock.calls.at(-1)![0] as {
      folders: SproutFolder[]
    }
    expect(saved.folders.map((f) => f.id).sort()).toEqual(['m1', 'mine', 'p1'])
  })
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
