/**
 * Shared Lib Barrel
 *
 * Re-exports all query infrastructure modules.
 */

// Query keys factory
export {
  queryKeys,
  invalidationRules,
  createQueryKey,
  isQueryKeyMatch,
  getInvalidationQueries,
  validateQueryKey,
  createPaginatedQueryKey,
  createTimeRangeQueryKey,
  createUserScopedQueryKey
} from './query-keys'
export type { QueryKeyFactory, InvalidationRule } from './query-keys'

// Query client configuration
export {
  DEFAULT_PERSISTENCE_CONFIG,
  createPersistedQueryClient,
  QueryClientOptimizer,
  QueryClientProfiles,
  applyQueryClientProfile,
  initializeOptimizedQueryClient
} from './query-client-config'
export type { CachePersistenceConfig } from './query-client-config'

// Query utilities
export {
  QUERY_PROFILES,
  createQueryOptions,
  createMutationOptions,
  retryStrategies,
  shouldRetry,
  getRetryDelay,
  inferErrorType,
  createQueryError,
  calculateProgress
} from './query-utils'
export type {
  QueryKey,
  QueryConfiguration,
  MutationConfiguration,
  QueryDomain,
  LoadingState,
  ProgressState,
  QueryError,
  RetryConfiguration
} from './query-utils'

// Performance monitoring
export {
  QueryPerformanceMonitor,
  useQueryPerformance,
  createPerformanceLogger,
  createPerformanceMonitor,
  initializePerformanceMonitor,
  getPerformanceMonitor
} from './performance-monitor'
export type {
  QueryPerformanceMetric,
  AggregatedMetrics,
  PerformanceInsight
} from './performance-monitor'

// Prefetch strategies
export {
  QueryPrefetchManager,
  createPrefetchManager,
  initializePrefetchManager,
  getPrefetchManager,
  usePrefetch
} from './prefetch-strategies'
