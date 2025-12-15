import { CACHE } from '@constants/timing'
import { QueryClient } from '@tanstack/react-query'
import { core } from '@tauri-apps/api'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { createNamespacedLogger } from '@utils/logger'
import { loadApiKeys } from '@utils/storage'

import { queryKeys } from './query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from './query-utils'

const logger = createNamespacedLogger('Prefetch')

/**
 * Query Prefetching Strategies
 *
 * Provides intelligent prefetching strategies to improve perceived performance
 * by loading data before it's needed by components.
 */
export class QueryPrefetchManager {
  private queryClient: QueryClient

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Prefetch essential app data on startup
   * This runs when the app first loads to warm the cache
   */
  async prefetchAppStartupData() {
    const prefetchPromises = [
      this.prefetchAppVersion(),
      this.prefetchUsername(),
      this.prefetchApiKeys()
    ]

    // Run all prefetches concurrently, but don't block app startup on failures
    const results = await Promise.allSettled(prefetchPromises)

    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length > 0) {
      logger.log('Some startup data prefetching failed:', failures)
    }

    return results
  }

  /**
   * Prefetch user-specific data after authentication
   */
  async prefetchUserData() {
    return Promise.allSettled([this.prefetchUsername(), this.prefetchApiKeys()])
  }

  /**
   * Prefetch app version (static data with long cache time)
   */
  async prefetchAppVersion() {
    return this.queryClient.prefetchQuery({
      ...createQueryOptions(
        queryKeys.user.profile(),
        async () => {
          try {
            return await getVersion()
          } catch (error) {
            throw createQueryError(`Failed to get app version: ${error}`, 'SYSTEM_INFO')
          }
        },
        'STATIC',
        {
          staleTime: CACHE.MEDIUM, // 10 minutes
          gcTime: CACHE.GC_EXTENDED, // Keep cached for 30 minutes
          retry: (failureCount, error) => shouldRetry(error, failureCount, 'system')
        }
      )
    })
  }

  /**
   * Prefetch username
   */
  async prefetchUsername() {
    return this.queryClient.prefetchQuery({
      ...createQueryOptions(
        queryKeys.user.authentication(),
        async () => {
          try {
            return await core.invoke<string>('get_username')
          } catch (error) {
            throw createQueryError(`Failed to fetch username: ${error}`, 'AUTHENTICATION')
          }
        },
        'STATIC',
        {
          staleTime: CACHE.STANDARD, // 5 minutes
          gcTime: CACHE.GC_LONG, // Keep cached for 15 minutes
          retry: (failureCount, error) => shouldRetry(error, failureCount, 'auth')
        }
      )
    })
  }

  /**
   * Prefetch API keys for settings
   */
  async prefetchApiKeys() {
    return this.queryClient.prefetchQuery({
      ...createQueryOptions(
        queryKeys.settings.apiKeys(),
        async () => {
          try {
            return await loadApiKeys()
          } catch (error) {
            throw createQueryError(`Failed to load API keys: ${error}`, 'SETTINGS_LOAD')
          }
        },
        'DYNAMIC',
        {
          staleTime: CACHE.STANDARD, // 5 minutes
          gcTime: CACHE.GC_MEDIUM, // Keep cached for 10 minutes
          retry: (failureCount, error) => shouldRetry(error, failureCount, 'settings')
        }
      )
    })
  }

  /**
   * Prefetch Trello board data if API credentials are available
   */
  async prefetchTrelloBoard(boardId: string, apiKey?: string, token?: string) {
    if (!apiKey || !token) {
      // Try to get API keys from cache or storage
      const apiKeys = this.queryClient.getQueryData(queryKeys.settings.apiKeys()) as
        | Record<string, string>
        | undefined
      if (!apiKeys?.trello || !apiKeys?.trelloToken) {
        logger.log('Trello prefetch skipped: missing API credentials')
        return
      }
      apiKey = apiKeys.trello
      token = apiKeys.trelloToken
    }

    return this.queryClient.prefetchQuery({
      ...createQueryOptions(
        queryKeys.trello.board(boardId),
        async () => {
          try {
            const response = await fetch(
              `https://api.trello.com/1/boards/${boardId}/lists?cards=open&key=${apiKey}&token=${token}`
            )
            if (!response.ok) {
              throw new Error(`Trello API error: ${response.status}`)
            }
            return await response.json()
          } catch (error) {
            throw createQueryError(
              `Failed to fetch Trello board: ${error}`,
              'TRELLO_FETCH'
            )
          }
        },
        'DYNAMIC',
        {
          staleTime: CACHE.QUICK, // 2 minutes
          gcTime: CACHE.GC_MEDIUM, // Keep cached for 10 minutes
          retry: (failureCount, error) => shouldRetry(error, failureCount, 'trello')
        }
      )
    })
  }

  /**
   * Prefetch Sprout Video folders if API key is available
   */
  async prefetchSproutFolders(apiKey?: string, parentId: string | null = null) {
    if (!apiKey) {
      // Try to get API key from cache or storage
      const apiKeys = this.queryClient.getQueryData(queryKeys.settings.apiKeys()) as
        | Record<string, string>
        | undefined
      if (!apiKeys?.sproutVideo) {
        logger.log('Sprout prefetch skipped: missing API key')
        return
      }
      apiKey = apiKeys.sproutVideo
    }

    return this.queryClient.prefetchQuery({
      ...createQueryOptions(
        queryKeys.sprout.folders(apiKey, parentId),
        async () => {
          try {
            const result = await invoke<{ folders: unknown[] }>('get_folders', {
              apiKey,
              parent_id: parentId
            })
            return result.folders
          } catch (error) {
            throw createQueryError(
              `Failed to fetch Sprout folders: ${error}`,
              'SPROUT_FOLDERS_FETCH'
            )
          }
        },
        'DYNAMIC',
        {
          staleTime: CACHE.QUICK, // 2 minutes
          gcTime: CACHE.GC_STANDARD, // Keep cached for 5 minutes
          retry: (failureCount, error) => shouldRetry(error, failureCount, 'sprout')
        }
      )
    })
  }

  /**
   * Prefetch data for specific routes/pages
   */
  async prefetchForRoute(route: string) {
    switch (route) {
      case '/settings':
      case '/settings/general':
        return Promise.allSettled([this.prefetchApiKeys(), this.prefetchAppVersion()])

      case '/upload-trello': {
        await this.prefetchApiKeys()
        // Get Trello credentials and prefetch board data
        const apiKeys = this.queryClient.getQueryData(
          queryKeys.settings.apiKeys()
        ) as Record<string, unknown>
        if (apiKeys?.trello && apiKeys?.trelloToken) {
          const defaultBoardId = '55a504d70bed2bd21008dc5a' // 'small projects' board
          return this.prefetchTrelloBoard(
            defaultBoardId,
            apiKeys.trello as string,
            apiKeys.trelloToken as string
          )
        }
        break
      }

      case '/upload-sprout': {
        await this.prefetchApiKeys()
        // Get Sprout credentials and prefetch root folders
        const keys = this.queryClient.getQueryData(
          queryKeys.settings.apiKeys()
        ) as Record<string, unknown>
        if (keys?.sproutVideo) {
          return this.prefetchSproutFolders(keys.sproutVideo as string, null)
        }
        break
      }

      default:
        // For unknown routes, just prefetch basic app data
        return this.prefetchAppStartupData()
    }
  }

  /**
   * Smart prefetching based on user behavior patterns
   */
  async smartPrefetch(context: {
    currentRoute: string
    previousRoutes: string[]
    userActions: string[]
  }) {
    // Analyze patterns and prefetch likely next data
    const { currentRoute, previousRoutes, userActions } = context

    // If user frequently visits settings after current route, prefetch settings data
    if (this.shouldPrefetchSettings(previousRoutes, currentRoute)) {
      await this.prefetchApiKeys()
    }

    // If user is working with Trello, prefetch board data
    if (userActions.includes('trello') || currentRoute.includes('trello')) {
      const apiKeys = this.queryClient.getQueryData(
        queryKeys.settings.apiKeys()
      ) as Record<string, unknown>
      if (apiKeys?.trello && apiKeys?.trelloToken) {
        const defaultBoardId = '55a504d70bed2bd21008dc5a'
        await this.prefetchTrelloBoard(
          defaultBoardId,
          apiKeys.trello as string,
          apiKeys.trelloToken as string
        )
      }
    }

    // If user is working with Sprout, prefetch folder data
    if (userActions.includes('sprout') || currentRoute.includes('sprout')) {
      const apiKeys = this.queryClient.getQueryData(
        queryKeys.settings.apiKeys()
      ) as Record<string, unknown>
      if (apiKeys?.sproutVideo) {
        await this.prefetchSproutFolders(apiKeys.sproutVideo as string, null)
      }
    }
  }

  /**
   * Prefetch on hover/focus for interactive elements
   */
  async prefetchOnHover(element: 'trello-button' | 'settings-link' | 'sprout-button') {
    switch (element) {
      case 'trello-button': {
        const apiKeys = this.queryClient.getQueryData(
          queryKeys.settings.apiKeys()
        ) as Record<string, unknown>
        if (apiKeys?.trello && apiKeys?.trelloToken) {
          const defaultBoardId = '55a504d70bed2bd21008dc5a'
          return this.prefetchTrelloBoard(
            defaultBoardId,
            apiKeys.trello as string,
            apiKeys.trelloToken as string
          )
        }
        break
      }

      case 'settings-link':
        return this.prefetchApiKeys()

      case 'sprout-button': {
        const keys = this.queryClient.getQueryData(
          queryKeys.settings.apiKeys()
        ) as Record<string, unknown>
        if (keys?.sproutVideo) {
          return this.prefetchSproutFolders(keys.sproutVideo as string, null)
        }
        break
      }
    }
  }

  /**
   * Check if we should prefetch settings based on user patterns
   */
  private shouldPrefetchSettings(
    previousRoutes: string[],
    currentRoute: string
  ): boolean {
    // If user has visited settings recently, they might go back
    const hasVisitedSettingsRecently = previousRoutes
      .slice(-5) // Check last 5 routes
      .some((route) => route.includes('settings'))

    // If user is on build project page, they might need to configure settings
    const onBuildProjectPage = currentRoute.includes('build-project')

    return hasVisitedSettingsRecently || onBuildProjectPage
  }

  /**
   * Cleanup expired prefetched data to manage memory
   */
  async cleanupExpiredPrefetches() {
    const queryCache = this.queryClient.getQueryCache()
    const queries = queryCache.getAll()
    const now = Date.now()

    queries.forEach((query) => {
      // Remove queries that are very old and not actively used
      const queryAge = now - (query.state.dataUpdatedAt || 0)
      const maxAge = CACHE.EXTENDED // 1 hour

      if (queryAge > maxAge && query.getObserversCount() === 0) {
        queryCache.remove(query)
      }
    })
  }
}

// Export factory function
export const createPrefetchManager = (queryClient: QueryClient) => {
  return new QueryPrefetchManager(queryClient)
}

// Export singleton for global use
let globalPrefetchManager: QueryPrefetchManager | null = null

export const initializePrefetchManager = (queryClient: QueryClient) => {
  globalPrefetchManager = new QueryPrefetchManager(queryClient)
  return globalPrefetchManager
}

export const getPrefetchManager = (): QueryPrefetchManager => {
  if (!globalPrefetchManager) {
    throw new Error(
      'Prefetch manager not initialized. Call initializePrefetchManager() first.'
    )
  }
  return globalPrefetchManager
}

// React hooks for components
export const usePrefetch = () => {
  return getPrefetchManager()
}

export default QueryPrefetchManager
