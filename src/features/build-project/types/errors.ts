/**
 * BuildProject Error Type Definitions
 *
 * Defines error types, error kinds, and error handling utilities
 * for the BuildProject workflow stages.
 */

import type { StageName } from './stages'

// ============================================================================
// Error Kind Enum
// ============================================================================

/**
 * Enumeration of all possible error kinds in the BuildProject workflow.
 * Maps to Rust error kinds for consistent error handling across the stack.
 */
export enum ErrorKind {
  /** Input validation failed (e.g., invalid project title, missing files) */
  Validation = 'Validation',

  /** File system I/O error (read/write failed) */
  IO = 'IO',

  /** Insufficient permissions to access file/folder */
  Permission = 'Permission',

  /** Operation timed out */
  Timeout = 'Timeout',

  /** Operation was cancelled by user */
  Cancelled = 'Cancelled',

  /** File or folder already exists */
  AlreadyExists = 'AlreadyExists',

  /** File or folder not found */
  NotFound = 'NotFound',

  /** Template file is corrupted or invalid */
  TemplateCorrupted = 'TemplateCorrupted',

  /** Disk space insufficient for operation */
  InsufficientSpace = 'InsufficientSpace',

  /** Network-related error (if applicable) */
  Network = 'Network',

  /** Unknown or unexpected error */
  Unknown = 'Unknown'
}

// ============================================================================
// Stage Error Interface (matches Rust structure)
// ============================================================================

/**
 * Error structure matching Rust backend error format.
 * Used for Tauri command error responses.
 */
export interface StageError {
  /** The kind/category of error */
  kind: ErrorKind

  /** Human-readable error message */
  message: string

  /** Which stage the error occurred in */
  stage: StageName

  /** Whether this error can be recovered from (retry possible) */
  recoverable: boolean

  /** Optional error code for programmatic handling */
  code?: string

  /** Optional additional context about the error */
  context?: Record<string, unknown>

  /** Optional stack trace (development only) */
  stack?: string
}

// ============================================================================
// BuildProjectError Class
// ============================================================================

/**
 * Custom error class for BuildProject workflow errors.
 * Extends the native Error class with additional metadata.
 *
 * @example
 * throw new BuildProjectError(
 *   ErrorKind.Validation,
 *   'validation',
 *   'Project title cannot be empty',
 *   true
 * )
 *
 * @example
 * try {
 *   await createFolders()
 * } catch (err) {
 *   if (err instanceof BuildProjectError && err.recoverable) {
 *     // Attempt retry
 *   }
 * }
 */
export class BuildProjectError extends Error {
  /** Error kind/category */
  readonly kind: ErrorKind

  /** Stage where the error occurred */
  readonly stage: StageName

  /** Whether this error is recoverable */
  readonly recoverable: boolean

  /** Optional error code */
  readonly code?: string

  /** Optional additional context */
  readonly context?: Record<string, unknown>

  /** Timestamp when error was created */
  readonly timestamp: string

  /** The underlying cause of this error */
  readonly cause?: Error

  constructor(
    kind: ErrorKind,
    stage: StageName,
    message: string,
    recoverable: boolean,
    options?: {
      code?: string
      context?: Record<string, unknown>
      cause?: Error
    }
  ) {
    super(message)

    this.name = 'BuildProjectError'
    this.kind = kind
    this.stage = stage
    this.recoverable = recoverable
    this.code = options?.code
    this.context = options?.context
    this.cause = options?.cause
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BuildProjectError)
    }
  }

  /**
   * Convert to StageError format for serialization
   */
  toStageError(): StageError {
    return {
      kind: this.kind,
      message: this.message,
      stage: this.stage,
      recoverable: this.recoverable,
      code: this.code,
      context: this.context,
      stack: this.stack
    }
  }

  /**
   * Create a BuildProjectError from a StageError object
   */
  static fromStageError(stageError: StageError): BuildProjectError {
    return new BuildProjectError(
      stageError.kind,
      stageError.stage,
      stageError.message,
      stageError.recoverable,
      {
        code: stageError.code,
        context: stageError.context
      }
    )
  }

  /**
   * Create a BuildProjectError from an unknown error
   */
  static fromUnknown(
    error: unknown,
    stage: StageName,
    context?: Record<string, unknown>
  ): BuildProjectError {
    if (error instanceof BuildProjectError) {
      return error
    }

    if (error instanceof Error) {
      return new BuildProjectError(ErrorKind.Unknown, stage, error.message, false, {
        context: {
          ...context,
          originalName: error.name
        },
        cause: error
      })
    }

    return new BuildProjectError(ErrorKind.Unknown, stage, String(error), false, {
      context
    })
  }
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Type guard to check if an error is a BuildProjectError
 */
export function isBuildProjectError(error: unknown): error is BuildProjectError {
  return error instanceof BuildProjectError
}

/**
 * Type guard to check if an error is a StageError object
 */
export function isStageError(error: unknown): error is StageError {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const obj = error as Record<string, unknown>
  return (
    typeof obj.kind === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.stage === 'string' &&
    typeof obj.recoverable === 'boolean'
  )
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (isBuildProjectError(error)) {
    return error.recoverable
  }
  if (isStageError(error)) {
    return error.recoverable
  }
  return false
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a validation error
 */
export function createValidationError(
  stage: StageName,
  message: string,
  context?: Record<string, unknown>
): BuildProjectError {
  return new BuildProjectError(ErrorKind.Validation, stage, message, true, {
    code: 'VALIDATION_ERROR',
    context
  })
}

/**
 * Create an I/O error
 */
export function createIOError(
  stage: StageName,
  message: string,
  context?: Record<string, unknown>
): BuildProjectError {
  return new BuildProjectError(ErrorKind.IO, stage, message, true, {
    code: 'IO_ERROR',
    context
  })
}

/**
 * Create a permission error
 */
export function createPermissionError(
  stage: StageName,
  message: string,
  path?: string
): BuildProjectError {
  return new BuildProjectError(ErrorKind.Permission, stage, message, false, {
    code: 'PERMISSION_DENIED',
    context: path ? { path } : undefined
  })
}

/**
 * Create a timeout error
 */
export function createTimeoutError(
  stage: StageName,
  timeoutMs: number
): BuildProjectError {
  return new BuildProjectError(
    ErrorKind.Timeout,
    stage,
    `Operation timed out after ${timeoutMs}ms`,
    true,
    {
      code: 'TIMEOUT',
      context: { timeoutMs }
    }
  )
}

/**
 * Create a cancellation error
 */
export function createCancellationError(stage: StageName): BuildProjectError {
  return new BuildProjectError(
    ErrorKind.Cancelled,
    stage,
    'Operation was cancelled by user',
    false,
    { code: 'CANCELLED' }
  )
}

/**
 * Create an "already exists" error
 */
export function createAlreadyExistsError(
  stage: StageName,
  path: string
): BuildProjectError {
  return new BuildProjectError(
    ErrorKind.AlreadyExists,
    stage,
    `Path already exists: ${path}`,
    true,
    {
      code: 'ALREADY_EXISTS',
      context: { path }
    }
  )
}

/**
 * Create a "not found" error
 */
export function createNotFoundError(stage: StageName, path: string): BuildProjectError {
  return new BuildProjectError(
    ErrorKind.NotFound,
    stage,
    `Path not found: ${path}`,
    false,
    {
      code: 'NOT_FOUND',
      context: { path }
    }
  )
}

// ============================================================================
// Error Message Helpers
// ============================================================================

/**
 * Get a user-friendly error message for display
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (isBuildProjectError(error)) {
    switch (error.kind) {
      case ErrorKind.Validation:
        return error.message
      case ErrorKind.Permission:
        return `Permission denied: ${error.message}`
      case ErrorKind.Timeout:
        return 'The operation took too long. Please try again.'
      case ErrorKind.Cancelled:
        return 'Operation was cancelled.'
      case ErrorKind.AlreadyExists:
        return error.message
      case ErrorKind.NotFound:
        return error.message
      case ErrorKind.InsufficientSpace:
        return 'Not enough disk space to complete the operation.'
      case ErrorKind.TemplateCorrupted:
        return 'The project template file is corrupted. Please reinstall the application.'
      case ErrorKind.IO:
        return `File operation failed: ${error.message}`
      default:
        return error.message || 'An unexpected error occurred.'
    }
  }

  if (isStageError(error)) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

/**
 * Get the error kind as a display string
 */
export function getErrorKindDisplayName(kind: ErrorKind): string {
  const displayNames: Record<ErrorKind, string> = {
    [ErrorKind.Validation]: 'Validation Error',
    [ErrorKind.IO]: 'File System Error',
    [ErrorKind.Permission]: 'Permission Error',
    [ErrorKind.Timeout]: 'Timeout Error',
    [ErrorKind.Cancelled]: 'Cancelled',
    [ErrorKind.AlreadyExists]: 'Already Exists',
    [ErrorKind.NotFound]: 'Not Found',
    [ErrorKind.TemplateCorrupted]: 'Template Error',
    [ErrorKind.InsufficientSpace]: 'Insufficient Space',
    [ErrorKind.Network]: 'Network Error',
    [ErrorKind.Unknown]: 'Unknown Error'
  }
  return displayNames[kind] || 'Error'
}
