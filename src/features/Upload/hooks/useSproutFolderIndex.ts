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

import {
  getFolders,
  openJsonFileDialog,
  readFolderIndex,
  readFolderIndexFrom,
  saveFileDialog,
  writeFolderIndex,
  writeFolderIndexTo
} from '../api'
import type { CrawlProgress } from '../internal/crawlSproutFolders'
import { crawlSproutFolders } from '../internal/crawlSproutFolders'
import type { FolderIndex } from '../internal/folderIndex'
import {
  indexAgeInDays,
  mergeFolderIndex,
  parseFolderIndex
} from '../internal/folderIndex'
import { withPaths } from '../internal/folderPaths'
import {
  assessImport,
  describeVerdict,
  exportFileName,
  parseImportedIndex
} from '../internal/folderIndexTransfer'
import { remainingBudget } from '../internal/sproutRateBudget'
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
  /** Writes the index to a file the user picks, for a colleague to import. */
  exportIndex: () => void
  /** Reads a colleague's exported index and merges it in. */
  importIndex: () => void
  isTransferring: boolean
  /** Outcome of the last export or import, for display. */
  transferMessage: string | null
  /** True when the last transfer failed, so the message can be styled as such. */
  transferFailed: boolean
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

      // Whatever is already indexed, so a partial crawl adds to it rather than
      // replacing it. Losing known folders to an interrupted re-index is the bug
      // this guards against.
      const existing = parseFolderIndex(await readFolderIndex(), apiKey)

      const save = async (
        folders: Parameters<typeof mergeFolderIndex>[1],
        complete: boolean
      ) => {
        const merged = mergeFolderIndex(
          existing,
          folders,
          complete,
          apiKey,
          new Date().toISOString()
        )
        await writeFolderIndex(merged)
        return merged
      }

      const result = await crawlSproutFolders({
        // Routed through api.ts, so the shared budget guard serialises these and
        // refuses them near the reserve — an upload keeps its headroom.
        fetchLevel: async (parentId) => (await getFolders(apiKey, parentId)).folders,
        signal: controller.signal,
        onProgress: setProgress,
        paceMs: paceFromBudget,
        // A full pass over a large account runs for minutes, so progress is
        // written as it goes and an interruption keeps what was found.
        onCheckpoint: (folders) => save(folders, false).then(() => undefined)
      })

      const index = await save(result.folders, !result.incomplete)
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

  const [transferMessage, setTransferMessage] = useState<string | null>(null)
  const [transferFailed, setTransferFailed] = useState(false)

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error('No Sprout Video API key configured')
      const current = parseFolderIndex(await readFolderIndex(), apiKey)
      if (!current) throw new Error('There is no index to export yet')

      const path = await saveFileDialog(exportFileName(current.indexedAt))
      if (!path) return null // cancelled

      await writeFolderIndexTo(path, current)
      return current.folders.length
    },
    onSuccess: (count) => {
      setTransferFailed(false)
      setTransferMessage(
        count === null
          ? null
          : `Exported ${count} folders. Share the file with your team.`
      )
    },
    onError: (error: Error) => {
      setTransferFailed(true)
      setTransferMessage(`Export failed: ${error.message}`)
    }
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error('No Sprout Video API key configured')

      const path = await openJsonFileDialog()
      if (!path) return null // cancelled

      const imported = parseImportedIndex(await readFolderIndexFrom(path))
      if (!imported) {
        throw new Error('That file is not a folder index Bucket can read')
      }

      // One request, versus the minutes the import is replacing. Folder ids are
      // account-scoped, so overlapping roots prove the index belongs here.
      const roots = (await getFolders(apiKey, null)).folders.map((folder) => folder.id)
      const verdict = assessImport(imported, roots)
      if (!verdict.ok) throw new Error(describeVerdict(verdict, 0))

      const existing = parseFolderIndex(await readFolderIndex(), apiKey)
      // Re-tagged with this machine's fingerprint, so it loads normally hereafter.
      const merged = mergeFolderIndex(
        existing,
        imported.folders,
        !imported.partial,
        apiKey,
        new Date().toISOString()
      )
      await writeFolderIndex(merged)

      return { merged, message: describeVerdict(verdict, merged.folders.length) }
    },
    onSuccess: (result) => {
      setTransferFailed(false)
      if (!result) return
      queryClient.setQueryData(indexQueryKey(apiKey ?? ''), result.merged)
      setTransferMessage(result.message)
    },
    onError: (error: Error) => {
      setTransferFailed(true)
      setTransferMessage(error.message)
    }
  })

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
    cancel,
    exportIndex: exportMutation.mutate,
    importIndex: importMutation.mutate,
    isTransferring: exportMutation.isPending || importMutation.isPending,
    transferMessage,
    transferFailed
  }
}

/**
 * Chooses a gap between requests from Sprout's reported remaining budget.
 *
 * Sprout allows 200 requests/minute account-wide. With plenty of headroom the
 * crawl can move at ~4/second; as the budget runs down it backs off so an upload
 * running alongside is never the thing that gets 429ed. Unknown budget uses the
 * conservative default, since guessing high is what would break an upload.
 */
export function paceFromBudget(): number {
  const remaining = remainingBudget()
  if (remaining === null) return 500
  if (remaining > 150) return 250
  if (remaining > 80) return 500
  return 1500
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
