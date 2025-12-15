import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { QueryClient } from '@tanstack/react-query'

import { logger } from '@/utils/logger'

/**
 * Cache Invalidation Service
 *
 * Provides centralized cache invalidation utilities for React Query.
 * This service helps maintain data consistency across the application
 * by providing targeted cache invalidation strategies.
 */
export class CacheInvalidationService {
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Invalidate all queries for a specific user
   */
  async invalidateUserData() {
    await Promise.all([
      this.queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() }),
      this.queryClient.invalidateQueries({ queryKey: queryKeys.user.authentication() })
    ])
  }

  /**
   * Invalidate settings-related queries
   */
  async invalidateSettings() {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.settings.apiKeys()
    })
  }

  /**
   * Invalidate Trello-related queries
   */
  async invalidateTrelloData(boardId?: string) {
    if (boardId) {
      // Invalidate specific board data
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.trello.board(boardId)
      })
    } else {
      // Invalidate all Trello data
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.trello.all
      })
    }
  }

  /**
   * Invalidate Sprout Video folder data
   */
  async invalidateSproutData(apiKey?: string, parentId?: string | null) {
    if (apiKey && parentId !== undefined) {
      // Invalidate specific folder data
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.sprout.folders(apiKey, parentId)
      })
    } else {
      // Invalidate all Sprout data
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.sprout.all
      })
    }
  }

  /**
   * Invalidate system information queries
   * Note: There is no dedicated 'system' query key domain in queryKeys.
   * This method invalidates camera queries as a placeholder for system-level data.
   */
  async invalidateSystemInfo() {
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.camera.all
    })
  }

  /**
   * Invalidate queries by pattern matching
   */
  async invalidateByPattern(pattern: (string | number)[] | string) {
    if (typeof pattern === 'string') {
      // Invalidate queries containing the pattern string
      await this.queryClient.invalidateQueries({
        predicate: (query) => {
          return query.queryKey.some(
            (key) => typeof key === 'string' && key.includes(pattern)
          )
        }
      })
    } else {
      // Invalidate queries with exact key pattern
      await this.queryClient.invalidateQueries({ queryKey: pattern })
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  async clearAllCache() {
    await this.queryClient.clear()
  }

  /**
   * Remove queries from cache (more aggressive than invalidate)
   */
  async removeQueries(queryKey: (string | number)[]) {
    this.queryClient.removeQueries({ queryKey })
  }

  /**
   * Refetch specific queries immediately
   */
  async refetchQueries(queryKey: (string | number)[]) {
    await this.queryClient.refetchQueries({ queryKey })
  }

  /**
   * Cancel any outgoing queries for the given key
   */
  async cancelQueries(queryKey: (string | number)[]) {
    await this.queryClient.cancelQueries({ queryKey })
  }

  /**
   * Batch invalidation for common scenarios
   */
  async invalidateUserSession() {
    await Promise.all([this.invalidateUserData(), this.invalidateSettings()])
  }

  /**
   * Invalidate data after successful mutations
   */
  async onSuccessfulMutation(
    mutationType: 'user' | 'settings' | 'trello' | 'sprout',
    context?: { boardId?: string; apiKey?: string; parentId?: string | null }
  ) {
    switch (mutationType) {
      case 'user':
        await this.invalidateUserData()
        break
      case 'settings':
        await this.invalidateSettings()
        break
      case 'trello':
        await this.invalidateTrelloData(context?.boardId)
        break
      case 'sprout':
        await this.invalidateSproutData(context?.apiKey, context?.parentId)
        break
      default:
        logger.warn(`Unknown mutation type: ${mutationType}`)
    }
  }

  /**
   * Smart cache cleanup - remove stale queries older than specified age
   */
  async cleanupStaleCache(maxAgeMs: number = CACHE.LONG) {
    // 30 minutes default
    const now = Date.now()
    const queryCache = this.queryClient.getQueryCache()

    queryCache.getAll().forEach((query) => {
      const queryAge = now - (query.state.dataUpdatedAt || 0)
      if (queryAge > maxAgeMs && query.getObserversCount() === 0) {
        // Remove queries that are old and have no active observers
        queryCache.remove(query)
      }
    })
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    const queryCache = this.queryClient.getQueryCache()
    const queries = queryCache.getAll()

    const stats = {
      totalQueries: queries.length,
      activeQueries: queries.filter((q) => q.getObserversCount() > 0).length,
      staleQueries: queries.filter((q) => q.isStale()).length,
      errorQueries: queries.filter((q) => q.state.status === 'error').length,
      loadingQueries: queries.filter((q) => q.state.status === 'pending').length,
      cacheSize: this.estimateCacheSize(queries)
    }

    return stats
  }

  private estimateCacheSize(queries: { state: { data?: unknown } }[]): string {
    try {
      const sizeBytes = queries.reduce((total, query) => {
        if (query.state.data) {
          return total + JSON.stringify(query.state.data).length * 2 // Rough estimate
        }
        return total
      }, 0)

      if (sizeBytes < 1024) return `${sizeBytes} B`
      if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`
      return `${Math.round(sizeBytes / (1024 * 1024))} MB`
    } catch {
      return 'Unknown'
    }
  }
}

// Export a factory function to create the service
export const createCacheInvalidationService = (queryClient: QueryClient) => {
  return new CacheInvalidationService(queryClient)
}

// Export singleton pattern for global use (optional)
let globalCacheService: CacheInvalidationService | null = null

export const initializeCacheService = (queryClient: QueryClient) => {
  globalCacheService = new CacheInvalidationService(queryClient)
  return globalCacheService
}

export const getCacheService = (): CacheInvalidationService => {
  if (!globalCacheService) {
    throw new Error('Cache service not initialized. Call initializeCacheService() first.')
  }
  return globalCacheService
}

// Export utility hooks for use in React components
export const useCacheInvalidation = () => {
  return getCacheService()
}

export default CacheInvalidationService
