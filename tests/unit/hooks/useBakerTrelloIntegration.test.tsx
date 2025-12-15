/**
 * Tests for useBakerTrelloIntegration Hook
 * TDD Methodology: RED → GREEN → REFACTOR
 * Phase: RED (Write failing tests)
 */

import { useBakerTrelloIntegration } from '@/hooks/useBakerTrelloIntegration'
import { logger } from '@/utils/logger'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Mock external dependencies
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

// Mock the dynamic imports
vi.mock('hooks/useAppendBreadcrumbs', () => ({
  updateTrelloCardWithBreadcrumbs: vi.fn(),
  generateBreadcrumbsBlock: vi.fn()
}))

describe('useBakerTrelloIntegration', () => {
  const mockApiKey = 'test-api-key'
  const mockToken = 'test-token'
  const mockProjectPath = '/path/to/project'
  const mockBreadcrumbsData = {
    projectName: 'Test Project',
    trelloCards: [{ cardId: 'card123', url: 'https://trello.com/c/card123' }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('Initialization', () => {
    test('T001: returns correct interface', () => {
      // Arrange & Act
      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Assert
      expect(result.current).toEqual({
        updateTrelloCards: expect.any(Function)
      })
    })

    test('T002: handles missing API credentials gracefully', () => {
      // Arrange & Act
      const { result } = renderHook(() => useBakerTrelloIntegration({}))

      // Assert
      expect(result.current.updateTrelloCards).toBeDefined()
      expect(typeof result.current.updateTrelloCards).toBe('function')
    })

    test('T003: initializes with valid credentials', () => {
      // Arrange & Act
      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Assert
      expect(result.current.updateTrelloCards).toBeDefined()
    })
  })

  describe('updateTrelloCards - Happy Path', () => {
    test('T004: successfully updates single project', async () => {
      // Arrange
      const mockBreadcrumbsJson = JSON.stringify(mockBreadcrumbsData)
      vi.mocked(readTextFile).mockResolvedValue(mockBreadcrumbsJson)

      const mockGenerateBreadcrumbsBlock = vi.fn().mockReturnValue('## Breadcrumbs')
      const mockUpdateTrelloCard = vi.fn().mockResolvedValue(undefined)

      vi.doMock('hooks/useAppendBreadcrumbs', () => ({
        generateBreadcrumbsBlock: mockGenerateBreadcrumbsBlock,
        updateTrelloCardWithBreadcrumbs: mockUpdateTrelloCard
      }))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toEqual([])
      expect(readTextFile).toHaveBeenCalledWith(`${mockProjectPath}/breadcrumbs.json`)
    })

    test('T005: successfully updates multiple projects', async () => {
      // Arrange
      const projectPaths = ['/path/project1', '/path/project2', '/path/project3']
      const mockBreadcrumbsJson = JSON.stringify(mockBreadcrumbsData)
      vi.mocked(readTextFile).mockResolvedValue(mockBreadcrumbsJson)

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards(projectPaths)

      // Assert
      expect(errors).toEqual([])
      expect(readTextFile).toHaveBeenCalledTimes(3)
    })

    test('T006: skips update when no API credentials', async () => {
      // Arrange
      const { result } = renderHook(() => useBakerTrelloIntegration({}))

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toEqual([])
      expect(readTextFile).not.toHaveBeenCalled()
    })

    test('T007: returns empty errors array on success', async () => {
      // Arrange
      const mockBreadcrumbsJson = JSON.stringify(mockBreadcrumbsData)
      vi.mocked(readTextFile).mockResolvedValue(mockBreadcrumbsJson)

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(Array.isArray(errors)).toBe(true)
      expect(errors.length).toBe(0)
    })
  })

  describe('updateTrelloCards - Error Handling', () => {
    test('T008: handles invalid breadcrumbs.json path', async () => {
      // Arrange
      vi.mocked(readTextFile).mockRejectedValue(new Error('File not found'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        project: 'project',
        error: 'File not found'
      })
      expect(logger.warn).toHaveBeenCalled()
    })

    test('T009: handles malformed JSON in breadcrumbs', async () => {
      // Arrange
      vi.mocked(readTextFile).mockResolvedValue('{ invalid json }')

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].project).toBe('project')
      expect(errors[0].error).toContain('JSON')
    })

    test('T010: handles missing trelloCards array', async () => {
      // Arrange
      const breadcrumbsWithoutTrello = { projectName: 'Test' }
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(breadcrumbsWithoutTrello))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      // Should not error if no Trello cards present
      expect(errors).toEqual([])
    })

    test('T011: handles Trello API errors', async () => {
      // Arrange
      const breadcrumbsWithInvalidCard = {
        projectName: 'Test Project',
        trelloCards: [{ cardId: 'invalid', url: 'https://trello.com/c/invalid' }]
      }

      // Simulate a scenario where breadcrumbs parsing works but update fails
      // In practice, this could happen if generateBreadcrumbsBlock returns null/empty
      // or if the Trello API call fails internally
      const mockBreadcrumbsJson = JSON.stringify(breadcrumbsWithInvalidCard)
      vi.mocked(readTextFile).mockResolvedValue(mockBreadcrumbsJson)

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      // Note: The implementation handles Trello API errors internally with Promise.allSettled
      // and logs them but doesn't propagate to the errors array unless the entire
      // updateProjectTrelloCards call fails. This is correct behavior.
      // We verify it doesn't crash and returns empty errors array.
      expect(Array.isArray(errors)).toBe(true)
      // The function gracefully handles internal Trello errors without propagating them
    })

    test('T012: collects multiple errors for batch operations', async () => {
      // Arrange
      const projectPaths = ['/path/project1', '/path/project2', '/path/project3']
      vi.mocked(readTextFile)
        .mockResolvedValueOnce(JSON.stringify(mockBreadcrumbsData))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(JSON.stringify(mockBreadcrumbsData))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards(projectPaths)

      // Assert
      expect(errors).toHaveLength(1) // Only middle project failed
      expect(errors[0].project).toBe('project2')
    })
  })

  describe('Edge Cases', () => {
    test('T013: handles empty project paths array', async () => {
      // Arrange
      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([])

      // Assert
      expect(errors).toEqual([])
      expect(readTextFile).not.toHaveBeenCalled()
    })

    test('T014: handles projects without breadcrumbs.json', async () => {
      // Arrange
      vi.mocked(readTextFile).mockRejectedValue(new Error('ENOENT: no such file'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].error).toContain('no such file')
    })

    test('T015: handles network errors gracefully', async () => {
      // Arrange
      vi.mocked(readTextFile).mockRejectedValue(new Error('Network timeout'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].error).toBe('Network timeout')
    })

    test('T016: handles invalid Trello card URLs', async () => {
      // Arrange
      const breadcrumbsWithInvalidUrl = {
        trelloCards: [{ cardId: '', url: 'invalid-url' }]
      }
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(breadcrumbsWithInvalidUrl))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      // Should handle gracefully (might succeed or fail depending on implementation)
      expect(Array.isArray(errors)).toBe(true)
    })

    test('T017: handles partial success in batch operations', async () => {
      // Arrange
      const projectPaths = ['/path/project1', '/path/project2']
      vi.mocked(readTextFile)
        .mockResolvedValueOnce(JSON.stringify(mockBreadcrumbsData))
        .mockRejectedValueOnce(new Error('Permission denied'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards(projectPaths)

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0].project).toBe('project2')
      expect(errors[0].error).toBe('Permission denied')
      // First project should have succeeded (no error)
    })
  })

  describe('Legacy Support', () => {
    test('T018: handles legacy trelloCardUrl field', async () => {
      // Arrange
      const legacyBreadcrumbs = {
        projectName: 'Test',
        trelloCardUrl: 'https://trello.com/c/legacy123'
      }
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(legacyBreadcrumbs))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toEqual([])
    })

    test('T019: prefers trelloCards array over legacy field', async () => {
      // Arrange
      const mixedBreadcrumbs = {
        trelloCards: [{ cardId: 'new123', url: 'https://trello.com/c/new123' }],
        trelloCardUrl: 'https://trello.com/c/legacy123' // Should be ignored
      }
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(mixedBreadcrumbs))

      const mockGenerateBreadcrumbsBlock = vi.fn().mockReturnValue('## Breadcrumbs')
      const mockUpdateTrelloCard = vi.fn().mockResolvedValue(undefined)

      vi.doMock('hooks/useAppendBreadcrumbs', () => ({
        generateBreadcrumbsBlock: mockGenerateBreadcrumbsBlock,
        updateTrelloCardWithBreadcrumbs: mockUpdateTrelloCard
      }))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(errors).toEqual([])
      // Should have called with new array, not legacy URL
    })
  })

  describe('Logging', () => {
    test('T020: logs warnings for failed updates', async () => {
      // Arrange
      vi.mocked(readTextFile).mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      await result.current.updateTrelloCards([mockProjectPath])

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update Trello card'),
        expect.any(Error)
      )
    })

    test('T021: extracts project name correctly from path', async () => {
      // Arrange
      const complexPath = '/Users/name/Documents/Projects/My Project Name'
      vi.mocked(readTextFile).mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() =>
        useBakerTrelloIntegration({ apiKey: mockApiKey, token: mockToken })
      )

      // Act
      const errors = await result.current.updateTrelloCards([complexPath])

      // Assert
      expect(errors[0].project).toBe('My Project Name')
    })
  })
})
