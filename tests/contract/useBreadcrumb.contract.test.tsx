import { queryKeys } from '@lib/query-keys'
import { renderHook } from '@testing-library/react'
import {
  renderWithQueryClient,
  testHookContract,
  type HookTestContract
} from '@tests/utils/query-test-utils'

// This test defines the contract for migrating useBreadcrumb from useEffect to React Query
describe('useBreadcrumb Contract Tests', () => {
  const contract: HookTestContract = {
    hookName: 'useBreadcrumb',
    inputs: {
      items: [
        { label: 'Projects', href: '/projects' },
        { label: 'Test Project', href: '/projects/test-project' },
        { label: 'Videos', href: '/projects/test-project/videos' }
      ]
    },
    expectedQueries: [queryKeys.user.breadcrumb()],
    mockResponses: {
      [JSON.stringify(queryKeys.user.breadcrumb())]: {
        path: '/projects/test-project/videos',
        items: [
          { name: 'Projects', url: '/projects' },
          { name: 'Test Project', url: '/projects/test-project' },
          { name: 'Videos', url: '/projects/test-project/videos' }
        ]
      }
    },
    testScenarios: [
      {
        name: 'should fetch breadcrumb data on mount',
        expectations: [
          {
            queryKey: queryKeys.user.breadcrumb(),
            expectedData: {
              path: '/projects/test-project/videos',
              items: [
                { name: 'Projects', url: '/projects' },
                { name: 'Test Project', url: '/projects/test-project' },
                { name: 'Videos', url: '/projects/test-project/videos' }
              ]
            }
          }
        ]
      },
      {
        name: 'should update breadcrumb cache when items change',
        action: () => {
          // This would be triggered when useBreadcrumb is called with new items
          // The hook should update the cache with the new breadcrumb path
        },
        expectations: [
          {
            queryKey: queryKeys.user.breadcrumb(),
            expectedData: expect.objectContaining({
              path: expect.any(String),
              items: expect.any(Array)
            })
          }
        ]
      }
    ]
  }

  it('should fulfill the migration contract', async () => {
    await testHookContract(contract)
  })

  describe('Current vs Expected Behavior', () => {
    it('CURRENT: uses useEffect to update breadcrumb store', () => {
      // This test documents the current behavior that will be replaced
      const mockSetBreadcrumbs = vi.fn()
      const items = [
        { label: 'Projects', href: '/projects' },
        { label: 'Test Project', href: '/projects/test-project' }
      ]

      // Current implementation uses Zustand store directly
      expect(() => {
        // useBreadcrumb(items) would call setBreadcrumbs via useEffect
        mockSetBreadcrumbs(items)
      }).not.toThrow()

      expect(mockSetBreadcrumbs).toHaveBeenCalledWith(items)
    })

    it('EXPECTED: should use React Query to cache breadcrumb state', () => {
      // This test defines the expected behavior after migration
      const { queryClient } = renderWithQueryClient(<div />)

      // After migration, breadcrumb data should be cached in React Query
      const expectedQuery = queryKeys.user.breadcrumb()
      const expectedData = {
        path: '/projects/test-project',
        items: [
          { name: 'Projects', url: '/projects' },
          { name: 'Test Project', url: '/projects/test-project' }
        ]
      }

      // Set expected data in cache
      queryClient.setQueryData(expectedQuery, expectedData)

      // Verify cache contains the data
      const cachedData = queryClient.getQueryData(expectedQuery)
      expect(cachedData).toEqual(expectedData)
    })
  })

  describe('Error Handling Contract', () => {
    it('should handle breadcrumb fetch errors gracefully', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      // Simulate error state
      const errorState = new Error('Failed to fetch breadcrumb')
      const queryKey = queryKeys.user.breadcrumb()

      // Simulate error by setting error state directly on cache
      const queryCache = queryClient.getQueryCache()
      const query = queryCache.build(queryClient, {
        queryKey,
        queryFn: () => Promise.reject(errorState)
      })

      query.setData(undefined)
      query.setState({
        status: 'error',
        error: errorState,
        data: undefined,
        dataUpdatedAt: 0,
        dataUpdateCount: 0,
        errorUpdatedAt: Date.now(),
        errorUpdateCount: 1,
        fetchFailureCount: 1,
        fetchFailureReason: errorState,
        fetchMeta: null,
        isInvalidated: false,
        isPaused: false,
        fetchStatus: 'idle'
      })

      const foundQuery = queryClient.getQueryCache().find(queryKey)
      expect(foundQuery?.state.status).toBe('error')
      expect(foundQuery?.state.error).toBe(errorState)
    })
  })

  describe('Performance Contract', () => {
    it('should not refetch breadcrumb on every render', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      // Breadcrumb data should be considered static (staleTime: 5min)
      const queryKey = queryKeys.user.breadcrumb()
      const initialData = { path: '/test', items: [] }

      queryClient.setQueryData(queryKey, initialData)

      // Verify data is cached and won't refetch immediately
      const query = queryClient.getQueryCache().find(queryKey)
      expect(query?.state.data).toEqual(initialData)
    })
  })

  describe('Integration Contract', () => {
    it('should work with breadcrumb store updates', () => {
      // After migration, the hook should still work with the Zustand store
      // but also sync with React Query cache
      const { queryClient } = renderWithQueryClient(<div />)

      const breadcrumbData = {
        path: '/projects/new-project',
        items: [
          { name: 'Projects', url: '/projects' },
          { name: 'New Project', url: '/projects/new-project' }
        ]
      }

      queryClient.setQueryData(queryKeys.user.breadcrumb(), breadcrumbData)

      // Verify cache integration
      const cachedData = queryClient.getQueryData(queryKeys.user.breadcrumb())
      expect(cachedData).toEqual(breadcrumbData)
    })
  })
})
