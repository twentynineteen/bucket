/**
 * Test Utility: QueryClient Wrapper
 * Purpose: Provide reusable QueryClient setup for tests using React Query
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

/**
 * Create a QueryClient configured for testing
 * - Disables retries for faster test execution
 * - Disables mutations for predictable behavior
 */
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity // Prevent garbage collection during tests
      },
      mutations: {
        retry: false
      }
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {} // Suppress console noise in tests
    }
  })
}

/**
 * Create a wrapper component with QueryClientProvider
 * Usage in tests:
 *
 * const { result } = renderHook(() => useMyHook(), {
 *   wrapper: createQueryWrapper()
 * })
 *
 * Or with custom client:
 * const queryClient = createTestQueryClient()
 * const { result } = renderHook(() => useMyHook(), {
 *   wrapper: createQueryWrapper(queryClient)
 * })
 */
export const createQueryWrapper = (queryClient?: QueryClient) => {
  const client = queryClient || createTestQueryClient()

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

/**
 * Convenience function to render components with QueryClient
 * Usage:
 *
 * import { renderWithQueryClient } from '@tests/utils/queryClientWrapper'
 *
 * const { getByText } = renderWithQueryClient(<MyComponent />)
 */
export const renderWithQueryClient = (
  ui: React.ReactElement,
  queryClient?: QueryClient
) => {
  const client = queryClient || createTestQueryClient()

  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
    queryClient: client
  }
}
