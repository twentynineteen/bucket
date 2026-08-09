import { CACHE, getBackoffDelay, MINUTES, RETRY, SECONDS } from '@shared/constants'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'

import { logger } from '@shared/utils'

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
  }
  // NOTE: there is deliberately no `sprout` strategy. Its only consumer was
  // `prefetchSproutFolders`, removed in #155, and its condition could never
  // match a Tauri rejection anyway. Sprout queries set `retry` explicitly so a
  // 429 is never retried into a closed rate-limit window -- see #155 R4.
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
 * Reads an error's message regardless of how it was thrown.
 *
 * Tauri commands returning `Err(String)` reject with a **bare string**, not an
 * `Error` -- so anything typed to `Error` silently misses every backend failure
 * in this app. See `useFileUpload.ts`, which already branches on
 * `typeof error === 'string'`. Issue #155 / #156.
 */
function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return ''
}

/** Extracts an HTTP status code from an error message, if it names one. */
function httpStatus(error: unknown): number | null {
  const match = errorMessage(error).match(/\bHTTP (\d{3})\b/i)
  return match ? Number(match[1]) : null
}

/**
 * Whether an error is a rate limit (HTTP 429).
 *
 * Never retry one: retrying spends more of the budget that was just exhausted,
 * while the window is still closed. Sprout's limit is 200 requests/minute and is
 * account-wide, so an amplified retry can fail a user's in-flight upload.
 */
export function isRateLimited(error: unknown): boolean {
  if (httpStatus(error) === 429) return true
  const message = errorMessage(error).toLowerCase()
  return message.includes('rate limit') || message.includes('too many requests')
}

/** Whether an error is an authentication or authorisation failure (401/403). */
export function isAuthError(error: unknown): boolean {
  const status = httpStatus(error)
  if (status === 401 || status === 403) return true
  const message = errorMessage(error).toLowerCase()
  return message.includes('unauthorized') || message.includes('forbidden')
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
