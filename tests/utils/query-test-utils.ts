import { type QueryKey } from '@lib/query-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import * as React from 'react'
import { ReactElement, ReactNode } from 'react'

export interface QueryTestOptions {
  queryClient?: QueryClient
  initialData?: Record<string, unknown>
  mockNetworkDelay?: number
  enableLogging?: boolean
}

export function createTestQueryClient(options: QueryTestOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        ...options
      },
      mutations: {
        retry: false,
        ...options
      }
    },
    logger: options.enableLogging
      ? {
          log: console.log,
          warn: console.warn,
          error: console.error
        }
      : {
          log: () => {},
          warn: () => {},
          error: () => {}
        }
  })
}

interface QueryWrapperProps {
  children: ReactNode
  queryClient: QueryClient
}

function QueryWrapper({ children, queryClient }: QueryWrapperProps) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

export interface RenderWithQueryClientOptions extends Omit<RenderOptions, 'wrapper'> {
  queryTestOptions?: QueryTestOptions
}

export function renderWithQueryClient(
  ui: ReactElement,
  options: RenderWithQueryClientOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryTestOptions = {}, ...renderOptions } = options
  const queryClient =
    queryTestOptions.queryClient || createTestQueryClient(queryTestOptions)

  // Pre-populate cache with initial data
  if (queryTestOptions.initialData) {
    Object.entries(queryTestOptions.initialData).forEach(([keyString, data]) => {
      const queryKey = JSON.parse(keyString) as QueryKey
      queryClient.setQueryData(queryKey, data)
    })
  }

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryWrapper, { queryClient }, children)

  return {
    ...render(ui, { wrapper, ...renderOptions }),
    queryClient
  }
}

export interface MockQueryOptions<TData = unknown> {
  queryKey: QueryKey
  data?: TData
  error?: Error
  delay?: number
  shouldFail?: boolean
}

export function mockQuery<TData = any>(
  queryClient: QueryClient,
  options: MockQueryOptions<TData>
): void {
  const { queryKey, data, error, delay = 0, shouldFail = false } = options

  // Instead of storing a mock function, set the actual data
  if (shouldFail && error) {
    // Create a query that fails
    const queryCache = queryClient.getQueryCache()
    const query = queryCache.build(queryClient, {
      queryKey,
      queryFn: async () => {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        throw error
      }
    })

    // Trigger the query to populate error state
    query.fetch()
  } else {
    // Set successful data immediately
    queryClient.setQueryData(queryKey, data)
  }
}

export interface QueryTestAssertion {
  queryKey: QueryKey
  expectedCallCount?: number
  expectedData?: unknown
  expectedError?: Error
  timeoutMs?: number
}

export async function waitForQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
  timeoutMs: number = 5000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Query ${JSON.stringify(queryKey)} did not resolve within ${timeoutMs}ms`
        )
      )
    }, timeoutMs)

    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.queryKey === queryKey) {
        clearTimeout(timeout)
        unsubscribe()
        resolve(event.query.state.data)
      }
    })
  })
}

export function getQueryState(queryClient: QueryClient, queryKey: QueryKey) {
  const query = queryClient.getQueryCache().find(queryKey)
  return query?.state
}

export function assertQuerySuccess(
  queryClient: QueryClient,
  queryKey: QueryKey,
  expectedData?: unknown
): void {
  const query = queryClient.getQueryCache().find(queryKey)

  if (!query) {
    throw new Error(`Query with key ${JSON.stringify(queryKey)} not found`)
  }

  if (query.state.status !== 'success') {
    throw new Error(
      `Expected query to be successful, but status was ${query.state.status}`
    )
  }

  if (expectedData !== undefined && query.state.data !== expectedData) {
    throw new Error(
      `Expected query data to be ${expectedData}, but got ${query.state.data}`
    )
  }
}

export function assertQueryError(
  queryClient: QueryClient,
  queryKey: QueryKey,
  expectedError?: Error
): void {
  const query = queryClient.getQueryCache().find(queryKey)

  if (!query) {
    throw new Error(`Query with key ${JSON.stringify(queryKey)} not found`)
  }

  if (query.state.status !== 'error') {
    throw new Error(
      `Expected query to be in error state, but status was ${query.state.status}`
    )
  }

  if (expectedError && query.state.error?.message !== expectedError.message) {
    throw new Error(
      `Expected error message "${expectedError.message}", but got "${query.state.error?.message}"`
    )
  }
}

export function assertQueryLoading(queryClient: QueryClient, queryKey: QueryKey): void {
  const query = queryClient.getQueryCache().find(queryKey)

  if (!query) {
    throw new Error(`Query with key ${JSON.stringify(queryKey)} not found`)
  }

  if (query.state.status !== 'loading') {
    throw new Error(`Expected query to be loading, but status was ${query.state.status}`)
  }
}

export class QueryTestRunner {
  private queryClient: QueryClient
  private assertions: QueryTestAssertion[] = []

  constructor(queryClient?: QueryClient) {
    this.queryClient = queryClient || createTestQueryClient()
  }

  expect(assertion: QueryTestAssertion): this {
    this.assertions.push(assertion)
    return this
  }

  async run(): Promise<void> {
    const results = await Promise.allSettled(
      this.assertions.map(async assertion => {
        const {
          queryKey,
          expectedCallCount,
          expectedData,
          expectedError,
          timeoutMs = 5000
        } = assertion

        if (expectedData !== undefined) {
          await waitForQuery(this.queryClient, queryKey, timeoutMs)
          assertQuerySuccess(this.queryClient, queryKey, expectedData)
        }

        if (expectedError !== undefined) {
          await waitForQuery(this.queryClient, queryKey, timeoutMs)
          assertQueryError(this.queryClient, queryKey, expectedError)
        }
      })
    )

    const failures = results
      .map((result, index) => ({ result, assertion: this.assertions[index] }))
      .filter(({ result }) => result.status === 'rejected')

    if (failures.length > 0) {
      const errorMessages = failures
        .map(
          ({ result, assertion }) =>
            `Query ${JSON.stringify(assertion.queryKey)}: ${(result as PromiseRejectedResult).reason.message}`
        )
        .join('\n')

      throw new Error(`Query test assertions failed:\n${errorMessages}`)
    }
  }

  reset(): this {
    this.assertions = []
    this.queryClient.clear()
    return this
  }
}

export interface HookTestContract<TData = unknown, TVariables = unknown> {
  hookName: string
  inputs: TVariables
  expectedQueries: QueryKey[]
  expectedMutations?: string[]
  mockResponses: Record<string, TData>
  testScenarios: {
    name: string
    setup?: () => void
    action?: () => void
    expectations?: QueryTestAssertion[]
  }[]
}

export async function testHookContract<TData = unknown, TVariables = unknown>(
  contract: HookTestContract<TData, TVariables>
): Promise<void> {
  const queryClient = createTestQueryClient()

  // Setup mock responses directly as cached data
  Object.entries(contract.mockResponses).forEach(([keyString, data]) => {
    const queryKey = JSON.parse(keyString) as QueryKey
    queryClient.setQueryData(queryKey, data)
  })

  // Run test scenarios
  for (const scenario of contract.testScenarios) {
    if (scenario.setup) {
      scenario.setup()
    }

    if (scenario.action) {
      scenario.action()
    }

    if (scenario.expectations) {
      // Simple expectations verification
      for (const expectation of scenario.expectations) {
        const { queryKey, expectedData } = expectation
        const cachedData = queryClient.getQueryData(queryKey)

        if (expectedData) {
          expect(cachedData).toEqual(expectedData)
        }
      }
    }
  }
}
