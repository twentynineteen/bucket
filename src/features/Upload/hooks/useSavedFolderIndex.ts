/**
 * useSavedFolderIndex (issues #155, #169)
 *
 * Reads the saved Sprout folder index for one account, and nothing else.
 *
 * Split out of `useSproutFolderIndex` because validating a stored default folder
 * (#169) needs the index data without the crawl, export and import machinery
 * that surrounds it. Both hooks share this one query, and therefore one query
 * key, so mounting the picker and the destination resolver together costs a
 * single file read rather than two.
 *
 * It costs **zero Sprout requests**, which is what makes validation affordable
 * at all: Sprout allows 200 requests/minute account-wide, shared with uploads,
 * and #155 R1 rules out fetching folders speculatively.
 */
import { CACHE } from '@shared/constants'
import { useQuery } from '@tanstack/react-query'

import { readFolderIndex } from '../api'
import type { FolderIndex } from '../internal/folderIndex'
import { parseFolderIndex } from '../internal/folderIndex'

/**
 * Keyed on the account, not the key: the index for one Sprout account says
 * nothing about another, and `parseFolderIndex` discards a file whose
 * fingerprint does not match.
 */
export const folderIndexQueryKey = (account: string) =>
  ['sprout', 'folder-index', account] as const

export interface SavedFolderIndex {
  /** The index for this account, or null when none applies. */
  index: FolderIndex | null
  /** True while the file is being read for the first time. */
  isPending: boolean
}

export function useSavedFolderIndex(apiKey: string | null): SavedFolderIndex {
  const query = useQuery({
    queryKey: folderIndexQueryKey(apiKey ?? ''),
    queryFn: async () => parseFolderIndex(await readFolderIndex(), apiKey as string),
    enabled: Boolean(apiKey),
    // The file only changes when this app writes it, so re-reading is waste.
    staleTime: CACHE.STANDARD,
    gcTime: CACHE.GC_MEDIUM,
    refetchOnWindowFocus: false,
    refetchOnMount: false
  })

  // Validated rather than trusted: the query cache can be seeded or mocked with
  // anything, and a shape mismatch must not throw during render.
  const raw = query.data
  return {
    index: Array.isArray(raw?.folders) ? raw : null,
    // A disabled query reports `pending` forever, which is not the same thing as
    // a read in flight -- without a key there is nothing to wait for.
    isPending: Boolean(apiKey) && query.isPending
  }
}
