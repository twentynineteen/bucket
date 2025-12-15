/**
 * CacheInvalidationService Tests
 * Purpose: Test React Query cache invalidation utilities
 */

import { queryKeys } from '@/lib/query-keys'
import {
  CacheInvalidationService,
  createCacheInvalidationService
} from '@/services/cache-invalidation'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('CacheInvalidationService', () => {
  let queryClient: QueryClient
  let service: CacheInvalidationService

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    service = new CacheInvalidationService(queryClient)
  })

  // ============================================================================
  // User Data Invalidation Tests
  // ============================================================================

  describe('invalidateUserData', () => {
    it('should invalidate user profile and authentication queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateUserData()

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.user.profile() })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.user.authentication()
      })
    })
  })

  // ============================================================================
  // Settings Invalidation Tests
  // ============================================================================

  describe('invalidateSettings', () => {
    it('should invalidate API keys settings', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateSettings()

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.settings.apiKeys()
      })
    })
  })

  // ============================================================================
  // Trello Data Invalidation Tests
  // ============================================================================

  describe('invalidateTrelloData', () => {
    it('should invalidate specific board data when boardId is provided', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateTrelloData('board123')

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.trello.board('board123')
      })
    })

    it('should invalidate all Trello data when no boardId is provided', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateTrelloData()

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.trello.all })
    })
  })

  // ============================================================================
  // Sprout Data Invalidation Tests
  // ============================================================================

  describe('invalidateSproutData', () => {
    it('should invalidate specific folder data when apiKey and parentId are provided', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateSproutData('test-key', 'parent123')

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sprout.folders('test-key', 'parent123')
      })
    })

    it('should invalidate specific folder data with null parentId', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateSproutData('test-key', null)

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sprout.folders('test-key', null)
      })
    })

    it('should invalidate all Sprout data when no parameters provided', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateSproutData()

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.sprout.all })
    })
  })

  // ============================================================================
  // System Info Invalidation Tests
  // ============================================================================

  describe('invalidateSystemInfo', () => {
    it('should invalidate all system queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateSystemInfo()

      // Note: There's no queryKeys.system, so we use camera as a placeholder
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.camera.all })
    })
  })

  // ============================================================================
  // Pattern-Based Invalidation Tests
  // ============================================================================

  describe('invalidateByPattern', () => {
    it('should invalidate queries matching string pattern', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      await service.invalidateByPattern('user')

      expect(invalidateSpy).toHaveBeenCalledWith({
        predicate: expect.any(Function)
      })
    })

    it('should invalidate queries with exact key pattern array', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const pattern = ['user', 'profile', '123']

      await service.invalidateByPattern(pattern)

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pattern })
    })
  })

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('clearAllCache', () => {
    it('should clear entire query cache', async () => {
      const clearSpy = vi.spyOn(queryClient, 'clear')

      await service.clearAllCache()

      expect(clearSpy).toHaveBeenCalled()
    })
  })

  describe('removeQueries', () => {
    it('should remove queries with specified key', async () => {
      const removeSpy = vi.spyOn(queryClient, 'removeQueries')
      const queryKey = ['user', 'profile']

      await service.removeQueries(queryKey)

      expect(removeSpy).toHaveBeenCalledWith({ queryKey })
    })
  })

  describe('refetchQueries', () => {
    it('should refetch queries with specified key', async () => {
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries')
      const queryKey = ['user', 'profile']

      await service.refetchQueries(queryKey)

      expect(refetchSpy).toHaveBeenCalledWith({ queryKey })
    })
  })

  describe('cancelQueries', () => {
    it('should cancel queries with specified key', async () => {
      const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')
      const queryKey = ['user', 'profile']

      await service.cancelQueries(queryKey)

      expect(cancelSpy).toHaveBeenCalledWith({ queryKey })
    })
  })

  // ============================================================================
  // Batch Operations Tests
  // ============================================================================

  describe('invalidateUserSession', () => {
    it('should invalidate both user data and settings', async () => {
      const invalidateUserSpy = vi.spyOn(service, 'invalidateUserData')
      const invalidateSettingsSpy = vi.spyOn(service, 'invalidateSettings')

      await service.invalidateUserSession()

      expect(invalidateUserSpy).toHaveBeenCalled()
      expect(invalidateSettingsSpy).toHaveBeenCalled()
    })
  })

  describe('onSuccessfulMutation', () => {
    it('should invalidate user data for user mutation', async () => {
      const invalidateSpy = vi.spyOn(service, 'invalidateUserData')

      await service.onSuccessfulMutation('user')

      expect(invalidateSpy).toHaveBeenCalled()
    })

    it('should invalidate settings for settings mutation', async () => {
      const invalidateSpy = vi.spyOn(service, 'invalidateSettings')

      await service.onSuccessfulMutation('settings')

      expect(invalidateSpy).toHaveBeenCalled()
    })

    it('should invalidate Trello data with boardId for trello mutation', async () => {
      const invalidateSpy = vi.spyOn(service, 'invalidateTrelloData')

      await service.onSuccessfulMutation('trello', { boardId: 'board123' })

      expect(invalidateSpy).toHaveBeenCalledWith('board123')
    })

    it('should invalidate Sprout data with context for sprout mutation', async () => {
      const invalidateSpy = vi.spyOn(service, 'invalidateSproutData')

      await service.onSuccessfulMutation('sprout', { apiKey: 'key', parentId: 'parent' })

      expect(invalidateSpy).toHaveBeenCalledWith('key', 'parent')
    })

    it('should log warning for unknown mutation type', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await service.onSuccessfulMutation('unknown' as any)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown mutation type')
      )

      warnSpy.mockRestore()
    })
  })

  // ============================================================================
  // Cache Cleanup Tests
  // ============================================================================

  describe('cleanupStaleCache', () => {
    it('should remove stale queries older than maxAge with no observers', async () => {
      const queryCache = queryClient.getQueryCache()
      const removeSpy = vi.spyOn(queryCache, 'remove')

      // Add a query with old timestamp
      queryClient.setQueryData(
        ['old-query'],
        { data: 'test' },
        { updatedAt: Date.now() - 60 * 60 * 1000 }
      ) // 1 hour old

      await service.cleanupStaleCache(30 * 60 * 1000) // 30 min threshold

      expect(removeSpy).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Cache Statistics Tests
  // ============================================================================

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      // Add some test data
      queryClient.setQueryData(['test-query-1'], { data: 'test1' })
      queryClient.setQueryData(['test-query-2'], { data: 'test2' })

      const stats = service.getCacheStats()

      expect(stats).toMatchObject({
        totalQueries: expect.any(Number),
        activeQueries: expect.any(Number),
        staleQueries: expect.any(Number),
        errorQueries: expect.any(Number),
        loadingQueries: expect.any(Number),
        cacheSize: expect.any(String)
      })
    })

    it('should estimate cache size in appropriate units', () => {
      queryClient.setQueryData(['small'], { data: 'x' })

      const stats = service.getCacheStats()

      expect(stats.cacheSize).toMatch(/\d+ (B|KB|MB)/)
    })
  })

  // ============================================================================
  // Factory and Singleton Tests
  // ============================================================================

  describe('createCacheInvalidationService', () => {
    it('should create service instance with QueryClient', () => {
      const newService = createCacheInvalidationService(queryClient)

      expect(newService).toBeInstanceOf(CacheInvalidationService)
    })
  })

  describe('initializeCacheService and getCacheService', () => {
    beforeEach(() => {
      // Reset module to clear global state between tests
      vi.resetModules()
    })

    it('should initialize global cache service', async () => {
      const { initializeCacheService, CacheInvalidationService } = await import(
        '@/services/cache-invalidation'
      )
      const globalService = initializeCacheService(queryClient)

      expect(globalService).toBeInstanceOf(CacheInvalidationService)
    })

    it('should return initialized global service', async () => {
      const { initializeCacheService, getCacheService, CacheInvalidationService } =
        await import('@/services/cache-invalidation')
      initializeCacheService(queryClient)
      const service = getCacheService()

      expect(service).toBeInstanceOf(CacheInvalidationService)
    })

    it('should throw error when getting service before initialization', async () => {
      const { getCacheService } = await import('@/services/cache-invalidation')
      expect(() => getCacheService()).toThrow('Cache service not initialized')
    })
  })
})
