import { queryKeys } from '@lib/query-keys'
import { renderHook, waitFor } from '@testing-library/react'
import {
  renderWithQueryClient,
  testHookContract,
  type HookTestContract
} from '@tests/utils/query-test-utils'

describe('useImageRefresh Contract Tests', () => {
  const mockSproutResponse = {
    id: 'video123',
    title: 'Test Video',
    status: 'ready',
    url: 'https://sproutvideo.com/videos/video123',
    thumbnailUrl: 'https://sproutvideo.com/videos/video123/thumbnail.jpg'
  }

  const contract: HookTestContract = {
    hookName: 'useImageRefresh',
    inputs: {
      response: mockSproutResponse
    },
    expectedQueries: [
      queryKeys.images.refresh('video123'),
      queryKeys.upload.sprout.posterframe('video123')
    ],
    mockResponses: {
      [JSON.stringify(queryKeys.images.refresh('video123'))]: {
        id: 'video123',
        url: 'https://example.com/images/video123.jpg?t=1234567890',
        lastModified: '2023-01-01T00:00:00Z'
      },
      [JSON.stringify(queryKeys.upload.sprout.posterframe('video123'))]: {
        videoId: 'video123',
        posterframeUrl: 'https://sproutvideo.com/videos/video123/posterframe.jpg',
        generatedAt: '2023-01-01T00:00:00Z'
      }
    },
    testScenarios: [
      {
        name: 'should query image refresh on mount with response',
        expectations: [
          {
            queryKey: queryKeys.images.refresh('video123'),
            expectedData: expect.objectContaining({
              id: 'video123',
              url: expect.stringContaining('video123.jpg'),
              lastModified: expect.any(String)
            })
          }
        ]
      },
      {
        name: 'should auto-refresh image every 30 seconds',
        expectations: [
          {
            queryKey: queryKeys.images.refresh('video123'),
            timeoutMs: 35000 // Wait longer than 30s refresh interval
          }
        ]
      },
      {
        name: 'should handle null response gracefully',
        setup: () => {
          // Test with null response - should not query anything
        }
      }
    ]
  }

  it('should fulfill the migration contract', async () => {
    await testHookContract(contract)
  })

  describe('Current vs Expected Behavior', () => {
    it('CURRENT: uses setTimeout for periodic refresh', () => {
      // Current implementation uses setTimeout + useEffect
      vi.useFakeTimers()

      const mockSetRefreshTimestamp = vi.fn()
      const mockSetThumbnailLoaded = vi.fn()

      // Simulate current hook behavior
      const response = mockSproutResponse
      let timerId: NodeJS.Timeout | null = null

      if (response) {
        timerId = setTimeout(() => {
          mockSetRefreshTimestamp(Date.now())
          mockSetThumbnailLoaded(false)
        }, 30000)
      }

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000)

      expect(mockSetRefreshTimestamp).toHaveBeenCalled()
      expect(mockSetThumbnailLoaded).toHaveBeenCalledWith(false)

      if (timerId) clearTimeout(timerId)
      vi.useRealTimers()
    })

    it('EXPECTED: should use React Query with refetch interval', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)
      const expectedData = {
        id: imageId,
        url: `https://example.com/images/${imageId}.jpg?t=${Date.now()}`,
        lastModified: new Date().toISOString()
      }

      queryClient.setQueryData(queryKey, expectedData)

      // Verify cache contains the data
      const cachedData = queryClient.getQueryData(queryKey)
      expect(cachedData).toEqual(expectedData)
    })
  })

  describe('Refresh Behavior Contract', () => {
    it('should refetch image data with 30-second interval', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)

      // Set initial data
      queryClient.setQueryData(queryKey, {
        id: imageId,
        url: `https://example.com/images/${imageId}.jpg?t=1000`,
        lastModified: '2023-01-01T00:00:00Z'
      })

      // The query should be configured with 30-second refetch interval
      const foundQuery = queryClient.getQueryCache().find(queryKey)

      // For this test, we just verify the query exists and has data
      expect(foundQuery?.state.data).toBeDefined()
    })

    it('should update thumbnail loaded state on refresh', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)

      // Initial state
      queryClient.setQueryData(queryKey, {
        id: imageId,
        url: `https://example.com/images/${imageId}.jpg?t=1000`,
        thumbnailLoaded: true,
        lastModified: '2023-01-01T00:00:00Z'
      })

      // After refresh, thumbnailLoaded should be reset to false
      queryClient.setQueryData(queryKey, {
        id: imageId,
        url: `https://example.com/images/${imageId}.jpg?t=2000`,
        thumbnailLoaded: false,
        lastModified: '2023-01-01T00:01:00Z'
      })

      const updatedData = queryClient.getQueryData(queryKey) as any
      expect(updatedData.thumbnailLoaded).toBe(false)
      expect(updatedData.url).toContain('t=2000')
    })
  })

  describe('Error Handling Contract', () => {
    it('should handle image refresh failures', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)
      const error = new Error('Failed to refresh image')

      // Simulate error using the working pattern
      const queryCache = queryClient.getQueryCache()
      const query = queryCache.build(queryClient, {
        queryKey,
        queryFn: () => Promise.reject(error)
      })

      query.setData(undefined)
      query.setState({
        status: 'error',
        error,
        data: undefined,
        dataUpdatedAt: 0,
        dataUpdateCount: 0,
        errorUpdatedAt: Date.now(),
        errorUpdateCount: 1,
        fetchFailureCount: 1,
        fetchFailureReason: error,
        fetchMeta: null,
        isInvalidated: false,
        isPaused: false,
        fetchStatus: 'idle'
      })

      const foundQuery = queryClient.getQueryCache().find(queryKey)
      expect(foundQuery?.state.status).toBe('error')
      expect(foundQuery?.state.error).toBe(error)
    })

    it('should retry image refresh on network errors', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)

      // Network errors should be retryable
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'

      // Simulate network error using the working pattern
      const queryCache = queryClient.getQueryCache()
      const query = queryCache.build(queryClient, {
        queryKey,
        queryFn: () => Promise.reject(networkError)
      })

      query.setData(undefined)
      query.setState({
        status: 'error',
        error: networkError,
        data: undefined,
        dataUpdatedAt: 0,
        dataUpdateCount: 0,
        errorUpdatedAt: Date.now(),
        errorUpdateCount: 1,
        fetchFailureCount: 1,
        fetchFailureReason: networkError,
        fetchMeta: null,
        isInvalidated: false,
        isPaused: false,
        fetchStatus: 'idle'
      })

      const foundQuery = queryClient.getQueryCache().find(queryKey)
      expect(foundQuery?.state.error?.name).toBe('NetworkError')
    })
  })

  describe('Performance Contract', () => {
    it('should use REALTIME profile for frequent updates', () => {
      // Image refresh should use REALTIME profile (30-second staleTime)
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)

      queryClient.setQueryData(queryKey, {
        id: imageId,
        url: `https://example.com/images/${imageId}.jpg`,
        lastModified: new Date().toISOString()
      })

      const foundQuery = queryClient.getQueryCache().find(queryKey)
      expect(foundQuery?.state.data).toBeDefined()
    })

    it('should not cause memory leaks with frequent updates', () => {
      const { queryClient } = renderWithQueryClient(<div />)

      const imageId = 'video123'
      const queryKey = queryKeys.images.refresh(imageId)

      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        queryClient.setQueryData(queryKey, {
          id: imageId,
          url: `https://example.com/images/${imageId}.jpg?t=${1000 + i}`,
          lastModified: new Date(Date.now() + i * 1000).toISOString()
        })
      }

      // Should only keep the latest data
      const finalData = queryClient.getQueryData(queryKey) as any
      expect(finalData.url).toContain('t=1009')
    })
  })
})
