/**
 * useSproutFolderIndex (issue #155, search)
 *
 * Owns the saved folder index: loading it, building it, and reporting how stale
 * it is. Search reads the index so it can reach folders the user has never
 * opened, which Sprout's API cannot do any other way — it has no folder search
 * parameter, no flat folder listing and no global search endpoint.
 *
 * Building costs one request per level against a **200 request/minute,
 * account-wide** budget shared with uploads, so it is always explicit, paced,
 * cancellable, and done once rather than per search.
 */
import { CACHE } from '@shared/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'

import { getFolders, readFolderIndex, writeFolderIndex } from '../api'
import type { CrawlProgress } from '../internal/crawlSproutFolders'
import { crawlSproutFolders } from '../internal/crawlSproutFolders'
import type { FolderIndex } from '../internal/folderIndex'
import {
  createFolderIndex,
  indexAgeInDays,
  parseFolderIndex
} from '../internal/folderIndex'
import { withPaths } from '../internal/folderPaths'
import type { SelectedSproutFolder } from '../types'

/** Suggest a rebuild past this age; folder structures drift slowly. */
export const INDEX_STALE_AFTER_DAYS = 14

const indexQueryKey = (account: string) => ['sprout', 'folder-index', account] as const

export interface UseSproutFolderIndexResult {
  /** Indexed folders with breadcrumb paths, empty when there is no index. */
  folders: SelectedSproutFolder[]
  /** The loaded index, or null when none applies to this account. */
  index: FolderIndex | null
  /** Whole days since the index was built. */
  ageInDays: number | null
  /** True when the index is old enough to be worth rebuilding. */
  isStale: boolean
  isLoading: boolean
  isBuilding: boolean
  /** Live counts while building. */
  progress: CrawlProgress | null
  /** Set when the last build stopped early, phrased for display. */
  incompleteReason: string | null
  build: () => void
  cancel: () => void
}

export function useSproutFolderIndex(apiKey: string | null): UseSproutFolderIndexResult {
  const queryClient = useQueryClient()
  const [mountedAt] = useState(() => Date.now())
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [incompleteReason, setIncompleteReason] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const indexQuery = useQuery({
    queryKey: indexQueryKey(apiKey ?? ''),
    queryFn: async () => parseFolderIndex(await readFolderIndex(), apiKey as string),
    enabled: Boolean(apiKey),
    // The file only changes when this hook writes it, so re-reading is waste.
    staleTime: CACHE.STANDARD,
    gcTime: CACHE.GC_MEDIUM,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  })

  const buildMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error('No Sprout Video API key configured')

      const controller = new AbortController()
      abortRef.current = controller
      setProgress({ folders: 0, requests: 0 })
      setIncompleteReason(null)

      const result = await crawlSproutFolders({
        // Routed through api.ts, so the shared budget guard serialises these and
        // refuses them near the reserve — an upload keeps its headroom.
        fetchLevel: async (parentId) => (await getFolders(apiKey, parentId)).folders,
        signal: controller.signal,
        onProgress: setProgress
      })

      const index = createFolderIndex(
        apiKey,
        result.folders,
        result.incomplete,
        new Date().toISOString()
      )

      // Saved even when incomplete: a partial index still answers most searches,
      // and the UI says it is partial rather than implying full coverage.
      await writeFolderIndex(index)
      return { index, stoppedBecause: result.stoppedBecause, error: result.error }
    },
    onSuccess: ({ index, stoppedBecause, error }) => {
      queryClient.setQueryData(indexQueryKey(apiKey ?? ''), index)
      setIncompleteReason(describeStop(stoppedBecause, error))
    },
    onSettled: () => {
      abortRef.current = null
      setProgress(null)
    }
  })

  const cancel = useCallback(() => abortRef.current?.abort(), [])

  // Validated rather than trusted: the query cache can be seeded or mocked with
  // anything, and a shape mismatch must not throw during render.
  const raw = indexQuery.data
  const index: FolderIndex | null = Array.isArray(raw?.folders) ? raw : null
  // Captured once per mount rather than read during render: Date.now() in render
  // is impure, and "3 days ago" does not need to tick while the menu is open.
  const ageInDays = index ? indexAgeInDays(index, mountedAt) : null

  return {
    // Paths are composed from the whole index, so every folder gets its full
    // breadcrumb rather than the partial one the live cache can offer.
    folders: withPaths(index?.folders),
    index,
    ageInDays,
    isStale: index !== null && ageInDays !== null && ageInDays >= INDEX_STALE_AFTER_DAYS,
    isLoading: indexQuery.isLoading,
    isBuilding: buildMutation.isPending,
    progress,
    incompleteReason,
    build: buildMutation.mutate,
    cancel
  }
}

/** Turns a crawl outcome into something worth showing a user. */
function describeStop(
  stoppedBecause: 'complete' | 'cancelled' | 'maxFolders' | 'maxRequests' | 'error',
  error?: string
): string | null {
  switch (stoppedBecause) {
    case 'complete':
      return null
    case 'cancelled':
      return 'Indexing was cancelled, so search covers only what was found so far.'
    case 'maxFolders':
    case 'maxRequests':
      return 'This account is larger than the indexer will walk in one pass, so search covers only part of it.'
    case 'error':
      return `Indexing stopped early: ${error ?? 'unknown error'}. Search covers only what was found so far.`
  }
}
