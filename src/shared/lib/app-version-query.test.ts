/**
 * Tests for the app version query-options factory.
 *
 * Pins two guarantees from issue #242:
 *
 * 1. The app version is cached under an app-namespaced key (`['app', 'version']`),
 *    not under the former `['user', 'profile']`.
 * 2. Invalidating user data does not discard the cached app version.
 */

import { queryKeys } from '@shared/lib/query-keys'
import { CacheInvalidationService } from '@shared/services/cache-invalidation'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { appVersionQueryOptions } from './app-version-query'

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: async () => '1.2.3'
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('appVersionQueryOptions', () => {
  it('caches the version under queryKeys.app.version()', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })

    const { result } = renderHook(() => useQuery(appVersionQueryOptions()), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = queryClient.getQueryData(queryKeys.app.version())
    expect(cached).toBe('1.2.3')
  })

  it('does not cache under the retired user.profile key', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })

    const { result } = renderHook(() => useQuery(appVersionQueryOptions()), {
      wrapper: createWrapper(queryClient)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // The old key must not hold data
    const stale = queryClient.getQueryData(['user', 'profile'])
    expect(stale).toBeUndefined()
  })

  it('survives invalidateUserData without being discarded (#242)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })

    // Seed the cache with the version
    queryClient.setQueryData(queryKeys.app.version(), '1.2.3')

    // Invalidate user data
    const service = new CacheInvalidationService(queryClient)
    await service.invalidateUserData()

    // The version must still be present
    const cached = queryClient.getQueryData(queryKeys.app.version())
    expect(cached).toBe('1.2.3')
  })
})
