import { CACHE, getBackoffDelay, MINUTES, RETRY, SECONDS } from '@constants/timing'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'

import { logger } from '@/utils/logger'

export type QueryKey =
  | readonly [
      domain: string,
      action: string,
      ...identifiers: readonly (string | number)[]
    ]
  | readonly (string | number)[]

export interface QueryConfiguration {
  queryKey: QueryKey
  staleTime: number
  cacheTime: number
  retry: number | boolean
  refetchOnWindowFocus: boolean
}

export interface MutationConfiguration<
  TData = unknown,
  TVariables = unknown,
  TContext = unknown
> {
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (variables: TVariables) => Promise<TContext>
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void
  onError?: (error: Error, variables: TVariables, context: TContext) => void
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext
  ) => void
}

export type QueryDomain = 'projects' | 'trello' | 'files' | 'user' | 'settings' | 'upload'

export interface LoadingState {
  isLoading: boolean
  isFetching: boolean
  isRefetching: boolean
  isLoadingError: boolean
  progress?: number
}

export interface ProgressState {
  total: number
  completed: number
  percentage: number
  estimatedTimeRemaining?: number
  currentItem?: string
}

export interface QueryError {
  type:
    | 'network'
    | 'server'
    | 'validation'
    | 'timeout'
    | 'authentication'
    | 'system'
    | 'unknown'
  message: string
  code?: number
  retryable: boolean
  context?: Record<string, unknown>
}

export interface RetryConfiguration {
  attempts: number
  delay: (attempt: number) => number
  condition: (error: Error) => boolean
}

export const QUERY_PROFILES = {
  STATIC: {
    staleTime: CACHE.STANDARD,
    cacheTime: CACHE.MEDIUM,
    retry: RETRY.DEFAULT_ATTEMPTS,
    refetchOnWindowFocus: false
  },
  DYNAMIC: {
    staleTime: 1 * MINUTES,
    cacheTime: CACHE.GC_STANDARD,
    retry: 2,
    refetchOnWindowFocus: true
  },
  REALTIME: {
    staleTime: CACHE.SHORT,
    cacheTime: CACHE.GC_SHORT,
    retry: 1,
    refetchOnWindowFocus: true
  },
  EXTERNAL: {
    staleTime: 2 * MINUTES,
    cacheTime: CACHE.GC_STANDARD,
    retry: RETRY.DEFAULT_ATTEMPTS,
    refetchOnWindowFocus: false
  }
} as const

export function createQueryOptions<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  profile: keyof typeof QUERY_PROFILES = 'DYNAMIC',
  overrides?: Partial<UseQueryOptions<TData>>
): UseQueryOptions<TData> {
  const profileConfig = QUERY_PROFILES[profile]

  return {
    queryKey,
    queryFn,
    ...profileConfig,
    ...overrides
  }
}

export function createMutationOptions<
  TData = unknown,
  TVariables = unknown,
  TContext = unknown
>(
  config: MutationConfiguration<TData, TVariables, TContext>
): UseMutationOptions<TData, Error, TVariables, TContext> {
  return {
    mutationFn: config.mutationFn,
    onMutate: config.onMutate,
    onSuccess: config.onSuccess,
    onError: config.onError,
    onSettled: config.onSettled
  }
}

export const retryStrategies: Record<string, RetryConfiguration> = {
  network: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_DEFAULT),
    condition: (error: Error) =>
      error.name === 'NetworkError' || error.message.includes('network')
  },
  server: {
    attempts: 2,
    delay: (attempt: number) => SECONDS * attempt,
    condition: (error: Error) =>
      error.message.includes('5') && error.message.includes('server')
  },
  validation: {
    attempts: 0,
    delay: () => 0,
    condition: () => false
  },
  system: {
    attempts: 2,
    delay: (attempt: number) => 500 * attempt,
    condition: (error: Error) =>
      error.message.includes('system') || error.message.includes('app version')
  },
  auth: {
    attempts: 1,
    delay: () => SECONDS,
    condition: (error: Error) =>
      error.message.includes('auth') || error.message.includes('unauthorized')
  },
  external: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION),
    condition: (error: Error) =>
      error.name === 'NetworkError' || error.message.includes('network')
  },
  canvas: {
    attempts: 2,
    delay: (attempt: number) => SECONDS * attempt,
    condition: (error: Error) =>
      error.message.includes('canvas') || error.message.includes('render')
  },
  settings: {
    attempts: 1,
    delay: () => 500,
    condition: (error: Error) =>
      error.message.includes('read') || error.message.includes('parse')
  },
  trello: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION),
    condition: (error: Error) =>
      error.name === 'NetworkError' || error.message.includes('network')
  },
  sprout: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION),
    condition: (error: Error) =>
      error.name === 'NetworkError' || error.message.includes('network')
  }
}

export function shouldRetry(
  error: Error,
  attempt: number,
  strategy: keyof typeof retryStrategies
): boolean {
  const config = retryStrategies[strategy]
  if (!config) {
    logger.warn(`Unknown retry strategy: ${strategy}, using default`)
    return attempt < 3 // Default to 3 attempts
  }
  return attempt < config.attempts && config.condition(error)
}

export function getRetryDelay(
  attempt: number,
  strategy: keyof typeof retryStrategies
): number {
  const config = retryStrategies[strategy]
  if (!config) {
    logger.warn(`Unknown retry strategy: ${strategy}, using default delay`)
    return getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION)
  }
  return config.delay(attempt)
}

/**
 * Infer error type from error message for better type safety
 */
export function inferErrorType(errorInfo: string): QueryError['type'] {
  const lowerError = errorInfo.toLowerCase()

  if (lowerError.includes('network') || lowerError.includes('connection'))
    return 'network'
  if (lowerError.includes('timeout')) return 'timeout'
  if (lowerError.includes('auth') || lowerError.includes('unauthorized'))
    return 'authentication'
  if (lowerError.includes('system') || lowerError.includes('app version')) return 'system'
  if (lowerError.includes('validation') || lowerError.includes('invalid'))
    return 'validation'
  if (lowerError.includes('server') || lowerError.includes('internal')) return 'server'

  return 'unknown'
}

export function createQueryError(
  message: string,
  typeOrInfo?: QueryError['type'] | string,
  code?: number,
  context?: Record<string, unknown>
): QueryError {
  // If typeOrInfo is a recognized error type, use it directly
  const validTypes = [
    'network',
    'server',
    'validation',
    'timeout',
    'authentication',
    'system',
    'unknown'
  ]
  const type = validTypes.includes(typeOrInfo as string)
    ? (typeOrInfo as QueryError['type'])
    : inferErrorType(typeOrInfo || message)

  return {
    type,
    message,
    code,
    retryable: type === 'network' || type === 'server' || type === 'timeout',
    context
  }
}

export function calculateProgress(completed: number, total: number): ProgressState {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return {
    total,
    completed,
    percentage
  }
}
