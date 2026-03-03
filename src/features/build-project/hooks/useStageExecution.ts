/**
 * useStageExecution Hook
 *
 * Manages individual stage execution with timeout and retry support.
 * Provides status tracking, elapsed time measurement, and error handling.
 *
 * @example
 * const { status, result, error, elapsed, execute } = useStageExecution()
 *
 * const stageResult = await execute(
 *   async () => await createFolders(projectPath),
 *   DEFAULT_STAGE_CONFIGS.folders
 * )
 *
 * if (stageResult.ok) {
 *   console.log('Created folders:', stageResult.data)
 * }
 */

import { useCallback, useRef, useState } from 'react'

import {
  BuildProjectError,
  createTimeoutError,
  ErrorKind,
  type StageName,
  type StageConfig,
  type StageResult,
  type StageStatus
} from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Stage execution function type
 * The function to execute for a stage, returning the result data
 */
export type StageFn<T> = () => Promise<T>

/**
 * Partial stage config for execute function
 * Only name is required; other fields have sensible defaults
 */
export interface ExecuteConfig {
  /** Stage identifier (required) */
  name: StageName

  /** Timeout in milliseconds (0 = no timeout, default: 0) */
  timeout?: number

  /** Maximum retry attempts (default: 0) */
  maxRetries?: number

  /** Whether this stage can be retried on failure (default: false) */
  retryable?: boolean
}

/**
 * Return type for useStageExecution hook
 */
export interface UseStageExecutionReturn<T> {
  /** Current execution status */
  status: StageStatus

  /** Result from the last successful execution */
  result: T | null

  /** Error from the last failed execution */
  error: BuildProjectError | null

  /** Elapsed time in milliseconds for the last execution */
  elapsed: number

  /** Execute a stage function with the given configuration */
  execute: (
    stageFn: StageFn<T>,
    config: ExecuteConfig | StageConfig
  ) => Promise<StageResult<T>>

  /** Reset the hook state to initial values */
  reset: () => void
}

/**
 * Internal configuration extracted from ExecuteConfig or StageConfig
 */
interface NormalizedConfig {
  stageName: StageName
  timeout: number
  maxRetries: number
  retryable: boolean
}

/**
 * Result of a single execution attempt
 */
interface AttemptResult<T> {
  success: boolean
  data?: T
  error?: BuildProjectError
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a timeout promise that rejects after the specified duration
 */
function createTimeoutPromise(timeoutMs: number, stageName: StageName): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(createTimeoutError(stageName, timeoutMs))
    }, timeoutMs)
  })
}

/**
 * Execute a function with an optional timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  stageName: StageName
): Promise<T> {
  if (timeoutMs <= 0) {
    return fn()
  }
  return Promise.race([fn(), createTimeoutPromise(timeoutMs, stageName)])
}

/**
 * Delay helper for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 * Base delay of 1 second, doubles each retry, max 30 seconds
 */
function calculateBackoff(attempt: number): number {
  const baseDelay = 1000
  const maxDelay = 30000
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  return Math.min(exponentialDelay, maxDelay)
}

/**
 * Normalize config from ExecuteConfig or StageConfig to internal format
 */
function normalizeConfig(config: ExecuteConfig | StageConfig): NormalizedConfig {
  return {
    stageName: config.name,
    timeout: config.timeout ?? 0,
    maxRetries: config.maxRetries ?? 0,
    retryable: 'retryable' in config ? (config.retryable ?? false) : false
  }
}

/**
 * Determine if an error should trigger a retry
 */
function shouldRetryError(
  error: BuildProjectError,
  attempt: number,
  config: NormalizedConfig
): boolean {
  if (!config.retryable) return false
  if (attempt >= config.maxRetries) return false
  if (error.kind === ErrorKind.Cancelled) return false
  return error.recoverable
}

/**
 * Execute a single attempt of the stage function
 */
async function executeAttempt<T>(
  stageFn: StageFn<T>,
  config: NormalizedConfig,
  attempt: number
): Promise<AttemptResult<T>> {
  try {
    const data = await executeWithTimeout(stageFn, config.timeout, config.stageName)
    return { success: true, data }
  } catch (err) {
    const error = BuildProjectError.fromUnknown(err, config.stageName, {
      attempt: attempt + 1,
      maxRetries: config.maxRetries
    })
    return { success: false, error }
  }
}

/**
 * Create a success StageResult
 */
function createSuccessResult<T>(data: T, durationMs: number): StageResult<T> {
  return { ok: true, data, durationMs }
}

/**
 * Create a failure StageResult from a BuildProjectError
 */
function createFailureResult<T>(
  error: BuildProjectError | null,
  durationMs: number
): StageResult<T> {
  return {
    ok: false,
    error: {
      kind: error?.kind ?? ErrorKind.Unknown,
      message: error?.message ?? 'Unknown error occurred',
      recoverable: error?.recoverable ?? false
    },
    durationMs
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing individual stage execution with timeout and retry support
 *
 * Features:
 * - Execute a single stage with configurable timeout
 * - Automatic retry with exponential backoff
 * - Track stage status (idle, running, success, error)
 * - Track elapsed time for performance monitoring
 * - Wrap errors in BuildProjectError for consistent error handling
 *
 * @returns UseStageExecutionReturn object with status, result, error, elapsed, execute, and reset
 */
export function useStageExecution<T = unknown>(): UseStageExecutionReturn<T> {
  const [status, setStatus] = useState<StageStatus>('idle')
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<BuildProjectError | null>(null)
  const [elapsed, setElapsed] = useState<number>(0)

  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useState(() => {
    return () => {
      isMountedRef.current = false
    }
  })

  /**
   * Reset the hook state to initial values
   */
  const reset = useCallback(() => {
    if (!isMountedRef.current) return
    setStatus('idle')
    setResult(null)
    setError(null)
    setElapsed(0)
  }, [])

  /**
   * Update state for successful execution
   */
  const handleSuccess = useCallback((data: T, durationMs: number) => {
    if (!isMountedRef.current) return
    setStatus('success')
    setResult(data)
    setElapsed(durationMs)
  }, [])

  /**
   * Update state for failed execution
   */
  const handleFailure = useCallback(
    (err: BuildProjectError | null, durationMs: number) => {
      if (!isMountedRef.current) return
      setStatus('error')
      setError(err)
      setElapsed(durationMs)
    },
    []
  )

  /**
   * Execute a stage function with timeout and retry support
   */
  const execute = useCallback(
    async (
      stageFn: StageFn<T>,
      config: ExecuteConfig | StageConfig
    ): Promise<StageResult<T>> => {
      const normalizedConfig = normalizeConfig(config)
      const startTime = performance.now()

      if (isMountedRef.current) {
        setStatus('running')
        setError(null)
      }

      let lastError: BuildProjectError | null = null
      let attempt = 0

      while (attempt <= normalizedConfig.maxRetries) {
        const attemptResult = await executeAttempt(stageFn, normalizedConfig, attempt)

        if (attemptResult.success && attemptResult.data !== undefined) {
          const durationMs = Math.round(performance.now() - startTime)
          handleSuccess(attemptResult.data, durationMs)
          return createSuccessResult(attemptResult.data, durationMs)
        }

        lastError = attemptResult.error ?? null

        if (lastError && shouldRetryError(lastError, attempt, normalizedConfig)) {
          await delay(calculateBackoff(attempt))
          attempt++
        } else {
          break
        }
      }

      const durationMs = Math.round(performance.now() - startTime)
      handleFailure(lastError, durationMs)
      return createFailureResult<T>(lastError, durationMs)
    },
    [handleSuccess, handleFailure]
  )

  return {
    status,
    result,
    error,
    elapsed,
    execute,
    reset
  }
}
