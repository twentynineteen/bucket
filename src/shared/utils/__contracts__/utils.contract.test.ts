/**
 * Contract tests for @shared/utils barrel
 *
 * Verifies export shape and behavioral contracts for logger, storage,
 * debounce, validation, version utilities, and breadcrumbs formatting.
 */

import { describe, expect, test, vi } from 'vitest'

import {
  // Logger
  logger,
  createNamespacedLogger,
  // Debounce
  debounce,
  // Validation
  validateVideoLink,
  validateTrelloCard,
  extractTrelloCardId,
  isValidHttpsUrl,
  isValidIso8601,
  isWithinLength,
  // Version utilities
  normalizeVersion,
  parseVersion,
  compareVersions,
  isUpdateAvailable,
  // Breadcrumbs utilities
  formatBreadcrumbDate,
  formatBreadcrumbDateSimple,
  formatFieldName,
  formatFieldValue,
  formatFileSize,
  compareBreadcrumbs,
  compareBreadcrumbsMeaningful,
  categorizeField,
  createDetailedFieldChange,
  generateProjectChangeDetail,
  generateBreadcrumbsPreview,
  debugComparison
} from '@shared/utils'

// Storage exports require Tauri runtime, test shape only via dynamic import
// import { saveApiKeys, loadApiKeys } from '@shared/utils'

describe('@shared/utils barrel contract', () => {
  describe('shape: all expected exports exist', () => {
    test('logger exports', () => {
      expect(logger).toBeDefined()
      expect(createNamespacedLogger).toBeTypeOf('function')
    })

    test('debounce export', () => {
      expect(debounce).toBeTypeOf('function')
    })

    test('validation exports', () => {
      expect(validateVideoLink).toBeTypeOf('function')
      expect(validateTrelloCard).toBeTypeOf('function')
      expect(extractTrelloCardId).toBeTypeOf('function')
      expect(isValidHttpsUrl).toBeTypeOf('function')
      expect(isValidIso8601).toBeTypeOf('function')
      expect(isWithinLength).toBeTypeOf('function')
    })

    test('version utility exports', () => {
      expect(normalizeVersion).toBeTypeOf('function')
      expect(parseVersion).toBeTypeOf('function')
      expect(compareVersions).toBeTypeOf('function')
      expect(isUpdateAvailable).toBeTypeOf('function')
    })

    test('breadcrumbs utility exports', () => {
      expect(formatBreadcrumbDate).toBeTypeOf('function')
      expect(formatBreadcrumbDateSimple).toBeTypeOf('function')
      expect(formatFieldName).toBeTypeOf('function')
      expect(formatFieldValue).toBeTypeOf('function')
      expect(formatFileSize).toBeTypeOf('function')
      expect(compareBreadcrumbs).toBeTypeOf('function')
      expect(compareBreadcrumbsMeaningful).toBeTypeOf('function')
      expect(categorizeField).toBeTypeOf('function')
      expect(createDetailedFieldChange).toBeTypeOf('function')
      expect(generateProjectChangeDetail).toBeTypeOf('function')
      expect(generateBreadcrumbsPreview).toBeTypeOf('function')
      expect(debugComparison).toBeTypeOf('function')
    })
  })

  describe('behavior: logger works correctly', () => {
    test('logger has all expected methods', () => {
      expect(logger.log).toBeTypeOf('function')
      expect(logger.info).toBeTypeOf('function')
      expect(logger.debug).toBeTypeOf('function')
      expect(logger.trace).toBeTypeOf('function')
      expect(logger.error).toBeTypeOf('function')
      expect(logger.warn).toBeTypeOf('function')
      expect(logger.group).toBeTypeOf('function')
      expect(logger.groupEnd).toBeTypeOf('function')
      expect(logger.table).toBeTypeOf('function')
      expect(logger.time).toBeTypeOf('function')
      expect(logger.timeEnd).toBeTypeOf('function')
    })

    test('createNamespacedLogger returns logger with same methods', () => {
      const nsLogger = createNamespacedLogger('Test')
      expect(nsLogger.log).toBeTypeOf('function')
      expect(nsLogger.info).toBeTypeOf('function')
      expect(nsLogger.error).toBeTypeOf('function')
      expect(nsLogger.warn).toBeTypeOf('function')
      expect(nsLogger.group).toBeTypeOf('function')
      expect(nsLogger.groupEnd).toBeTypeOf('function')
    })
  })

  describe('behavior: debounce works correctly', () => {
    test('debounce returns a function with cancel method', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)
      expect(debounced).toBeTypeOf('function')
      expect(debounced.cancel).toBeTypeOf('function')
    })

    test('debounce delays execution', () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    test('debounce cancel prevents execution', () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced.cancel()

      vi.advanceTimersByTime(200)
      expect(fn).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('behavior: validation functions work correctly', () => {
    test('validateVideoLink accepts valid video link', () => {
      const errors = validateVideoLink({
        url: 'https://sproutvideo.com/videos/abc123',
        title: 'Test Video'
      })
      expect(errors).toEqual([])
    })

    test('validateVideoLink rejects non-HTTPS URL', () => {
      const errors = validateVideoLink({
        url: 'http://sproutvideo.com/videos/abc123',
        title: 'Test Video'
      })
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('HTTPS')
    })

    test('validateVideoLink rejects empty title', () => {
      const errors = validateVideoLink({
        url: 'https://sproutvideo.com/videos/abc123',
        title: ''
      })
      expect(errors.length).toBeGreaterThan(0)
    })

    test('validateTrelloCard accepts valid card', () => {
      const errors = validateTrelloCard({
        url: 'https://trello.com/c/abc12345/test-card',
        cardId: 'abc12345',
        title: 'Test Card'
      })
      expect(errors).toEqual([])
    })

    test('validateTrelloCard rejects mismatched card ID', () => {
      const errors = validateTrelloCard({
        url: 'https://trello.com/c/abc12345/test-card',
        cardId: 'wrongid12',
        title: 'Test Card'
      })
      expect(errors.length).toBeGreaterThan(0)
    })

    test('extractTrelloCardId extracts correct ID', () => {
      expect(extractTrelloCardId('https://trello.com/c/abc12345/test')).toBe('abc12345')
      expect(extractTrelloCardId('invalid-url')).toBeNull()
    })

    test('isValidHttpsUrl validates HTTPS URLs', () => {
      expect(isValidHttpsUrl('https://example.com')).toBe(true)
      expect(isValidHttpsUrl('http://example.com')).toBe(false)
    })

    test('isValidIso8601 validates ISO dates', () => {
      expect(isValidIso8601('2024-01-01T00:00:00Z')).toBe(true)
      expect(isValidIso8601('not-a-date')).toBe(false)
    })

    test('isWithinLength checks bounds', () => {
      expect(isWithinLength('hello', 1, 10)).toBe(true)
      expect(isWithinLength('hi', 5, 10)).toBe(false)
    })
  })

  describe('behavior: version utilities work correctly', () => {
    test('normalizeVersion removes v prefix', () => {
      expect(normalizeVersion('v1.2.3')).toBe('1.2.3')
      expect(normalizeVersion('1.2.3')).toBe('1.2.3')
    })

    test('parseVersion returns major, minor, patch', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    })

    test('compareVersions returns correct ordering', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })

    test('isUpdateAvailable detects newer versions', () => {
      expect(isUpdateAvailable('1.0.0', '1.0.1')).toBe(true)
      expect(isUpdateAvailable('1.0.1', '1.0.0')).toBe(false)
      expect(isUpdateAvailable('1.0.0', '1.0.0')).toBe(false)
    })
  })

  describe('behavior: breadcrumbs formatting works correctly', () => {
    test('formatFileSize formats bytes correctly', () => {
      const result = formatFileSize(1024)
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    test('formatFieldName formats field names', () => {
      const result = formatFieldName('projectTitle')
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    test('formatFieldValue formats values', () => {
      const result = formatFieldValue('testField', 'testValue')
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    test('categorizeField returns category and impact', () => {
      const result = categorizeField('projectTitle')
      expect(result).toBeDefined()
      expect(result).toHaveProperty('category')
      expect(result).toHaveProperty('impact')
      expect(['content', 'metadata', 'maintenance']).toContain(result.category)
      expect(['high', 'medium', 'low']).toContain(result.impact)
    })
  })
})
