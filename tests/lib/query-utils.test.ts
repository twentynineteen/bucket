import { calculateProgress, createQueryError, inferErrorType } from '@lib/query-utils'
import { describe, expect, it } from 'vitest'

describe('Query Utils', () => {
  describe('inferErrorType', () => {
    it('should infer network errors correctly', () => {
      expect(inferErrorType('Network connection failed')).toBe('network')
      expect(inferErrorType('Connection timeout')).toBe('network')
    })

    it('should infer authentication errors correctly', () => {
      expect(inferErrorType('Unauthorized access')).toBe('authentication')
      expect(inferErrorType('Auth token expired')).toBe('authentication')
    })

    it('should infer system errors correctly', () => {
      expect(inferErrorType('Failed to get app version')).toBe('system')
      expect(inferErrorType('System configuration error')).toBe('system')
    })

    it('should default to unknown for unrecognized patterns', () => {
      expect(inferErrorType('Something weird happened')).toBe('unknown')
    })
  })

  describe('createQueryError', () => {
    it('should create error with inferred type', () => {
      const error = createQueryError('Network connection failed')

      expect(error.type).toBe('network')
      expect(error.message).toBe('Network connection failed')
      expect(error.retryable).toBe(true)
    })

    it('should create error with explicit type', () => {
      const error = createQueryError('Custom error', 'validation')

      expect(error.type).toBe('validation')
      expect(error.message).toBe('Custom error')
      expect(error.retryable).toBe(false)
    })

    it('should handle non-retryable error types', () => {
      const error = createQueryError('Bad request', 'validation')
      expect(error.retryable).toBe(false)
    })

    it('should handle retryable error types', () => {
      const error = createQueryError('Server error', 'server')
      expect(error.retryable).toBe(true)
    })
  })

  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      const progress = calculateProgress(25, 100)

      expect(progress.completed).toBe(25)
      expect(progress.total).toBe(100)
      expect(progress.percentage).toBe(25)
    })

    it('should handle zero total', () => {
      const progress = calculateProgress(0, 0)
      expect(progress.percentage).toBe(0)
    })

    it('should handle completion', () => {
      const progress = calculateProgress(100, 100)
      expect(progress.percentage).toBe(100)
    })

    it('should round percentage correctly', () => {
      const progress = calculateProgress(33, 100)
      expect(progress.percentage).toBe(33)
    })
  })
})
