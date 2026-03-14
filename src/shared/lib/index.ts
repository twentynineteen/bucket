/**
 * Shared Lib Barrel
 *
 * Re-exports all query infrastructure modules.
 */

// Query keys factory
/** Structured query key factory organized by domain -- trello, sprout, baker, etc. */
export { queryKeys } from './query-keys'
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
/** Query key factory type definition for extending with new domains */
export type { QueryKeyFactory } from './query-keys'
/** Invalidation rule mapping mutations to query key patterns */
export type { InvalidationRule } from './query-keys'

// Query client configuration
/** Default persistence settings for React Query cache -- storage key, TTL, filters */
export { DEFAULT_PERSISTENCE_CONFIG } from './query-client-config'
/** Create a React Query client with IndexedDB persistence configured */
export { createPersistedQueryClient } from './query-client-config'
/** Optimizer for tuning query client defaults based on device capabilities */
export { QueryClientOptimizer } from './query-client-config'
/** Preset query client configurations for different app profiles */
export { QueryClientProfiles } from './query-client-config'
/** Apply a named profile to a query client instance */
export { applyQueryClientProfile } from './query-client-config'
/** Initialize an optimized query client with persistence and monitoring */
export { initializeOptimizedQueryClient } from './query-client-config'
/** Configuration shape for cache persistence -- storage backend, TTL, filters */
export type { CachePersistenceConfig } from './query-client-config'

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
/** Create a structured query error with type, message, and retry hint */
export { createQueryError } from './query-utils'
/** Calculate normalized progress (0-1) from loaded and total counts */
export { calculateProgress } from './query-utils'
/** Query key type alias for React Query compatibility */
export type { QueryKey } from './query-utils'
/** Full query configuration with staleTime, cacheTime, retry, and callbacks */
export type { QueryConfiguration } from './query-utils'
/** Mutation configuration with optimistic update and rollback handlers */
export type { MutationConfiguration } from './query-utils'
/** Query domain identifier for organizing keys -- trello, sprout, baker, etc. */
export type { QueryDomain } from './query-utils'
/** Loading state enum -- idle, loading, success, error */
export type { LoadingState } from './query-utils'
/** Progress state with percentage, message, and estimated time remaining */
export type { ProgressState } from './query-utils'
/** Structured query error with type classification and retry metadata */
export type { QueryError } from './query-utils'
/** Retry configuration with max attempts, delay, and backoff strategy */
export type { RetryConfiguration } from './query-utils'

// Performance monitoring
/** Monitor for tracking query execution time and cache hit rates */
export { QueryPerformanceMonitor } from './performance-monitor'
/** Hook for accessing query performance metrics in React components */
export { useQueryPerformance } from './performance-monitor'
/** Create a performance logger that outputs metrics to the console */
export { createPerformanceLogger } from './performance-monitor'
/** Create a QueryPerformanceMonitor instance with custom configuration */
export { createPerformanceMonitor } from './performance-monitor'
/** Initialize the global performance monitor singleton */
export { initializePerformanceMonitor } from './performance-monitor'
/** Get the current global performance monitor instance */
export { getPerformanceMonitor } from './performance-monitor'
/** Single query performance measurement with timing and cache status */
export type { QueryPerformanceMetric } from './performance-monitor'
/** Aggregated metrics across multiple queries -- averages, p95, cache rates */
export type { AggregatedMetrics } from './performance-monitor'
/** Performance insight with severity and recommendation for optimization */
export type { PerformanceInsight } from './performance-monitor'

// Prefetch strategies
/** Manager for prefetching query data based on navigation and usage patterns */
export { QueryPrefetchManager } from './prefetch-strategies'
/** Create a QueryPrefetchManager instance with route-based prefetch rules */
export { createPrefetchManager } from './prefetch-strategies'
/** Initialize the global prefetch manager singleton */
export { initializePrefetchManager } from './prefetch-strategies'
/** Get the current global prefetch manager instance */
export { getPrefetchManager } from './prefetch-strategies'
/** Hook for triggering prefetch operations from React components */
export { usePrefetch } from './prefetch-strategies'
