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
    | 'canvas'
    | 'settings'
    | 'unknown'
  message: string
  code?: number
  retryable: boolean
  context?: Record<string, unknown>
}

export interface RetryConfiguration {
  attempts: number
  delay: (attempt: number) => number
  /**
   * Takes `unknown`, not `Error`. A Tauri command returning `Err(String)`
   * rejects with a bare string, so a condition typed to `Error` both misses
   * every backend failure and throws on `error.message.includes(...)` -- #156.
   */
  condition: (error: unknown) => boolean
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

/** True when the error looks like a transport failure worth another attempt. */
const isTransportError = (error: unknown): boolean =>
  (error instanceof Error && error.name === 'NetworkError') ||
  errorMessage(error).toLowerCase().includes('network')

/**
 * Whether the error carries a typed `QueryError['type']` matching `expected`.
 *
 * `createQueryError` stores the category in a structured field, but until #240
 * every retry condition and `classifyError` grepped the message instead and
 * never consulted the field. This helper lets conditions check the type first,
 * falling back to message inspection only for errors that did not come from
 * `createQueryError`.
 */
export function hasErrorType(error: unknown, expected: QueryError['type']): boolean {
  if (error && typeof error === 'object' && 'type' in error) {
    return (error as { type: unknown }).type === expected
  }
  return false
}

/**
 * Returns the `QueryError['type']` field if the error carries one, else `null`.
 *
 * Used by retry conditions to decide whether to trust the typed field (and skip
 * message inspection) or fall back to message grepping for untyped errors.
 */
function queryErrorType(error: unknown): QueryError['type'] | null {
  if (error && typeof error === 'object' && 'type' in error) {
    const type = (error as { type: unknown }).type
    if (typeof type === 'string') return type as QueryError['type']
  }
  return null
}

export const retryStrategies: Record<string, RetryConfiguration> = {
  network: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_DEFAULT),
    condition: isTransportError
  },
  server: {
    attempts: 2,
    delay: (attempt: number) => SECONDS * attempt,
    condition: (error: unknown) => {
      const status = httpStatus(error)
      if (status !== null) return status >= 500
      const type = queryErrorType(error)
      if (type !== null) return type === 'server'
      return errorMessage(error).toLowerCase().includes('server')
    }
  },
  validation: {
    attempts: 0,
    delay: () => 0,
    condition: () => false
  },
  system: {
    attempts: 2,
    delay: (attempt: number) => 500 * attempt,
    condition: (error: unknown) => {
      const type = queryErrorType(error)
      if (type !== null) return type === 'system'
      const message = errorMessage(error).toLowerCase()
      return message.includes('system') || message.includes('app version')
    }
  },
  auth: {
    attempts: 1,
    delay: () => SECONDS,
    condition: (error: unknown) => {
      const type = queryErrorType(error)
      if (type !== null) return type === 'authentication'
      return errorMessage(error).toLowerCase().includes('auth')
    }
  },
  external: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION),
    condition: isTransportError
  },
  canvas: {
    attempts: 2,
    delay: (attempt: number) => SECONDS * attempt,
    condition: (error: unknown) => {
      const type = queryErrorType(error)
      if (type !== null) return type === 'canvas'
      const message = errorMessage(error).toLowerCase()
      return message.includes('canvas') || message.includes('render')
    }
  },
  settings: {
    attempts: 1,
    delay: () => 500,
    condition: (error: unknown) => {
      const type = queryErrorType(error)
      if (type !== null) return type === 'settings'
      const message = errorMessage(error).toLowerCase()
      return message.includes('read') || message.includes('parse')
    }
  },
  trello: {
    attempts: RETRY.DEFAULT_ATTEMPTS,
    delay: (attempt: number) => getBackoffDelay(attempt, RETRY.MAX_DELAY_MUTATION),
    condition: isTransportError
  }
  // NOTE: there is deliberately no `sprout` strategy. Its only consumer was
  // `prefetchSproutFolders`, removed in #155, and its condition could never
  // match a Tauri rejection anyway. Sprout queries set `retry` explicitly so a
  // 429 is never retried into a closed rate-limit window -- see #155 R4.
}

export function shouldRetry(
  error: unknown,
  attempt: number,
  strategy: keyof typeof retryStrategies
): boolean {
  // No strategy may retry these, however its condition is written.
  if (isRateLimited(error) || isAuthError(error)) return false

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

/**
 * Extracts an HTTP status code from a rejection, if it carries one.
 *
 * Reads a numeric `status` field before the message text: a `PosterFrameError`
 * rejects with `{ status, message }`, so the code never appears in the message
 * and a text-only read would misclassify it. Matched as a status code rather
 * than a substring -- the predicate this replaced tested
 * `message.includes('4')`, which matched the character in
 * "timed out after 4 seconds". See #156.
 */
function httpStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number' && Number.isFinite(status)) return status
  }
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
 * The app's default retry predicate, for `QueryClient` defaults and any hook
 * that has no more specific policy.
 *
 * Replaces four hand-rolled copies of `error.message.includes('4')`, which
 * matched the *character* `4` rather than a status code -- blocking retryable
 * 5xx errors ("HTTP 500 — timed out after 4 seconds") while permitting the 429
 * retries it was written to prevent, because a Tauri bare-string rejection is
 * not an `Error` and skipped the guard entirely. See #156.
 *
 * A 429 is never retried. Sprout's 200 requests/minute limit is account-wide and
 * shared with uploads, so retrying spends budget that was just exhausted while
 * the window is still closed, and can fail a user's in-flight upload. The wait
 * Sprout reports via `Retry-After` is surfaced in the error message by the Rust
 * side and drives the cooloff in `Upload/internal/sproutRateBudget.ts`; refusing
 * the retry here is what keeps that cooloff meaningful.
 */
export function shouldRetryRequest(
  error: unknown,
  failureCount: number,
  maxAttempts: number = RETRY.DEFAULT_ATTEMPTS
): boolean {
  if (isRateLimited(error)) return false
  if (isAuthError(error)) return false

  // Any other 4xx is the caller's fault and will fail identically on a retry.
  const status = httpStatus(error)
  if (status !== null && status >= 400 && status < 500) return false

  // 5xx, transport failures and unclassifiable errors are worth another attempt.
  return failureCount < maxAttempts
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
  // Normalise to lowercase before comparing: the QueryError['type'] union is
  // lowercase, but every call site historically passed UPPERCASE ('AUTHENTICATION',
  // 'SYSTEM_INFO', 'SERVER'). The explicit-type branch was never taken because
  // validTypes.includes('AUTHENTICATION') is false. Fixed by #240.
  const validTypes: QueryError['type'][] = [
    'network',
    'server',
    'validation',
    'timeout',
    'authentication',
    'system',
    'canvas',
    'settings',
    'unknown'
  ]
  const normalised = typeof typeOrInfo === 'string' ? typeOrInfo.toLowerCase() : undefined
  const type =
    normalised && validTypes.includes(normalised as QueryError['type'])
      ? (normalised as QueryError['type'])
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
