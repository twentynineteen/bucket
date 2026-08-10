/**
 * Folder tree crawl (issue #155, search)
 *
 * Sprout has no folder search parameter, no flat folder listing and no global
 * search endpoint, so reaching a folder the user has never opened means walking
 * the tree one level at a time. That is expensive against a **200 request per
 * minute, account-wide** limit shared with uploads, which is why this runs once
 * to build a saved index rather than on every search.
 *
 * Everything costly is injected -- the level fetcher and the sleep -- so the
 * pacing, cancellation and bounds can be tested without a network or a wait.
 */
import type { SproutFolder } from '@shared/types'

/** Fetches the direct children of `parentId`; null means the account root. */
export type FetchLevel = (parentId: string | null) => Promise<SproutFolder[]>

export interface CrawlProgress {
  /** Folders discovered so far. */
  folders: number
  /** Levels fetched so far — one request each, the thing the limit counts. */
  requests: number
}

export interface CrawlOptions {
  fetchLevel: FetchLevel
  /**
   * Milliseconds between requests, or a function returning it so the caller can
   * adapt to Sprout's reported remaining budget.
   *
   * The default paces to ~120 requests/minute, well under Sprout's 200 so an
   * upload running alongside keeps headroom. Faster finishes sooner and risks
   * 429ing the user's own upload.
   */
  paceMs?: number | (() => number)
  /** Runaway guard on folders discovered. Reported, never silent. */
  maxFolders?: number
  /** Runaway guard on requests issued. Reported, never silent. */
  maxRequests?: number
  /** Cancels between requests; an in-flight request is allowed to settle. */
  signal?: AbortSignal
  onProgress?: (progress: CrawlProgress) => void
  /**
   * Called with everything found so far, every `checkpointEvery` requests.
   *
   * A full pass over a large account takes minutes, so it will often be
   * interrupted. Checkpointing means an interrupted crawl keeps its progress
   * instead of starting over.
   */
  onCheckpoint?: (folders: SproutFolder[]) => void | Promise<void>
  /** Requests between checkpoints. */
  checkpointEvery?: number
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>
}

export interface CrawlResult {
  folders: SproutFolder[]
  requests: number
  /** True when a bound or a cancellation stopped the walk early. */
  incomplete: boolean
  /** Why it stopped, for an honest message in the UI. */
  stoppedBecause: 'complete' | 'cancelled' | 'maxFolders' | 'maxRequests' | 'error'
  /** Set when stoppedBecause is 'error'; the partial result is still returned. */
  error?: string
}

export const DEFAULT_PACE_MS = 500
export const DEFAULT_CHECKPOINT_EVERY = 100
export const DEFAULT_MAX_FOLDERS = 20_000
// One request per folder plus the root, so this must exceed the folder bound or
// the request cap would stop a crawl the folder cap was sized to allow. A real
// account here has ~1200 folders.
export const DEFAULT_MAX_REQUESTS = 20_001

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Walks the folder tree breadth-first from the account root.
 *
 * Always resolves, never rejects: a failure part-way through still returns
 * everything found so far, because a partial index is more useful than none and
 * the caller can say so plainly.
 */
export async function crawlSproutFolders(options: CrawlOptions): Promise<CrawlResult> {
  const {
    fetchLevel,
    paceMs = DEFAULT_PACE_MS,
    maxFolders = DEFAULT_MAX_FOLDERS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    signal,
    onProgress,
    onCheckpoint,
    checkpointEvery = DEFAULT_CHECKPOINT_EVERY,
    sleep = defaultSleep
  } = options

  const paceFor = () => (typeof paceMs === 'function' ? paceMs() : paceMs)

  const found = new Map<string, SproutFolder>()
  // null is the root level. Ids already queued are never queued twice, so a
  // parent chain that loops back on itself cannot spin forever.
  const queue: Array<string | null> = [null]
  const queued = new Set<string>()
  let requests = 0
  let first = true

  const report = () => onProgress?.({ folders: found.size, requests })

  /** Records the newly seen children of a level, queuing each one once. */
  const absorb = (children: SproutFolder[]) => {
    for (const child of children) {
      if (found.has(child.id)) continue
      found.set(child.id, child)
      if (queued.has(child.id)) continue
      queued.add(child.id)
      queue.push(child.id)
    }
  }

  /** Whether to stop before issuing another request, and why. */
  const stopReason = (): CrawlResult['stoppedBecause'] | null => {
    if (signal?.aborted) return 'cancelled'
    if (requests >= maxRequests) return 'maxRequests'
    if (found.size >= maxFolders) return 'maxFolders'
    return null
  }

  while (queue.length > 0) {
    const stop = stopReason()
    if (stop) {
      return {
        folders: [...found.values()],
        requests,
        incomplete: true,
        stoppedBecause: stop
      }
    }

    // Pace between requests, not before the first -- the first level should feel
    // immediate, and there is nothing to pace away from yet.
    if (!first) await sleep(paceFor())
    first = false

    const parentId = queue.shift() as string | null

    let children: SproutFolder[]
    try {
      children = await fetchLevel(parentId)
      requests += 1
    } catch (error) {
      return {
        folders: [...found.values()],
        requests,
        incomplete: true,
        stoppedBecause: 'error',
        error:
          typeof error === 'string' ? error : (error as Error)?.message || 'Unknown error'
      }
    }

    absorb(children)
    report()

    // Awaited, not fired and forgotten: the checkpoint writes a file, and
    // overlapping writes would corrupt it.
    if (onCheckpoint && requests % checkpointEvery === 0) {
      await onCheckpoint([...found.values()])
    }
  }

  return {
    folders: [...found.values()],
    requests,
    incomplete: false,
    stoppedBecause: 'complete'
  }
}
