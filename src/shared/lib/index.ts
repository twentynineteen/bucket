/**
 * Shared Lib Barrel
 *
 * Re-exports all query infrastructure modules.
 */

// App-level query factories
/** Shared query-options factory for the Tauri app version (#242) */
export { appVersionQueryOptions } from './app-version-query'

// Query keys factory
/** Structured query key factory organized by domain -- trello, sprout, baker, etc. */
export { queryKeys } from './query-keys'
/** Stable non-reversible 8-char discriminator for credentials in query keys */
export { fingerprint } from './fingerprint'
/** Domain-specific cache invalidation rules mapping mutations to affected queries */
export { invalidationRules } from './query-keys'
/** Create a typed query key array from domain and parameters */
export { createQueryKey } from './query-keys'
/** Check if a query key matches a pattern for selective invalidation */
export { isQueryKeyMatch } from './query-keys'
/** Get all query keys that should be invalidated for a given mutation */
export { getInvalidationQueries } from './query-keys'
/** Validate query key structure against the factory schema */
export { validateQueryKey } from './query-keys'
/** Create a query key with pagination parameters (page, limit, cursor) */
export { createPaginatedQueryKey } from './query-keys'
/** Create a query key scoped to a time range for temporal queries */
export { createTimeRangeQueryKey } from './query-keys'
/** Create a query key scoped to a specific user for multi-tenant caching */
export { createUserScopedQueryKey } from './query-keys'

// Query client configuration
/** Create the app's QueryClient -- the retry policy and defaults App.tsx installs */
export { createQueryClient } from './query-client-config'

// Query utilities
/** Preset query option profiles for common patterns -- frequent, rare, static */
export { QUERY_PROFILES } from './query-utils'
/** Create typed query options with sensible defaults and error handling */
export { createQueryOptions } from './query-utils'
/** Create typed mutation options with optimistic updates and rollback */
export { createMutationOptions } from './query-utils'
/** Built-in retry strategies -- network-only, idempotent, never */
export { retryStrategies } from './query-utils'
/** Determine if a failed query should be retried based on error type */
export { shouldRetry } from './query-utils'
/** Calculate retry delay with exponential backoff and jitter */
export { getRetryDelay } from './query-utils'
/** Classify an error into a domain-specific error type */
export { inferErrorType } from './query-utils'
/** True for HTTP 429 rate limits -- never retry these (#155 R4) */
export { isRateLimited } from './query-utils'
/** True for HTTP 401/403 auth failures, including Tauri's bare-string rejections */
export { isAuthError } from './query-utils'
/** Create a structured query error with type, message, and retry hint */
export { createQueryError } from './query-utils'
/** Calculate normalized progress (0-1) from loaded and total counts */
export { calculateProgress } from './query-utils'
/** Query key type alias for React Query compatibility */
export type { QueryKey } from './query-utils'

// Performance monitoring
/** Initialize the global performance monitor singleton */
export { initializePerformanceMonitor } from './performance-monitor'

// Prefetch strategies
/** Initialize the global prefetch manager singleton */
export { initializePrefetchManager } from './prefetch-strategies'
