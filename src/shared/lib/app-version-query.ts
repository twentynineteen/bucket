import { CACHE } from '@shared/constants'
import { getVersion } from '@tauri-apps/api/app'

import { queryKeys } from './query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from './query-utils'

/**
 * Shared query-options factory for the app version.
 *
 * Used by both `NavUser` (inline `useQuery`) and `QueryPrefetchManager`
 * (`prefetchAppVersion`). Extracted so the key, queryFn, staleTime, gcTime
 * and retry policy are defined once rather than duplicated across two files.
 */
export function appVersionQueryOptions() {
  return createQueryOptions(
    queryKeys.app.version(),
    async () => {
      try {
        return await getVersion()
      } catch (error) {
        throw createQueryError(`Failed to get app version: ${error}`, 'SYSTEM_INFO')
      }
    },
    'STATIC',
    {
      staleTime: CACHE.MEDIUM, // 10 minutes - version does not change while the app runs
      gcTime: CACHE.GC_EXTENDED, // Keep cached for 30 minutes
      retry: (failureCount, error) => shouldRetry(error, failureCount, 'system')
    }
  )
}
