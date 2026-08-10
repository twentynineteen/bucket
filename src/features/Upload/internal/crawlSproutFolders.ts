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
   * Milliseconds between requests. The default paces to ~120 requests/minute,
   * deliberately well under Sprout's 200 so an upload running alongside keeps
   * headroom. Faster would finish sooner and risk 429ing the user's own upload.
   */
  paceMs?: number
  /** Runaway guard on folders discovered. Reported, never silent. */
  maxFolders?: number
  /** Runaway guard on requests issued. Reported, never silent. */
  maxRequests?: number
  /** Cancels between requests; an in-flight request is allowed to settle. */
  signal?: AbortSignal
  onProgress?: (progress: CrawlProgress) => void
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
export const DEFAULT_MAX_FOLDERS = 5000
export const DEFAULT_MAX_REQUESTS = 2000

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
    sleep = defaultSleep
  } = options

  const found = new Map<string, SproutFolder>()
  // null is the root level. Ids already queued are never queued twice, so a
  // parent chain that loops back on itself cannot spin forever.
  const queue: Array<string | null> = [null]
  const queued = new Set<string>()
  let requests = 0
  let first = true

  const report = () => onProgress?.({ folders: found.size, requests })

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
    if (!first) await sleep(paceMs)
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

    for (const child of children) {
      if (found.has(child.id)) continue
      found.set(child.id, child)
      if (!queued.has(child.id)) {
        queued.add(child.id)
        queue.push(child.id)
      }
    }

    report()
  }

  return {
    folders: [...found.values()],
    requests,
    incomplete: false,
    stoppedBecause: 'complete'
  }
}
