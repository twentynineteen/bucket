/**
 * Tests for breadcrumbs debug utilities
 *
 * Purpose: Verify that debug utilities use logger instead of console
 * for development-only debugging output.
 */

import type { BreadcrumbsFile } from '@/types/baker'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Create mock functions that will be used
const mockLog = vi.fn()
const mockGroup = vi.fn()
const mockGroupEnd = vi.fn()
const mockCreateNamespacedLogger = vi.fn(() => ({
  log: mockLog,
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  group: mockGroup,
  groupEnd: mockGroupEnd,
  table: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn()
}))

// Mock the logger BEFORE the module is imported
vi.mock('@/utils/logger', () => ({
  createNamespacedLogger: mockCreateNamespacedLogger
}))

// Mock the comparison functions
vi.mock('@/utils/breadcrumbs/comparison', () => ({
  compareBreadcrumbs: vi.fn(() => ({
    hasChanges: true,
    changes: [
      {
        field: 'projectTitle',
        type: 'modified',
        oldValue: 'Old Project',
        newValue: 'New Project'
      }
    ],
    summary: {
      added: 0,
      modified: 1,
      removed: 0,
      unchanged: 0
    }
  })),
  compareBreadcrumbsMeaningful: vi.fn(() => ({
    hasChanges: true,
    changes: [
      {
        field: 'projectTitle',
        type: 'modified',
        oldValue: 'Old Project',
        newValue: 'New Project'
      }
    ],
    summary: {
      added: 0,
      modified: 1,
      removed: 0,
      unchanged: 0
    }
  }))
}))

// Import after mocks are set up
const { debugComparison } = await import('@/utils/breadcrumbs/debug')

describe('breadcrumbs/debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Don't reset modules since we want to keep our mocks
  })

  describe('debugComparison', () => {
    const currentBreadcrumbs: BreadcrumbsFile = {
      projectTitle: 'Old Project',
      numberOfCameras: 2,
      files: [],
      parentFolder: '/path/to',
      createdBy: 'test-user',
      creationDateTime: '2024-01-01T00:00:00Z',
      lastModified: '2024-01-01T00:00:00Z'
    }

    const updatedBreadcrumbs: BreadcrumbsFile = {
      projectTitle: 'New Project',
      numberOfCameras: 2,
      files: [],
      parentFolder: '/path/to',
      createdBy: 'test-user',
      creationDateTime: '2024-01-01T00:00:00Z',
      lastModified: '2024-01-02T00:00:00Z'
    }

    test('should use logger methods instead of console', () => {
      // Verify the logger functions are called during execution
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      // All the important logging happens through our mocked logger
      expect(mockLog).toHaveBeenCalled()
      expect(mockGroup).toHaveBeenCalled()
      expect(mockGroupEnd).toHaveBeenCalled()
    })

    test('should use logger.group instead of console.group', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      expect(mockGroup).toHaveBeenCalledWith('Breadcrumbs Comparison Debug')
    })

    test('should use logger.log for breadcrumbs output', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      expect(mockLog).toHaveBeenCalledWith('Current:', currentBreadcrumbs)
      expect(mockLog).toHaveBeenCalledWith('Updated:', updatedBreadcrumbs)
    })

    test('should use logger.log for diff output', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      expect(mockLog).toHaveBeenCalledWith('Full Diff:', expect.any(Object))
      expect(mockLog).toHaveBeenCalledWith('Meaningful Diff:', expect.any(Object))
    })

    test('should use logger.log for change analysis header', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      expect(mockLog).toHaveBeenCalledWith('Change Analysis:')
    })

    test('should use logger.log for individual change details', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      // Should log the change field and type
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('projectTitle: modified MEANINGFUL')
      )

      // Should log old and new values
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Old:'))
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('New:'))
    })

    test('should use logger.groupEnd instead of console.groupEnd', () => {
      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      expect(mockGroupEnd).toHaveBeenCalled()
    })

    test('should handle null current breadcrumbs', () => {
      expect(() => {
        debugComparison(null, updatedBreadcrumbs)
      }).not.toThrow()

      expect(mockLog).toHaveBeenCalledWith('Current:', null)
      expect(mockLog).toHaveBeenCalledWith('Updated:', updatedBreadcrumbs)
    })

    test('should log all console calls through logger (no direct console usage)', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const consoleGroupSpy = vi.spyOn(console, 'group')
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd')

      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      // Should NOT use console directly
      expect(consoleSpy).not.toHaveBeenCalled()
      expect(consoleGroupSpy).not.toHaveBeenCalled()
      expect(consoleGroupEndSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      consoleGroupSpy.mockRestore()
      consoleGroupEndSpy.mockRestore()
    })

    test('should handle changes with identical old and new values', async () => {
      // Mock comparison with no value change
      const { compareBreadcrumbs } = await import('@/utils/breadcrumbs/comparison')
      vi.mocked(compareBreadcrumbs).mockReturnValueOnce({
        hasChanges: true,
        changes: [
          {
            field: 'lastModified',
            type: 'modified',
            oldValue: '2024-01-01T00:00:00Z',
            newValue: '2024-01-01T00:00:00Z' // Same value
          }
        ],
        summary: {
          added: 0,
          modified: 1,
          removed: 0,
          unchanged: 0
        }
      })

      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      // Should log the change but not the old/new values (since they're identical)
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('lastModified: modified')
      )
    })

    test('should handle multiple changes', async () => {
      // Mock comparison with multiple changes
      const { compareBreadcrumbs, compareBreadcrumbsMeaningful } = await import(
        '@/utils/breadcrumbs/comparison'
      )
      vi.mocked(compareBreadcrumbs).mockReturnValueOnce({
        hasChanges: true,
        changes: [
          {
            field: 'projectTitle',
            type: 'modified',
            oldValue: 'Old',
            newValue: 'New'
          },
          {
            field: 'lastModified',
            type: 'modified',
            oldValue: '2024-01-01',
            newValue: '2024-01-02'
          }
        ],
        summary: {
          added: 0,
          modified: 2,
          removed: 0,
          unchanged: 0
        }
      })
      vi.mocked(compareBreadcrumbsMeaningful).mockReturnValueOnce({
        hasChanges: true,
        changes: [
          {
            field: 'projectTitle',
            type: 'modified',
            oldValue: 'Old',
            newValue: 'New'
          }
        ],
        summary: {
          added: 0,
          modified: 1,
          removed: 0,
          unchanged: 0
        }
      })

      debugComparison(currentBreadcrumbs, updatedBreadcrumbs)

      // Should log both changes
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('projectTitle: modified MEANINGFUL')
      )
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('lastModified: modified MAINTENANCE')
      )
    })
  })
})
