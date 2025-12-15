/**
 * Tests for useScriptFileUpload Hook
 * TDD Methodology: RED → GREEN → REFACTOR
 * Phase: RED (Write failing tests)
 */

import { useScriptFileUpload } from '@/hooks/useScriptFileUpload'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock external dependencies
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn()
}))

describe('useScriptFileUpload', () => {
  const mockFilePath = '/path/to/file.txt'
  const mockFileContent =
    'This is valid script content with sufficient length to pass validation.'
  const MIN_CONTENT_LENGTH = 50
  const MAX_CONTENT_LENGTH = 100_000

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    test('T001: returns correct interface', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFileUpload())

      // Assert
      expect(result.current).toEqual({
        isReading: expect.any(Boolean),
        error: null,
        selectFile: expect.any(Function),
        readFileContent: expect.any(Function),
        validateFile: expect.any(Function)
      })
    })

    test('T002: initializes with isReading=false and error=null', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFileUpload())

      // Assert
      expect(result.current.isReading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('selectFile', () => {
    test('T003: opens file dialog with correct filters', async () => {
      // Arrange
      vi.mocked(open).mockResolvedValue(mockFilePath)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      await act(async () => {
        await result.current.selectFile()
      })

      // Assert
      expect(open).toHaveBeenCalledWith({
        multiple: false,
        filters: [
          {
            name: 'Text Files',
            extensions: ['txt']
          }
        ]
      })
    })

    test('T004: returns selected file path', async () => {
      // Arrange
      vi.mocked(open).mockResolvedValue(mockFilePath)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let selectedPath: string | null = null
      await act(async () => {
        selectedPath = await result.current.selectFile()
      })

      // Assert
      expect(selectedPath).toBe(mockFilePath)
    })

    test('T005: returns null when dialog cancelled', async () => {
      // Arrange
      vi.mocked(open).mockResolvedValue(null)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let selectedPath: string | null = 'not-null'
      await act(async () => {
        selectedPath = await result.current.selectFile()
      })

      // Assert
      expect(selectedPath).toBeNull()
    })

    test('T006: handles file dialog errors', async () => {
      // Arrange
      vi.mocked(open).mockRejectedValue(new Error('Dialog error'))
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let selectedPath: string | null = 'not-null'
      await act(async () => {
        selectedPath = await result.current.selectFile()
      })

      // Assert
      expect(selectedPath).toBeNull()
      expect(result.current.error).toEqual({
        type: 'network_error',
        error: 'Dialog error'
      })
    })

    test('T007: sets error state on failure', async () => {
      // Arrange
      const errorMessage = 'Permission denied'
      vi.mocked(open).mockRejectedValue(new Error(errorMessage))
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      await act(async () => {
        await result.current.selectFile()
      })

      // Assert
      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.type).toBe('network_error')
      expect(result.current.error?.error).toBe(errorMessage)
    })
  })

  describe('readFileContent', () => {
    test('T008: reads file content successfully', async () => {
      // Arrange
      vi.mocked(readTextFile).mockResolvedValue(mockFileContent)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let content = ''
      await act(async () => {
        content = await result.current.readFileContent(mockFilePath)
      })

      // Assert
      expect(content).toBe(mockFileContent)
      expect(readTextFile).toHaveBeenCalledWith(mockFilePath)
    })

    test('T009: sets isReading=true during read', async () => {
      // Arrange
      let resolveRead: (value: string) => void
      const readPromise = new Promise<string>(resolve => {
        resolveRead = resolve
      })
      vi.mocked(readTextFile).mockReturnValue(readPromise)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let readPromiseStarted: Promise<string>
      act(() => {
        readPromiseStarted = result.current.readFileContent(mockFilePath)
      })

      // Assert - Should be reading before promise resolves
      expect(result.current.isReading).toBe(true)

      // Cleanup
      await act(async () => {
        resolveRead!(mockFileContent)
        await readPromiseStarted!
      })
    })

    test('T010: sets isReading=false after read', async () => {
      // Arrange
      vi.mocked(readTextFile).mockResolvedValue(mockFileContent)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      await act(async () => {
        await result.current.readFileContent(mockFilePath)
      })

      // Assert
      expect(result.current.isReading).toBe(false)
    })

    test('T011: throws error on read failure', async () => {
      // Arrange
      const errorMessage = 'File not found'
      vi.mocked(readTextFile).mockRejectedValue(new Error(errorMessage))
      const { result } = renderHook(() => useScriptFileUpload())

      // Act & Assert
      await act(async () => {
        await expect(result.current.readFileContent(mockFilePath)).rejects.toThrow()
      })
    })

    test('T012: sets error state on failure', async () => {
      // Arrange
      const errorMessage = 'File not found'
      vi.mocked(readTextFile).mockRejectedValue(new Error(errorMessage))
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      await act(async () => {
        try {
          await result.current.readFileContent(mockFilePath)
        } catch {
          // Expected to throw
        }
      })

      // Assert
      expect(result.current.error).toEqual({
        type: 'network_error',
        error: errorMessage
      })
    })

    test('T013: clears previous errors on new read', async () => {
      // Arrange
      vi.mocked(readTextFile)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(mockFileContent)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act - First read fails
      await act(async () => {
        try {
          await result.current.readFileContent(mockFilePath)
        } catch {
          // Expected
        }
      })
      expect(result.current.error).not.toBeNull()

      // Act - Second read succeeds
      await act(async () => {
        await result.current.readFileContent(mockFilePath)
      })

      // Assert - Error should be cleared
      expect(result.current.error).toBeNull()
    })
  })

  describe('validateFile', () => {
    test('T014: accepts valid .txt file with valid content', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, mockFileContent)
      })

      // Assert
      expect(validation).toEqual({ valid: true })
      expect(result.current.error).toBeNull()
    })

    test('T015: rejects non-.txt file extensions', () => {
      // Arrange
      const invalidPath = '/path/to/file.docx'
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(invalidPath, mockFileContent)
      })

      // Assert
      expect(validation?.valid).toBe(false)
      expect(validation?.error).toEqual({
        type: 'invalid_extension',
        expected: '.txt'
      })
      expect(result.current.error).toEqual({
        type: 'invalid_extension',
        expected: '.txt'
      })
    })

    test('T016: rejects content below MIN_CONTENT_LENGTH', () => {
      // Arrange
      const shortContent = 'Short'
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, shortContent)
      })

      // Assert
      expect(validation?.valid).toBe(false)
      expect(validation?.error).toEqual({
        type: 'content_too_short',
        minLength: MIN_CONTENT_LENGTH
      })
    })

    test('T017: rejects content above MAX_CONTENT_LENGTH', () => {
      // Arrange
      const longContent = 'x'.repeat(MAX_CONTENT_LENGTH + 100)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, longContent)
      })

      // Assert
      expect(validation?.valid).toBe(false)
      expect(validation?.error).toEqual({
        type: 'content_too_long',
        maxLength: MAX_CONTENT_LENGTH
      })
    })

    test('T018: trims whitespace before validation', () => {
      // Arrange
      const contentWithWhitespace = `   \n\n${mockFileContent}\n\n   `
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, contentWithWhitespace)
      })

      // Assert
      expect(validation?.valid).toBe(true)
    })

    test('T019: detects invalid UTF-8 encoding (\\uFFFD)', () => {
      // Arrange
      // Create content long enough to pass length check but with invalid UTF-8
      const invalidContent =
        'Valid content with sufficient length for validation to proceed but contains \uFFFD replacement character'
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, invalidContent)
      })

      // Assert
      expect(validation?.valid).toBe(false)
      expect(validation?.error).toEqual({
        type: 'invalid_encoding',
        details: 'File contains invalid UTF-8 characters'
      })
    })

    test('T020: clears error on successful validation', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFileUpload())

      // First validation fails
      act(() => {
        result.current.validateFile('/path/file.pdf', mockFileContent)
      })
      expect(result.current.error).not.toBeNull()

      // Act - Second validation succeeds
      act(() => {
        result.current.validateFile(mockFilePath, mockFileContent)
      })

      // Assert
      expect(result.current.error).toBeNull()
    })

    test('T021: sets appropriate error types', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFileUpload())

      // Act & Assert - Invalid extension
      act(() => {
        result.current.validateFile('/file.pdf', mockFileContent)
      })
      expect(result.current.error?.type).toBe('invalid_extension')

      // Act & Assert - Content too short
      act(() => {
        result.current.validateFile(mockFilePath, 'x')
      })
      expect(result.current.error?.type).toBe('content_too_short')

      // Act & Assert - Content too long
      act(() => {
        result.current.validateFile(mockFilePath, 'x'.repeat(MAX_CONTENT_LENGTH + 1))
      })
      expect(result.current.error?.type).toBe('content_too_long')

      // Act & Assert - Invalid encoding (must be long enough first)
      act(() => {
        result.current.validateFile(
          mockFilePath,
          'Long enough content to pass length validation but has \uFFFD replacement char'
        )
      })
      expect(result.current.error?.type).toBe('invalid_encoding')
    })

    test('T022: case-insensitive extension check', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFileUpload())

      // Act & Assert - .TXT
      let validation1
      act(() => {
        validation1 = result.current.validateFile('/path/file.TXT', mockFileContent)
      })
      expect(validation1?.valid).toBe(true)

      // Act & Assert - .Txt
      let validation2
      act(() => {
        validation2 = result.current.validateFile('/path/file.Txt', mockFileContent)
      })
      expect(validation2?.valid).toBe(true)

      // Act & Assert - .tXt
      let validation3
      act(() => {
        validation3 = result.current.validateFile('/path/file.tXt', mockFileContent)
      })
      expect(validation3?.valid).toBe(true)
    })

    test('T023: handles edge case exactly at MIN_CONTENT_LENGTH', () => {
      // Arrange
      // MIN_CONTENT_LENGTH is checked AFTER trimming, and validation is trimmedContent.length < MIN
      // So exactly MIN_CONTENT_LENGTH should pass
      const exactLengthContent = 'x'.repeat(MIN_CONTENT_LENGTH)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, exactLengthContent)
      })

      // Assert
      // Content at exactly MIN_CONTENT_LENGTH should pass (not less than)
      expect(validation?.valid).toBe(true)
    })

    test('T026: rejects content one character below MIN_CONTENT_LENGTH', () => {
      // Arrange
      const justBelowMinContent = 'x'.repeat(MIN_CONTENT_LENGTH - 1)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act
      let validation
      act(() => {
        validation = result.current.validateFile(mockFilePath, justBelowMinContent)
      })

      // Assert
      expect(validation?.valid).toBe(false)
      expect(validation?.error?.type).toBe('content_too_short')
    })
  })

  describe('Integration scenarios', () => {
    test('T024: complete workflow - select, read, validate', async () => {
      // Arrange
      vi.mocked(open).mockResolvedValue(mockFilePath)
      vi.mocked(readTextFile).mockResolvedValue(mockFileContent)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act - Select file
      let selectedPath: string | null = null
      await act(async () => {
        selectedPath = await result.current.selectFile()
      })
      expect(selectedPath).toBe(mockFilePath)

      // Act - Read file
      let content = ''
      await act(async () => {
        content = await result.current.readFileContent(selectedPath!)
      })
      expect(content).toBe(mockFileContent)

      // Act - Validate file
      let validation
      act(() => {
        validation = result.current.validateFile(selectedPath!, content)
      })

      // Assert
      expect(validation?.valid).toBe(true)
      expect(result.current.error).toBeNull()
    })

    test('T025: error recovery - failed read then successful read', async () => {
      // Arrange
      vi.mocked(readTextFile)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockFileContent)
      const { result } = renderHook(() => useScriptFileUpload())

      // Act - First read fails
      await act(async () => {
        try {
          await result.current.readFileContent(mockFilePath)
        } catch {
          // Expected
        }
      })
      expect(result.current.error).not.toBeNull()
      expect(result.current.isReading).toBe(false)

      // Act - Second read succeeds
      await act(async () => {
        await result.current.readFileContent(mockFilePath)
      })

      // Assert
      expect(result.current.error).toBeNull()
      expect(result.current.isReading).toBe(false)
    })
  })
})
