/**
 * Stage Types and Helpers Unit Tests
 *
 * Tests for the common stage type definitions and helper functions
 * used across all BuildProject workflow stages.
 */

import { describe, expect, it } from 'vitest'

import {
  BuildProjectError,
  createAlreadyExistsError,
  createCancellationError,
  createIOError,
  createNotFoundError,
  createPermissionError,
  createTimeoutError,
  createValidationError,
  ErrorKind,
  getErrorKindDisplayName,
  getUserFriendlyErrorMessage,
  isBuildProjectError,
  isRecoverableError,
  isStageError
} from '../types/errors'
import {
  createInitialStageState,
  createStageFailure,
  createStageSuccess,
  DEFAULT_STAGE_CONFIGS,
  type StageConfig,
  type StageResult
} from '../types/stages'

describe('Stage Types and Helpers', () => {
  // ============================================================================
  // StageResult Type Handling
  // ============================================================================

  describe('StageResult type handling', () => {
    describe('createStageSuccess', () => {
      it('should create a successful result with data', () => {
        const data = { message: 'Success', count: 42 }
        const result = createStageSuccess(data, 150)

        expect(result.ok).toBe(true)
        expect(result.data).toEqual(data)
        expect(result.durationMs).toBe(150)
      })

      it('should handle primitive data types', () => {
        const stringResult = createStageSuccess('test', 100)
        expect(stringResult.ok).toBe(true)
        expect(stringResult.data).toBe('test')

        const numberResult = createStageSuccess(123, 50)
        expect(numberResult.ok).toBe(true)
        expect(numberResult.data).toBe(123)

        const boolResult = createStageSuccess(true, 25)
        expect(boolResult.ok).toBe(true)
        expect(boolResult.data).toBe(true)
      })

      it('should handle null and undefined data', () => {
        const nullResult = createStageSuccess(null, 100)
        expect(nullResult.ok).toBe(true)
        expect(nullResult.data).toBeNull()

        const undefinedResult = createStageSuccess(undefined, 100)
        expect(undefinedResult.ok).toBe(true)
        expect(undefinedResult.data).toBeUndefined()
      })

      it('should handle array data', () => {
        const arrayData = ['item1', 'item2', 'item3']
        const result = createStageSuccess(arrayData, 75)

        expect(result.ok).toBe(true)
        expect(result.data).toEqual(arrayData)
        expect(result.data).toHaveLength(3)
      })

      it('should record duration correctly', () => {
        const result = createStageSuccess({}, 0)
        expect(result.durationMs).toBe(0)

        const longResult = createStageSuccess({}, 60000)
        expect(longResult.durationMs).toBe(60000)
      })
    })

    describe('createStageFailure', () => {
      it('should create a failure result with error details', () => {
        const result = createStageFailure(
          'Validation',
          'Project name is required',
          true,
          50
        )

        expect(result.ok).toBe(false)
        expect(result.error.kind).toBe('Validation')
        expect(result.error.message).toBe('Project name is required')
        expect(result.error.recoverable).toBe(true)
        expect(result.durationMs).toBe(50)
      })

      it('should handle non-recoverable errors', () => {
        const result = createStageFailure(
          'Permission',
          'Access denied to folder',
          false,
          100
        )

        expect(result.ok).toBe(false)
        expect(result.error.recoverable).toBe(false)
      })

      it('should handle different error kinds', () => {
        const kinds = ['IO', 'Timeout', 'Cancelled', 'NotFound', 'Unknown']

        kinds.forEach((kind) => {
          const result = createStageFailure(kind, `${kind} error`, true, 10)
          expect(result.error.kind).toBe(kind)
        })
      })
    })

    describe('type narrowing with ok property', () => {
      it('should narrow to StageSuccess when ok is true', () => {
        const result: StageResult<string> = createStageSuccess('data', 100)

        if (result.ok) {
          // TypeScript should recognize result as StageSuccess<string>
          const data: string = result.data
          expect(data).toBe('data')
        }
      })

      it('should narrow to StageFailure when ok is false', () => {
        const result: StageResult<string> = createStageFailure(
          'Error',
          'message',
          true,
          100
        )

        if (!result.ok) {
          // TypeScript should recognize result as StageFailure
          const errorMessage: string = result.error.message
          expect(errorMessage).toBe('message')
        }
      })

      it('should allow using result in conditional logic', () => {
        const successResult: StageResult<number> = createStageSuccess(42, 100)
        const failureResult: StageResult<number> = createStageFailure(
          'Error',
          'failed',
          true,
          50
        )

        const getValue = (result: StageResult<number>): number | null => {
          return result.ok ? result.data : null
        }

        expect(getValue(successResult)).toBe(42)
        expect(getValue(failureResult)).toBeNull()
      })
    })

    describe('createInitialStageState', () => {
      it('should create initial state from config', () => {
        const config: StageConfig = {
          name: 'validation',
          displayName: 'Validating',
          timeout: 30000,
          retryable: true,
          maxRetries: 3,
          cancellable: true,
          parallel: false,
          dependsOn: []
        }

        const state = createInitialStageState(config)

        expect(state.config).toEqual(config)
        expect(state.status).toBe('idle')
        expect(state.retryCount).toBe(0)
        expect(state.startedAt).toBeNull()
        expect(state.completedAt).toBeNull()
        expect(state.errorMessage).toBeNull()
        expect(state.progress).toBeNull()
      })
    })

    describe('DEFAULT_STAGE_CONFIGS', () => {
      it('should have all required stage configurations', () => {
        expect(DEFAULT_STAGE_CONFIGS.validation).toBeDefined()
        expect(DEFAULT_STAGE_CONFIGS.folders).toBeDefined()
        expect(DEFAULT_STAGE_CONFIGS.template).toBeDefined()
        expect(DEFAULT_STAGE_CONFIGS.breadcrumbs).toBeDefined()
        expect(DEFAULT_STAGE_CONFIGS['file-transfer']).toBeDefined()
      })

      it('should have correct dependencies for each stage', () => {
        expect(DEFAULT_STAGE_CONFIGS.validation.dependsOn).toHaveLength(0)
        expect(DEFAULT_STAGE_CONFIGS.folders.dependsOn).toContain('validation')
        expect(DEFAULT_STAGE_CONFIGS.template.dependsOn).toContain('folders')
        expect(DEFAULT_STAGE_CONFIGS.breadcrumbs.dependsOn).toContain('folders')
        expect(DEFAULT_STAGE_CONFIGS['file-transfer'].dependsOn).toContain('breadcrumbs')
      })
    })
  })

  // ============================================================================
  // Error Wrapping with StageError
  // ============================================================================

  describe('error wrapping with StageError', () => {
    describe('BuildProjectError class', () => {
      it('should create error with all properties', () => {
        const error = new BuildProjectError(
          ErrorKind.Validation,
          'validation',
          'Invalid project name',
          true,
          {
            code: 'INVALID_NAME',
            context: { name: 'test<>' }
          }
        )

        expect(error.kind).toBe(ErrorKind.Validation)
        expect(error.stage).toBe('validation')
        expect(error.message).toBe('Invalid project name')
        expect(error.recoverable).toBe(true)
        expect(error.code).toBe('INVALID_NAME')
        expect(error.context).toEqual({ name: 'test<>' })
        expect(error.timestamp).toBeDefined()
      })

      it('should extend Error class', () => {
        const error = new BuildProjectError(ErrorKind.IO, 'folders', 'Write failed', true)

        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(BuildProjectError)
        expect(error.name).toBe('BuildProjectError')
      })

      it('should convert to StageError format', () => {
        const error = new BuildProjectError(
          ErrorKind.Permission,
          'file-transfer',
          'Access denied',
          false,
          { code: 'EACCES', context: { path: '/protected' } }
        )

        const stageError = error.toStageError()

        expect(stageError.kind).toBe(ErrorKind.Permission)
        expect(stageError.stage).toBe('file-transfer')
        expect(stageError.message).toBe('Access denied')
        expect(stageError.recoverable).toBe(false)
        expect(stageError.code).toBe('EACCES')
      })

      it('should create from StageError object', () => {
        const stageError = {
          kind: ErrorKind.Timeout,
          stage: 'template' as const,
          message: 'Operation timed out',
          recoverable: true,
          code: 'TIMEOUT'
        }

        const error = BuildProjectError.fromStageError(stageError)

        expect(error.kind).toBe(ErrorKind.Timeout)
        expect(error.stage).toBe('template')
        expect(error.message).toBe('Operation timed out')
        expect(error.recoverable).toBe(true)
      })

      it('should create from unknown error', () => {
        const unknownError = new Error('Something went wrong')
        const error = BuildProjectError.fromUnknown(unknownError, 'breadcrumbs')

        expect(error.kind).toBe(ErrorKind.Unknown)
        expect(error.stage).toBe('breadcrumbs')
        expect(error.message).toBe('Something went wrong')
        expect(error.recoverable).toBe(false)
        expect(error.cause).toBe(unknownError)
      })

      it('should preserve BuildProjectError when using fromUnknown', () => {
        const original = new BuildProjectError(
          ErrorKind.IO,
          'folders',
          'Original error',
          true
        )

        const result = BuildProjectError.fromUnknown(original, 'validation')

        expect(result).toBe(original)
        expect(result.stage).toBe('folders') // Preserves original stage
      })
    })

    describe('error factory functions', () => {
      it('should create validation error', () => {
        const error = createValidationError('validation', 'Invalid input', {
          field: 'name'
        })

        expect(error.kind).toBe(ErrorKind.Validation)
        expect(error.stage).toBe('validation')
        expect(error.recoverable).toBe(true)
        expect(error.code).toBe('VALIDATION_ERROR')
      })

      it('should create IO error', () => {
        const error = createIOError('folders', 'Write failed', {
          path: '/test'
        })

        expect(error.kind).toBe(ErrorKind.IO)
        expect(error.recoverable).toBe(true)
        expect(error.code).toBe('IO_ERROR')
      })

      it('should create permission error', () => {
        const error = createPermissionError(
          'file-transfer',
          'Access denied',
          '/protected/path'
        )

        expect(error.kind).toBe(ErrorKind.Permission)
        expect(error.recoverable).toBe(false)
        expect(error.code).toBe('PERMISSION_DENIED')
        expect(error.context?.path).toBe('/protected/path')
      })

      it('should create timeout error', () => {
        const error = createTimeoutError('template', 30000)

        expect(error.kind).toBe(ErrorKind.Timeout)
        expect(error.message).toContain('30000ms')
        expect(error.recoverable).toBe(true)
        expect(error.context?.timeoutMs).toBe(30000)
      })

      it('should create cancellation error', () => {
        const error = createCancellationError('file-transfer')

        expect(error.kind).toBe(ErrorKind.Cancelled)
        expect(error.recoverable).toBe(false)
        expect(error.code).toBe('CANCELLED')
      })

      it('should create already exists error', () => {
        const error = createAlreadyExistsError('folders', '/existing/path')

        expect(error.kind).toBe(ErrorKind.AlreadyExists)
        expect(error.message).toContain('/existing/path')
        expect(error.recoverable).toBe(true)
      })

      it('should create not found error', () => {
        const error = createNotFoundError('validation', '/missing/path')

        expect(error.kind).toBe(ErrorKind.NotFound)
        expect(error.message).toContain('/missing/path')
        expect(error.recoverable).toBe(false)
      })
    })

    describe('type guards', () => {
      it('should identify BuildProjectError instances', () => {
        const buildError = new BuildProjectError(ErrorKind.IO, 'folders', 'test', true)
        const regularError = new Error('test')

        expect(isBuildProjectError(buildError)).toBe(true)
        expect(isBuildProjectError(regularError)).toBe(false)
        expect(isBuildProjectError(null)).toBe(false)
        expect(isBuildProjectError(undefined)).toBe(false)
        expect(isBuildProjectError('string')).toBe(false)
      })

      it('should identify StageError objects', () => {
        const stageError = {
          kind: ErrorKind.IO,
          message: 'test',
          stage: 'folders',
          recoverable: true
        }

        expect(isStageError(stageError)).toBe(true)
        expect(isStageError({ kind: 'IO', message: 'test' })).toBe(false)
        expect(isStageError(null)).toBe(false)
        expect(isStageError({})).toBe(false)
      })

      it('should check if error is recoverable', () => {
        const recoverableError = new BuildProjectError(
          ErrorKind.IO,
          'folders',
          'test',
          true
        )
        const nonRecoverableError = new BuildProjectError(
          ErrorKind.Permission,
          'folders',
          'test',
          false
        )

        expect(isRecoverableError(recoverableError)).toBe(true)
        expect(isRecoverableError(nonRecoverableError)).toBe(false)
        expect(isRecoverableError(new Error('test'))).toBe(false)
      })
    })

    describe('user-friendly error messages', () => {
      it('should return appropriate message for validation errors', () => {
        const error = new BuildProjectError(
          ErrorKind.Validation,
          'validation',
          'Custom validation message',
          true
        )

        expect(getUserFriendlyErrorMessage(error)).toBe('Custom validation message')
      })

      it('should return appropriate message for permission errors', () => {
        const error = new BuildProjectError(
          ErrorKind.Permission,
          'folders',
          'Access denied',
          false
        )

        expect(getUserFriendlyErrorMessage(error)).toContain('Permission denied')
      })

      it('should return appropriate message for timeout errors', () => {
        const error = new BuildProjectError(
          ErrorKind.Timeout,
          'template',
          'Timed out',
          true
        )

        expect(getUserFriendlyErrorMessage(error)).toContain('took too long')
      })

      it('should return appropriate message for cancellation', () => {
        const error = new BuildProjectError(
          ErrorKind.Cancelled,
          'file-transfer',
          'Cancelled',
          false
        )

        expect(getUserFriendlyErrorMessage(error)).toContain('cancelled')
      })

      it('should handle regular Error objects', () => {
        const error = new Error('Regular error message')

        expect(getUserFriendlyErrorMessage(error)).toBe('Regular error message')
      })

      it('should handle non-error values', () => {
        expect(getUserFriendlyErrorMessage('string error')).toBe(
          'An unexpected error occurred.'
        )
        expect(getUserFriendlyErrorMessage(null)).toBe('An unexpected error occurred.')
      })
    })

    describe('error kind display names', () => {
      it('should return display names for all error kinds', () => {
        expect(getErrorKindDisplayName(ErrorKind.Validation)).toBe('Validation Error')
        expect(getErrorKindDisplayName(ErrorKind.IO)).toBe('File System Error')
        expect(getErrorKindDisplayName(ErrorKind.Permission)).toBe('Permission Error')
        expect(getErrorKindDisplayName(ErrorKind.Timeout)).toBe('Timeout Error')
        expect(getErrorKindDisplayName(ErrorKind.Cancelled)).toBe('Cancelled')
        expect(getErrorKindDisplayName(ErrorKind.AlreadyExists)).toBe('Already Exists')
        expect(getErrorKindDisplayName(ErrorKind.NotFound)).toBe('Not Found')
        expect(getErrorKindDisplayName(ErrorKind.TemplateCorrupted)).toBe(
          'Template Error'
        )
        expect(getErrorKindDisplayName(ErrorKind.InsufficientSpace)).toBe(
          'Insufficient Space'
        )
        expect(getErrorKindDisplayName(ErrorKind.Network)).toBe('Network Error')
        expect(getErrorKindDisplayName(ErrorKind.Unknown)).toBe('Unknown Error')
      })
    })
  })
})
