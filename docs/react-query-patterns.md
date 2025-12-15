# React Query Patterns for Bucket

This document outlines the React Query patterns and best practices implemented during the migration from legacy useEffect data fetching to TanStack React Query.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Query Patterns](#query-patterns)
3. [Mutation Patterns](#mutation-patterns)
4. [Error Handling](#error-handling)
5. [Caching Strategies](#caching-strategies)
6. [Performance Optimization](#performance-optimization)
7. [Testing Patterns](#testing-patterns)
8. [Migration Guide](#migration-guide)

## Architecture Overview

### Core Infrastructure

The React Query implementation follows a layered architecture:

```
src/
├── lib/
│   ├── query-utils.ts          # Core query utilities and helpers
│   ├── query-keys.ts           # Centralized query key factory
│   ├── prefetch-strategies.ts  # Intelligent prefetching
│   ├── query-client-config.ts  # Advanced cache configuration
│   └── performance-monitor.ts  # Performance monitoring
├── services/
│   └── cache-invalidation.ts   # Cache management service
├── hooks/
│   ├── useBreadcrumb.ts       # Navigation state management
│   ├── useTrelloBoard.ts      # Trello API integration
│   ├── useImageRefresh.ts     # Auto-refreshing image data
│   └── [other hooks...]       # Various domain-specific hooks
└── components/
    └── ErrorBoundary.tsx       # Global error handling
```

### Key Principles

1. **Centralized Query Keys**: All query keys are managed through a factory pattern
2. **Consistent Error Handling**: Standardized error types and retry logic
3. **Smart Caching**: Different cache strategies based on data characteristics
4. **Performance Monitoring**: Built-in metrics collection and optimization insights
5. **Type Safety**: Full TypeScript support throughout

## Query Patterns

### Basic Query Pattern

```typescript
import { queryKeys } from '@lib/query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'

function useUserData(userId: string) {
  return useQuery({
    ...createQueryOptions(
      queryKeys.user.profile(userId),
      async () => {
        try {
          const response = await fetch(`/api/users/${userId}`)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return await response.json()
        } catch (error) {
          throw createQueryError(`Failed to fetch user data: ${error}`, 'USER_FETCH')
        }
      },
      'DYNAMIC', // Cache strategy
      {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'user')
      }
    )
  })
}
```

### Tauri Integration Pattern

For Tauri backend calls:

```typescript
import { invoke } from '@tauri-apps/api/core'

function useFolders(apiKey: string, parentId: string | null) {
  return useQuery({
    ...createQueryOptions(
      queryKeys.sprout.folders(apiKey, parentId),
      async () => {
        try {
          const result = await invoke<GetFoldersResponse>('get_folders', {
            apiKey,
            parent_id: parentId
          })
          return result.folders
        } catch (error) {
          throw createQueryError(`Failed to fetch folders: ${error}`, 'FOLDERS_FETCH')
        }
      },
      'DYNAMIC',
      {
        enabled: !!apiKey, // Only run if apiKey is available
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'sprout')
      }
    )
  })
}
```

### Real-time Data Pattern

For data that needs regular updates:

```typescript
function useImageRefresh(imagePath: string) {
  return useQuery({
    ...createQueryOptions(
      queryKeys.images.refresh(imagePath),
      async () => {
        try {
          const response = await fetch(
            `/api/images/refresh?path=${encodeURIComponent(imagePath)}`
          )
          return await response.json()
        } catch (error) {
          throw createQueryError(`Failed to refresh image: ${error}`, 'IMAGE_REFRESH')
        }
      },
      'REALTIME',
      {
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        staleTime: 0, // Always consider stale for real-time data
        gcTime: 2 * 60 * 1000, // 2 minutes
        refetchIntervalInBackground: true
      }
    )
  })
}
```

## Mutation Patterns

### Basic Mutation Pattern

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useSaveSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Settings) => {
      try {
        await saveApiKeys(settings)
        return settings
      } catch (error) {
        throw createQueryError(`Failed to save settings: ${error}`, 'SETTINGS_SAVE')
      }
    },
    onSuccess: savedSettings => {
      // Update the cache with new data
      queryClient.setQueryData(queryKeys.settings.apiKeys(), savedSettings)

      // Or invalidate to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() })
    },
    onError: error => {
      console.error('Settings save failed:', error)
      // Could show toast notification here
    }
  })
}
```

### Optimistic Updates Pattern

```typescript
function useUpdateUserProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates)
      })
      if (!response.ok) throw new Error('Update failed')
      return response.json()
    },
    onMutate: async updates => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user.profile() })

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.user.profile())

      // Optimistically update
      queryClient.setQueryData(queryKeys.user.profile(), old => ({
        ...old,
        ...updates
      }))

      return { previousData }
    },
    onError: (err, updates, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.user.profile(), context.previousData)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
    }
  })
}
```

## Error Handling

### Error Types

The application uses a standardized error system:

```typescript
export type QueryErrorType =
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'

export interface QueryError extends Error {
  type: QueryErrorType
  originalError?: Error
  context?: Record<string, any>
}
```

### Global Error Boundary

```typescript
// App.tsx
<QueryErrorBoundary>
  <YourApp />
</QueryErrorBoundary>

// Custom error handling per component
<QueryErrorBoundary
  fallback={(error, retry) => (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={retry}>Try Again</button>
    </div>
  )}
>
  <SpecificComponent />
</QueryErrorBoundary>
```

### Retry Strategies

```typescript
// Smart retry logic based on error type
const shouldRetry = (error: Error, failureCount: number, context: string): boolean => {
  // Don't retry client errors (4xx)
  if (error.message.includes('4')) return false

  // Different retry limits for different contexts
  const maxRetries = context === 'auth' ? 1 : 3
  return failureCount < maxRetries
}
```

## Caching Strategies

### Cache Strategy Types

1. **STATIC**: Long-lived data (app version, user profile)
2. **DYNAMIC**: Frequently changing data (API responses, lists)
3. **REALTIME**: Data that needs frequent updates (live status, progress)

```typescript
const CacheStrategies = {
  STATIC: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false
  },
  DYNAMIC: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false
  },
  REALTIME: {
    staleTime: 0, // Always stale
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: true
  }
}
```

### Query Keys Structure

Hierarchical query keys for efficient invalidation:

```typescript
export const queryKeys = {
  user: {
    all: () => ['user'] as const,
    profile: (id?: string) => [...queryKeys.user.all(), 'profile', id] as const,
    authentication: () => [...queryKeys.user.all(), 'auth'] as const
  },
  settings: {
    all: () => ['settings'] as const,
    apiKeys: () => [...queryKeys.settings.all(), 'apiKeys'] as const
  },
  trello: {
    all: () => ['trello'] as const,
    board: (boardId: string) => [...queryKeys.trello.all(), 'board', boardId] as const,
    card: (cardId: string) => [...queryKeys.trello.all(), 'card', cardId] as const
  }
}
```

## Performance Optimization

### Prefetching Strategies

```typescript
// Prefetch on route navigation
const prefetchManager = getPrefetchManager()

// Route-based prefetching
await prefetchManager.prefetchForRoute('/settings')

// Hover-based prefetching
<button
  onMouseEnter={() => prefetchManager.prefetchOnHover('trello-button')}
  onClick={() => navigate('/trello')}
>
  Open Trello
</button>

// Smart prefetching based on user patterns
await prefetchManager.smartPrefetch({
  currentRoute: '/build-project',
  previousRoutes: ['/settings', '/upload'],
  userActions: ['trello', 'settings']
})
```

### Memory Management

```typescript
// Automatic cleanup
const optimizer = new QueryClientOptimizer(queryClient)
optimizer.startAutoCleanup(5 * 60 * 1000) // 5 minutes

// Manual cleanup
optimizer.performCleanup()

// Memory statistics
const stats = optimizer.getMemoryStats()
console.log(`Cache size: ${stats.estimatedSizeFormatted}`)
```

### Performance Monitoring

```typescript
// Monitor query performance
const performanceMonitor = getPerformanceMonitor()

// Get insights
const insights = performanceMonitor.getPerformanceInsights()
insights.forEach(insight => {
  console.log(`${insight.type}: ${insight.message}`)
})

// Measure specific queries
const { data, metrics } = await performanceMonitor.measureQueryPerformance(
  ['user', 'profile'],
  () => fetchUserProfile()
)
```

## Testing Patterns

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUserProfile } from './useUserProfile'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

test('should fetch user profile', async () => {
  const { result } = renderHook(() => useUserProfile('123'), {
    wrapper: createWrapper()
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual(mockUserProfile)
})
```

### MSW Integration

```typescript
// tests/setup/msw-server.ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const server = setupServer(
  http.get('/api/user/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test User' })
  }),

  http.get('https://api.trello.com/*', () => {
    return HttpResponse.json({ lists: [], cards: [] })
  })
)
```

## Migration Guide

### From useEffect to React Query

**Before (Legacy Pattern):**

```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/data')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  fetchData()
}, [dependency])
```

**After (React Query Pattern):**

```typescript
const { data, isLoading, error } = useQuery({
  ...createQueryOptions(
    queryKeys.data.list(dependency),
    async () => {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
    'DYNAMIC',
    {
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => shouldRetry(error, failureCount, 'data')
    }
  )
})
```

### Migration Checklist

- [ ] Replace manual loading/error states with React Query
- [ ] Use query key factory for all queries
- [ ] Implement proper error handling with `createQueryError`
- [ ] Choose appropriate cache strategy (STATIC/DYNAMIC/REALTIME)
- [ ] Add retry logic with `shouldRetry`
- [ ] Remove unused useState and useEffect hooks
- [ ] Update component props to use React Query state
- [ ] Add error boundaries where appropriate
- [ ] Test cache invalidation flows
- [ ] Verify no memory leaks with optimization tools

### Validation

Run the migration validation script:

```bash
npx ts-node scripts/validate-migration.ts
```

This will check for:

- Proper React Query usage
- Remaining legacy patterns
- Query key consistency
- Error handling implementation
- TypeScript compilation

## Best Practices

1. **Always use the query key factory** - Ensures consistency and enables proper cache invalidation
2. **Choose appropriate cache strategies** - Match cache settings to data characteristics
3. **Handle errors properly** - Use standardized error types and global error boundaries
4. **Monitor performance** - Use built-in monitoring tools to identify bottlenecks
5. **Test thoroughly** - Include cache behavior in your testing strategy
6. **Keep queries focused** - One query per data concern for better cache management
7. **Use prefetching strategically** - Improve perceived performance without over-fetching
8. **Clean up unused data** - Implement memory management for large datasets

## Troubleshooting

### Common Issues

**Query not updating:**

- Check if query key includes all dependencies
- Verify staleTime isn't too long
- Ensure proper invalidation after mutations

**Memory leaks:**

- Use optimization tools to monitor cache size
- Implement cleanup strategies for large datasets
- Check for proper component unmounting

**Performance issues:**

- Review prefetching strategies
- Monitor query performance metrics
- Consider pagination for large datasets
- Optimize query key structure

**TypeScript errors:**

- Ensure proper typing for query functions
- Use createQueryOptions for type safety
- Check query key factory types

For more detailed troubleshooting, refer to the performance monitoring insights and validation script output.
