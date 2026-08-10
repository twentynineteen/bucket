/**
 * useSproutFolders (issue #155)
 *
 * Fetches one level of the Sprout folder tree. Every option here that looks like
 * tuning is actually rate-limit safety: Sprout allows 200 requests per minute
 * per ACCOUNT, shared with uploads, so a browsing feature that spends the budget
 * can fail the user's own upload.
 */
import { CACHE } from '@shared/constants'
import { isAuthError, isRateLimited, queryKeys } from '@shared/lib'
import type { GetFoldersResponse } from '@shared/types'
import { useQuery } from '@tanstack/react-query'

import { getFolders } from '../api'
import { useDebouncedFlag } from './useDebouncedFlag'

/** How long a submenu must stay open before its level is fetched (R2). */
export const DWELL_MS = 300

interface UseSproutFoldersOptions {
  /** Sprout API key. The query stays idle without one. */
  apiKey: string | null
  /** Folder whose children to list. Null lists the account root. */
  parentId: string | null
  /** Whether the panel showing this level is currently open. */
  isOpen: boolean
  /**
   * Skip the dwell gate. Set when the fetch is triggered by an explicit click
   * rather than a hover, which is the case for the drill-down panel: there is
   * no hover-open, so there is no fan-out to debounce and the delay would only
   * add latency.
   */
  immediate?: boolean
}

export function useSproutFolders({
  apiKey,
  parentId,
  isOpen,
  immediate = false
}: UseSproutFoldersOptions) {
  // Gate on a dwell unless the caller fetches on an explicit click. Hover-driven
  // opens must never fan out one request per row (R2).
  const dwelling = useDebouncedFlag(isOpen, DWELL_MS) || (immediate && isOpen)

  return useQuery<GetFoldersResponse>({
    queryKey: queryKeys.sprout.folders(apiKey ?? '', parentId),
    queryFn: () => getFolders(apiKey as string, parentId),
    enabled: Boolean(apiKey) && dwelling,

    // Folder structures change on the order of days. Reopening the picker after
    // an upload is the most common interaction and must cost nothing (R3).
    staleTime: CACHE.STANDARD,
    gcTime: CACHE.GC_MEDIUM,
    refetchOnWindowFocus: false,
    refetchOnMount: false,

    // Set explicitly, never inherited. The global default guards on
    // `error instanceof Error`, which is false for Tauri's bare-string
    // rejections, so it falls through and RETRIES 4xx -- including 429s, into a
    // window that is still closed. See #156 (R4).
    retry: (failureCount, error) =>
      !isRateLimited(error) && !isAuthError(error) && failureCount < 1
  })
}
