import { CACHE, getBackoffDelay, RETRY } from '@shared/constants'
import { QueryClient } from '@tanstack/react-query'
import { shouldRetryRequest } from './query-utils'

/**
 * Builds the app's QueryClient. App.tsx installs the client this returns, and
 * query-client-config.test.ts pins its retry policy, so the two cannot drift.
 * Lint forbids constructing a QueryClient anywhere else in src (#300).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is considered fresh for 30 seconds
        staleTime: CACHE.SHORT,
        // Default garbage collection time - keep unused data for 5 minutes
        gcTime: CACHE.GC_STANDARD,
        // Retry 5xx and transport failures up to 3 times with exponential backoff.
        // Never retries a 4xx, and never a 429 into a rate-limit window that is
        // still closed. Handles Tauri's bare-string rejections; see #156.
        retry: (failureCount, error) =>
          shouldRetryRequest(error, failureCount, RETRY.DEFAULT_ATTEMPTS),
        // Retry delay with exponential backoff
        retryDelay: attemptIndex =>
          getBackoffDelay(attemptIndex, RETRY.MAX_DELAY_DEFAULT),
        // Refetch on window focus for critical data
        refetchOnWindowFocus: false, // Disabled by default, hooks can override this
        // Background refetch interval for important data
        refetchInterval: false, // Disabled by default, hooks can override this
        // Network mode configuration for Tauri desktop app
        networkMode: 'online'
      },
      mutations: {
        // Fewer retries for mutations -- a retry can duplicate an operation.
        retry: (failureCount, error) =>
          shouldRetryRequest(error, failureCount, RETRY.MUTATION_ATTEMPTS),
        // Retry delay for mutations
        retryDelay: attemptIndex =>
          getBackoffDelay(attemptIndex, RETRY.MAX_DELAY_MUTATION)
      }
    }
  })
}
