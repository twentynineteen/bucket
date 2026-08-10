/**
 * Folder tree crawl (issue #155, search)
 *
 * The crawl is the one part of this feature that can spend a lot of Sprout's
 * 200-requests-per-minute account budget, so the tests are mostly about it
 * stopping: on cancellation, on bounds, on error, and on a malformed parent
 * chain that would otherwise loop forever.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SproutFolder } from '@shared/types'

import { crawlSproutFolders } from './crawlSproutFolders'

/** Builds a fetcher over a flat folder list, as Sprout would serve it. */
function fetcherFor(folders: SproutFolder[]) {
  return vi.fn(async (parentId: string | null) =>
    folders.filter((folder) => folder.parent_id === parentId)
  )
}

const TREE: SproutFolder[] = [
  { id: 'p1', name: 'Postgraduate', parent_id: null },
  { id: 'p2', name: 'Undergraduate', parent_id: null },
  { id: 'm1', name: 'IB9X7', parent_id: 'p1' },
  { id: 'm2', name: 'IB9Y2', parent_id: 'p1' },
  { id: 'y1', name: '2026', parent_id: 'm1' },
  { id: 'y2', name: '2025', parent_id: 'm1' }
]

/** No real waiting in tests; pacing is asserted by counting calls. */
const noSleep = vi.fn(async () => undefined)

describe('walking the tree', () => {
  it('finds every folder at every depth', async () => {
    const result = await crawlSproutFolders({
      fetchLevel: fetcherFor(TREE),
      sleep: noSleep
    })

    expect(result.stoppedBecause).toBe('complete')
    expect(result.incomplete).toBe(false)
    expect(result.folders.map((f) => f.id).sort()).toEqual(
      ['m1', 'm2', 'p1', 'p2', 'y1', 'y2'].sort()
    )
  })

  it('issues one request per level, not per folder', async () => {
    // Root + 2 top-level + 2 modules + 2 years = 7 levels probed.
    const fetchLevel = fetcherFor(TREE)
    const result = await crawlSproutFolders({ fetchLevel, sleep: noSleep })

    expect(fetchLevel).toHaveBeenCalledTimes(7)
    expect(result.requests).toBe(7)
  })

  it('starts at the account root', async () => {
    const fetchLevel = fetcherFor(TREE)
    await crawlSproutFolders({ fetchLevel, sleep: noSleep })

    expect(fetchLevel.mock.calls[0][0]).toBeNull()
  })

  it('reports progress as it goes', async () => {
    const onProgress = vi.fn()
    await crawlSproutFolders({ fetchLevel: fetcherFor(TREE), sleep: noSleep, onProgress })

    expect(onProgress).toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)![0]
    expect(last.folders).toBe(6)
    expect(last.requests).toBe(7)
  })

  it('handles an empty account without error', async () => {
    const result = await crawlSproutFolders({
      fetchLevel: fetcherFor([]),
      sleep: noSleep
    })

    expect(result.folders).toEqual([])
    expect(result.stoppedBecause).toBe('complete')
  })
})

describe('pacing', () => {
  it('waits between requests but not before the first', async () => {
    const sleep = vi.fn(async () => undefined)
    await crawlSproutFolders({ fetchLevel: fetcherFor(TREE), sleep })

    // 7 requests, so 6 gaps. Pacing before the first would only add latency.
    expect(sleep).toHaveBeenCalledTimes(6)
  })

  it('paces slowly enough to leave headroom under 200 requests/minute', async () => {
    const sleep = vi.fn(async () => undefined)
    await crawlSproutFolders({ fetchLevel: fetcherFor(TREE), sleep })

    const [[delay]] = sleep.mock.calls as unknown as [[number]]
    // 500ms => ~120/min, leaving ~80/min for an upload running alongside.
    expect(delay).toBeGreaterThanOrEqual(500)
    expect(60_000 / delay).toBeLessThan(200)
  })
})

describe('stopping', () => {
  it('stops promptly when cancelled', async () => {
    const controller = new AbortController()
    const fetchLevel = vi.fn(async (parentId: string | null) => {
      controller.abort() // cancel during the first level
      return TREE.filter((f) => f.parent_id === parentId)
    })

    const result = await crawlSproutFolders({
      fetchLevel,
      sleep: noSleep,
      signal: controller.signal
    })

    expect(result.stoppedBecause).toBe('cancelled')
    expect(result.incomplete).toBe(true)
    // Whatever was found before cancelling is still returned and usable.
    expect(result.folders.length).toBeGreaterThan(0)
    expect(fetchLevel).toHaveBeenCalledTimes(1)
  })

  it('stops at the request bound and says so', async () => {
    const result = await crawlSproutFolders({
      fetchLevel: fetcherFor(TREE),
      sleep: noSleep,
      maxRequests: 3
    })

    expect(result.stoppedBecause).toBe('maxRequests')
    expect(result.incomplete).toBe(true)
    expect(result.requests).toBe(3)
  })

  it('stops at the folder bound and says so', async () => {
    const result = await crawlSproutFolders({
      fetchLevel: fetcherFor(TREE),
      sleep: noSleep,
      maxFolders: 2
    })

    expect(result.stoppedBecause).toBe('maxFolders')
    expect(result.incomplete).toBe(true)
  })

  it('returns a partial result rather than throwing when a level fails', async () => {
    // A rate limit part-way through must not throw away everything found.
    let call = 0
    const fetchLevel = vi.fn(async (parentId: string | null) => {
      call += 1
      if (call > 2) throw 'Sprout rate limit reached (HTTP 429).'
      return TREE.filter((f) => f.parent_id === parentId)
    })

    const result = await crawlSproutFolders({ fetchLevel, sleep: noSleep })

    expect(result.stoppedBecause).toBe('error')
    expect(result.error).toContain('429')
    expect(result.folders.length).toBeGreaterThan(0)
  })
})

describe('malformed data', () => {
  it('does not loop forever on a folder that is its own ancestor', async () => {
    const cyclic: SproutFolder[] = [
      { id: 'a', name: 'A', parent_id: null },
      { id: 'b', name: 'B', parent_id: 'a' },
      // 'a' claims 'b' as its parent as well -- a cycle.
      { id: 'a', name: 'A again', parent_id: 'b' }
    ]

    const result = await crawlSproutFolders({
      fetchLevel: fetcherFor(cyclic),
      sleep: noSleep,
      maxRequests: 50
    })

    // Terminating at all is the assertion; the bound must not be what saved us.
    expect(result.stoppedBecause).toBe('complete')
    expect(result.requests).toBeLessThan(50)
  })

  it('never queues the same folder twice', async () => {
    const duplicated: SproutFolder[] = [
      { id: 'a', name: 'A', parent_id: null },
      { id: 'a', name: 'A duplicate', parent_id: null }
    ]

    const fetchLevel = fetcherFor(duplicated)
    await crawlSproutFolders({ fetchLevel, sleep: noSleep })

    const probed = fetchLevel.mock.calls.map(([id]) => id)
    expect(probed).toEqual([null, 'a'])
  })
})
