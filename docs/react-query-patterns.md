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
src/shared/
├── lib/
│   ├── query-utils.ts          # Core query utilities and helpers
│   ├── query-keys.ts           # Centralized query key factory
│   ├── prefetch-strategies.ts  # Intelligent prefetching
│   ├── query-client-config.ts  # Advanced cache configuration
│   ├── app-version-query.ts    # Shared query-options factory for app version
│   └── performance-monitor.ts  # Performance monitoring
├── services/
│   └── cache-invalidation.ts   # Cache management service
└── hooks/
    ├── useBreadcrumb.ts       # Navigation state management
    └── [other hooks...]       # Various domain-specific hooks
```

### Key Principles

1. **Centralised Query Keys**: All query keys are managed through a factory pattern
2. **Consistent Error Handling**: Standardised error types and retry logic
3. **Smart Caching**: Different cache strategies based on data characteristics
4. **Performance Monitoring**: Built-in metrics collection and optimisation insights
5. **Type Safety**: Full TypeScript support throughout

## Query Patterns

### Query-Options Factory Pattern

For queries used in more than one place, extract a shared query-options factory so
the key, `queryFn`, cache timings and retry policy are defined once. The app version
query is the canonical example - it was previously duplicated in `NavUser` and
`QueryPrefetchManager` with the same key, same function, and same stale/gc times:

```typescript
// src/shared/lib/app-version-query.ts
import { CACHE } from '@shared/constants'
import { getVersion } from '@tauri-apps/api/app'

import { queryKeys } from './query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from './query-utils'

export function appVersionQueryOptions() {
  return createQueryOptions(
    queryKeys.app.version(),
    async () => {
      try {
        return await getVersion()
      } catch (error) {
        throw createQueryError(`Failed to get app version: ${error}`, 'system')
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
```

Consumers then call `useQuery(appVersionQueryOptions())` or
`queryClient.prefetchQuery(appVersionQueryOptions())` without repeating any of the
configuration.

### Tauri Integration Pattern

For Tauri backend calls, all I/O goes through the feature's `api.ts` and errors are
wrapped with `createQueryError`. The type string must be **lowercase** and a member
of the `QueryError['type']` union (see [Error Types](#error-types)):

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
          throw createQueryError(`Failed to fetch folders: ${error}`, 'network')
        }
      },
      'DYNAMIC',
      {
        enabled: !!apiKey, // Only run if apiKey is available
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'external')
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
          // Fetch via Tauri backend
          return await invoke('refresh_image', { path: imagePath })
        } catch (error) {
          throw createQueryError(`Failed to refresh image: ${error}`, 'system')
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
        throw createQueryError(`Failed to save settings: ${error}`, 'settings')
      }
    },
    onSuccess: (savedSettings) => {
      // Update the cache with new data
      queryClient.setQueryData(queryKeys.settings.apiKeys(), savedSettings)

      // Or invalidate to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    },
    onError: (error) => {
      console.error('Settings save failed:', error)
      // Could show toast notification here
    }
  })
}
```

## Error Handling

### Error Types

The application uses a standardised error system. Error types are **lowercase**
strings. `createQueryError` normalises uppercase inputs to lowercase before matching,
so both `'authentication'` and `'AUTHENTICATION'` resolve to the same type - but
prefer lowercase in new code:

```typescript
export interface QueryError {
  type:
    | 'network'
    | 'server'
    | 'validation'
    | 'timeout'
    | 'authentication'
    | 'system'
    | 'canvas'
    | 'settings'
    | 'unknown'
  message: string
  code?: number
  retryable: boolean
  context?: Record<string, unknown>
}
```

If the type string is not a member of the union (e.g. `'SYSTEM_INFO'`,
`'FOLDERS_FETCH'`), `createQueryError` falls back to `inferErrorType`, which does
substring matching on the message. Prefer using a valid union member so the type is
determined explicitly rather than by accident.

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

Retry conditions are **type-first**: they read the `QueryError['type']` field and
only fall back to message inspection for errors that did not come from
`createQueryError`. This matters because the error message rarely contains the
category substring the condition is searching for - a `createQueryError('API key
missing', 'authentication')` error has type `'authentication'` but the word "auth"
never appears in the message. Before this was fixed (#240, #252, #253), several
retry strategies could never fire at all:

```typescript
// How retry strategies work (from query-utils.ts):
const retryStrategies = {
  auth: {
    attempts: 1,
    delay: () => SECONDS,
    condition: (error: unknown) => {
      // 1. Check the typed field first
      const type = queryErrorType(error)
      if (type !== null) return type === 'authentication'
      // 2. Fall back to message inspection for untyped errors
      return errorMessage(error).toLowerCase().includes('auth')
    }
  }
  // server, system, canvas, settings all follow the same pattern
}

// Usage in a query:
retry: (failureCount, error) => shouldRetry(error, failureCount, 'auth')
```

Available strategies: `network`, `server`, `validation`, `system`, `auth`,
`external`, `canvas`, `settings`, `trello`. There is deliberately no `sprout`
strategy - see issue #155.

Two helpers support the type-first pattern:

- `hasErrorType(error, 'authentication')` - returns `true` if the error carries a
  matching `QueryError['type']` field
- `queryErrorType(error)` (internal) - returns the typed field if present, else
  `null`, letting the condition choose between the type path and the message path

## Caching Strategies

### Query Profiles

Queries use one of four named profiles, passed as the third argument to
`createQueryOptions`. Each profile sets default `staleTime`, `cacheTime`, `retry`
and `refetchOnWindowFocus` values that can be overridden per-query:

1. **STATIC**: Long-lived data (app version, OS username)
2. **DYNAMIC**: Frequently changing data (API keys, lists)
3. **REALTIME**: Data that needs frequent updates (live status, progress)
4. **EXTERNAL**: Third-party API data (Trello, Sprout)

```typescript
export const QUERY_PROFILES = {
  STATIC: {
    staleTime: CACHE.STANDARD, // 5 minutes
    cacheTime: CACHE.MEDIUM, // 10 minutes
    retry: RETRY.DEFAULT_ATTEMPTS, // 3
    refetchOnWindowFocus: false
  },
  DYNAMIC: {
    staleTime: 1 * MINUTES, // 1 minute
    cacheTime: CACHE.GC_STANDARD, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: true
  },
  REALTIME: {
    staleTime: CACHE.SHORT, // 30 seconds
    cacheTime: CACHE.GC_SHORT, // 2 minutes
    retry: 1,
    refetchOnWindowFocus: true
  },
  EXTERNAL: {
    staleTime: 2 * MINUTES, // 2 minutes
    cacheTime: CACHE.GC_STANDARD, // 5 minutes
    retry: RETRY.DEFAULT_ATTEMPTS, // 3
    refetchOnWindowFocus: false
  }
}
```

### Query Keys Structure

Hierarchical query keys for efficient invalidation, organised by domain:

```typescript
export const queryKeys = {
  app: {
    all: ['app'] as const,
    version: () => ['app', 'version'] as const
  },
  os: {
    all: ['os'] as const,
    username: () => ['os', 'username'] as const
  },
  navigation: {
    all: ['navigation'] as const,
    breadcrumb: () => ['navigation', 'breadcrumb'] as const
  },
  settings: {
    all: ['settings'] as const,
    apiKeys: () => ['settings', 'api-keys'] as const
    // preferences, configuration, theme, integrations, backgroundFolderPresent...
  },
  trello: {
    all: ['trello'] as const,
    board: (boardId: string) => ['trello', 'board', boardId] as const,
    card: (cardId: string) => ['trello', 'card', cardId] as const
    // boards, cards, lists, integration, cardDetailsSync, me, pathsPresent...
  },
  sprout: {
    all: ['sprout'] as const,
    folders: (apiKey: string, parentId: string | null) =>
      ['sprout', 'folders', fingerprint(apiKey), parentId || 'root'] as const
    // videos, video...
  },
  projects: {
    /* all, lists, list, details, detail, status */
  },
  files: {
    /* all, selections, selection, tree, progress, autoSelection */
  },
  upload: {
    /* all, events, event, progress, status, backgroundFolder, sprout */
  },
  baker: {
    /* all, pathsPresent */
  },
  kavanagh: {
    /* all, ffmpeg, referencePool, referenceFolderPresent */
  },
  images: {
    /* all, refresh, zoomPan, posterframe */
  },
  camera: {
    /* all, mapping, autoRemap, assignment */
  }
}
```

Credentials (Trello API keys, Sprout tokens) are fingerprinted in query keys using
a non-reversible 8-character hash, never embedded verbatim - see issue #158.

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

Sprout folders are deliberately **not** prefetched. Sprout allows 200 requests per
minute per account, shared with uploads - speculative folder fetches spend budget an
in-flight upload may need. See issue #155.

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
insights.forEach((insight) => {
  console.log(`${insight.type}: ${insight.message}`)
})

// Measure specific queries
const { data, metrics } = await performanceMonitor.measureQueryPerformance(
  ['app', 'version'],
  () => getVersion()
)
```

## Testing Patterns

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

test('should fetch app version', async () => {
  const { result } = renderHook(() => useQuery(appVersionQueryOptions()), {
    wrapper: createWrapper()
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toBe('1.2.3')
})
```

### MSW Integration

```typescript
// tests/setup/msw-server.ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const server = setupServer(
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
      const result = await invoke('get_data', { id: dependency })
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
    queryKeys.projects.detail(dependency),
    async () => {
      try {
        return await invoke('get_data', { id: dependency })
      } catch (error) {
        throw createQueryError(`Failed to fetch project: ${error}`, 'system')
      }
    },
    'DYNAMIC',
    {
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => shouldRetry(error, failureCount, 'system')
    }
  )
})
```

### Migration Checklist

- [ ] Replace manual loading/error states with React Query
- [ ] Use query key factory for all queries
- [ ] Implement proper error handling with `createQueryError`
- [ ] Choose appropriate query profile (STATIC/DYNAMIC/REALTIME/EXTERNAL)
- [ ] Add retry logic with `shouldRetry`
- [ ] Remove unused useState and useEffect hooks
- [ ] Update component props to use React Query state
- [ ] Add error boundaries where appropriate
- [ ] Test cache invalidation flows
- [ ] Verify no memory leaks with optimisation tools

### Validation

The one-off migration validation script (`scripts/validate-migration.ts`) has been
removed now that the migration is complete. The checks it performed:

- Proper React Query usage
- Remaining legacy patterns
- Query key consistency
- Error handling implementation
- TypeScript compilation

## Best Practices

1. **Always use the query key factory** - Ensures consistency and enables proper cache invalidation
2. **Choose appropriate query profiles** - Match cache settings to data characteristics
3. **Handle errors properly** - Use standardised error types and global error boundaries
4. **Monitor performance** - Use built-in monitoring tools to identify bottlenecks
5. **Test thoroughly** - Include cache behaviour in your testing strategy
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

- Use optimisation tools to monitor cache size
- Implement cleanup strategies for large datasets
- Check for proper component unmounting

**Performance issues:**

- Review prefetching strategies
- Monitor query performance metrics
- Consider pagination for large datasets
- Optimise query key structure

**TypeScript errors:**

- Ensure proper typing for query functions
- Use createQueryOptions for type safety
- Check query key factory types
