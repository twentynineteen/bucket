import { CACHE, getBackoffDelay, RETRY, SECONDS } from '@constants/timing'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { del, get, set } from '@tauri-apps/plugin-store'
import { createNamespacedLogger } from '@utils/logger'

import { logger } from '@/utils/logger'

const logger = createNamespacedLogger('QueryClient')

/**
 * Advanced Query Client Configuration
 *
 * Provides enhanced configuration for React Query including:
 * - Cache persistence across app restarts
 * - Advanced retry and error handling
 * - Memory management and optimization
 * - Development vs production settings
 */

/**
 * Tauri Store Persister for React Query
 * Uses Tauri's secure store plugin for cross-platform persistence
 */
class TauriStorePersister {
  private storeName: string
  private maxAge: number

  constructor(storeName = 'react-query-cache', maxAge = CACHE.PERSISTENT) {
    // 24 hours default
    this.storeName = storeName
    this.maxAge = maxAge
  }

  async persistClient(persistedClient: unknown) {
    try {
      const dataToStore = {
        ...persistedClient,
        timestamp: Date.now()
      }
      await set(this.storeName, JSON.stringify(dataToStore))
    } catch (error) {
      logger.error('Failed to persist query client:', error)
      // Don't throw error - persistence is non-critical
    }
  }

  async restoreClient(): Promise<unknown | undefined> {
    try {
      const stored = await get<string>(this.storeName)
      if (!stored) return undefined

      const data = JSON.parse(stored)

      // Check if data is expired
      if (data.timestamp && Date.now() - data.timestamp > this.maxAge) {
        await this.removeClient()
        return undefined
      }

      // Remove timestamp before returning (was used for age validation above)
      const { ...clientData } = data
      return clientData
    } catch (error) {
      logger.error('Failed to restore query client:', error)
      // Clean up corrupted data
      await this.removeClient()
      return undefined
    }
  }

  async removeClient() {
    try {
      await del(this.storeName)
    } catch (error) {
      logger.error('Failed to remove persisted client:', error)
    }
  }
}

/**
 * Configuration for different cache persistence strategies
 */
export interface CachePersistenceConfig {
  enabled: boolean
  maxAge: number // milliseconds
  storeName: string
  buster?: string // version string to invalidate old cache
  throttleTime?: number // milliseconds between saves
}

/**
 * Default persistence configuration
 */
export const DEFAULT_PERSISTENCE_CONFIG: CachePersistenceConfig = {
  enabled: true,
  maxAge: CACHE.PERSISTENT, // 24 hours
  storeName: 'bucket-query-cache',
  throttleTime: 1 * SECONDS // Save at most every 1 second
}

/**
 * Create enhanced QueryClient with persistence
 */
export function createPersistedQueryClient(
  config: Partial<CachePersistenceConfig> = {}
): Promise<QueryClient> {
  const persistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...config }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is considered fresh for 1 minute
        staleTime: CACHE.BRIEF,
        // Default garbage collection time - keep unused data for 5 minutes
        gcTime: CACHE.GC_STANDARD,
        // Enhanced retry configuration
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error instanceof Error) {
            const message = error.message.toLowerCase()
            if (
              message.includes('4') ||
              message.includes('unauthorized') ||
              message.includes('forbidden')
            ) {
              return false
            }
          }
          return failureCount < RETRY.DEFAULT_ATTEMPTS
        },
        // Exponential backoff with jitter
        retryDelay: (attemptIndex) => {
          const baseDelay = getBackoffDelay(attemptIndex, RETRY.MAX_DELAY_DEFAULT)
          const jitter = Math.random() * 0.3 * baseDelay // 30% jitter
          return baseDelay + jitter
        },
        // Optimize for desktop app
        refetchOnWindowFocus: false, // Desktop apps don't need this
        refetchOnReconnect: true, // But do refetch when network reconnects
        networkMode: 'online'
      },
      mutations: {
        // Fewer retries for mutations to avoid duplicate operations
        retry: (failureCount, error) => {
          if (error instanceof Error) {
            const message = error.message.toLowerCase()
            if (
              message.includes('4') ||
              message.includes('unauthorized') ||
              message.includes('forbidden')
            ) {
              return false
            }
          }
          return failureCount < 2
        },
        retryDelay: (attemptIndex) => {
          const baseDelay = getBackoffDelay(attemptIndex, RETRY.MAX_DELAY_MUTATION)
          const jitter = Math.random() * 0.3 * baseDelay
          return baseDelay + jitter
        }
      }
    }
  })

  // Set up persistence if enabled
  if (persistenceConfig.enabled) {
    const persister = new TauriStorePersister(
      persistenceConfig.storeName,
      persistenceConfig.maxAge
    )

    return persistQueryClient({
      queryClient,
      persister,
      maxAge: persistenceConfig.maxAge,
      buster: persistenceConfig.buster
    }).then(() => queryClient)
  }

  return Promise.resolve(queryClient)
}

/**
 * Memory optimization utilities for the QueryClient
 */
export class QueryClientOptimizer {
  private queryClient: QueryClient
  private cleanupInterval?: NodeJS.Timeout

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Start automatic memory cleanup
   */
  startAutoCleanup(intervalMs = CACHE.STANDARD) {
    // 5 minutes default
    this.stopAutoCleanup() // Clear any existing interval

    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, intervalMs)
  }

  /**
   * Stop automatic memory cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }

  /**
   * Perform immediate memory cleanup
   */
  performCleanup() {
    const queryCache = this.queryClient.getQueryCache()
    const queries = queryCache.getAll()
    const now = Date.now()

    let removedCount = 0
    let errorCount = 0

    queries.forEach((query) => {
      const hasActiveObservers = query.getObserversCount() > 0
      const queryAge = now - (query.state.dataUpdatedAt || 0)
      const isStale = query.isStale()
      const hasError = query.state.status === 'error'

      // Remove old error queries that aren't being observed
      if (hasError && !hasActiveObservers && queryAge > CACHE.BRIEF) {
        // 1 minute for errors
        queryCache.remove(query)
        errorCount++
        return
      }

      // Remove very old unused queries
      if (!hasActiveObservers && queryAge > CACHE.LONG) {
        // 30 minutes
        queryCache.remove(query)
        removedCount++
        return
      }

      // Remove stale queries that haven't been used recently
      if (isStale && !hasActiveObservers && queryAge > CACHE.MEDIUM) {
        // 10 minutes
        queryCache.remove(query)
        removedCount++
      }
    })

    if (removedCount > 0 || errorCount > 0) {
      logger.log(
        `Query cleanup: removed ${removedCount} stale queries, ${errorCount} error queries`
      )
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const queryCache = this.queryClient.getQueryCache()
    const mutationCache = this.queryClient.getMutationCache()
    const queries = queryCache.getAll()
    const mutations = mutationCache.getAll()

    const querySizes = queries.map((query) => {
      try {
        return JSON.stringify(query.state.data).length * 2 // Rough estimate in bytes
      } catch {
        return 0
      }
    })

    const totalSize = querySizes.reduce((sum, size) => sum + size, 0)

    return {
      totalQueries: queries.length,
      totalMutations: mutations.length,
      activeQueries: queries.filter((q) => q.getObserversCount() > 0).length,
      staleQueries: queries.filter((q) => q.isStale()).length,
      errorQueries: queries.filter((q) => q.state.status === 'error').length,
      loadingQueries: queries.filter((q) => q.state.status === 'pending').length,
      estimatedSizeBytes: totalSize,
      estimatedSizeFormatted: this.formatBytes(totalSize)
    }
  }

  /**
   * Force garbage collection of all unused queries
   */
  forceGarbageCollection() {
    this.queryClient.getQueryCache().clear()
    this.queryClient.getMutationCache().clear()
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

/**
 * Configuration profiles for different environments
 */
export const QueryClientProfiles = {
  development: {
    staleTime: CACHE.SHORT, // 30 seconds
    gcTime: CACHE.GC_STANDARD, // 5 minutes
    retry: RETRY.DEFAULT_ATTEMPTS,
    refetchOnWindowFocus: false
  },

  production: {
    staleTime: CACHE.QUICK, // 2 minutes
    gcTime: CACHE.GC_MEDIUM, // 10 minutes
    retry: RETRY.DEFAULT_ATTEMPTS,
    refetchOnWindowFocus: false
  },

  testing: {
    staleTime: 0, // Always stale in tests
    gcTime: 0, // Immediate cleanup
    retry: false,
    refetchOnWindowFocus: false
  }
}

/**
 * Apply a configuration profile to a QueryClient
 */
export function applyQueryClientProfile(
  queryClient: QueryClient,
  profile: keyof typeof QueryClientProfiles
) {
  const config = QueryClientProfiles[profile]

  queryClient.setDefaultOptions({
    queries: {
      staleTime: config.staleTime,
      gcTime: config.gcTime,
      retry: config.retry,
      refetchOnWindowFocus: config.refetchOnWindowFocus
    }
  })
}

/**
 * Initialize query client with environment-specific optimizations
 */
export async function initializeOptimizedQueryClient(
  environment: 'development' | 'production' | 'testing' = 'production',
  persistenceConfig?: Partial<CachePersistenceConfig>
): Promise<{ queryClient: QueryClient; optimizer: QueryClientOptimizer }> {
  // Create persisted query client
  const queryClient = await createPersistedQueryClient(persistenceConfig)

  // Apply environment profile
  applyQueryClientProfile(queryClient, environment)

  // Create optimizer
  const optimizer = new QueryClientOptimizer(queryClient)

  // Start auto-cleanup in production
  if (environment === 'production') {
    optimizer.startAutoCleanup(CACHE.STANDARD) // 5 minutes
  }

  return { queryClient, optimizer }
}

export default {
  createPersistedQueryClient,
  QueryClientOptimizer,
  QueryClientProfiles,
  applyQueryClientProfile,
  initializeOptimizedQueryClient
}
