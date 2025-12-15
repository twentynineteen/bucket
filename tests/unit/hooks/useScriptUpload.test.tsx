/**
 * Unit Tests for useScriptUpload Hook
 * DEBT-001: Refactoring useScriptFormatterState - Upload Responsibility
 *
 * This hook manages:
 * - File selection and parsing
 * - Document state
 * - Parse error handling
 * - Transition to next workflow step
 */

import type { ScriptDocument } from '@/types/scriptFormatter'
import { useDocxParser } from '@hooks/useDocxParser'
import { useScriptUpload } from '@hooks/useScriptUpload'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('@hooks/useDocxParser', () => ({
  useDocxParser: vi.fn()
}))

vi.mock('@utils/logger', () => ({
  createNamespacedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useScriptUpload', () => {
  const mockParseFile = vi.fn()
  const mockParsedDocument: ScriptDocument = {
    filename: 'test-script.docx',
    textContent: 'This is a test script content',
    metadata: {
      title: 'Test Script',
      createdAt: new Date('2024-01-01')
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useDocxParser as any).mockReturnValue({
      parseFile: mockParseFile,
      isLoading: false,
      error: null
    })
  })

  describe('Initial State', () => {
    it('should initialize with no document', () => {
      const { result } = renderHook(() => useScriptUpload())

      expect(result.current.document).toBeNull()
      expect(result.current.isParsing).toBe(false)
      expect(result.current.parseError).toBeNull()
    })

    it('should expose handleFileSelect function', () => {
      const { result } = renderHook(() => useScriptUpload())

      expect(result.current.handleFileSelect).toBeDefined()
      expect(typeof result.current.handleFileSelect).toBe('function')
    })
  })

  describe('File Selection - Happy Path', () => {
    it('should parse file and set document on successful selection', async () => {
      mockParseFile.mockResolvedValue(mockParsedDocument)
      const { result } = renderHook(() => useScriptUpload())

      const testFile = new File(['test content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(result.current.document).toEqual(mockParsedDocument)
      })
    })

    it('should call parseFile with the selected file', async () => {
      mockParseFile.mockResolvedValue(mockParsedDocument)
      const { result } = renderHook(() => useScriptUpload())

      const testFile = new File(['test content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      expect(mockParseFile).toHaveBeenCalledWith(testFile)
      expect(mockParseFile).toHaveBeenCalledTimes(1)
    })

    it('should invoke onSuccess callback after successful parse', async () => {
      mockParseFile.mockResolvedValue(mockParsedDocument)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useScriptUpload({ onSuccess }))

      const testFile = new File(['test content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockParsedDocument)
      })
    })
  })

  describe('File Selection - Error Handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const parseError = new Error('Failed to parse DOCX file')
      mockParseFile.mockRejectedValue(parseError)

      const { result } = renderHook(() => useScriptUpload())

      const testFile = new File(['invalid content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(result.current.document).toBeNull()
        expect(result.current.parseError).toBeTruthy()
      })
    })

    it('should call onError callback when parsing fails', async () => {
      const parseError = new Error('Failed to parse DOCX file')
      mockParseFile.mockRejectedValue(parseError)
      const onError = vi.fn()

      const { result } = renderHook(() => useScriptUpload({ onError }))

      const testFile = new File(['invalid content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error))
      })
    })

    it('should not call onSuccess when parsing fails', async () => {
      const parseError = new Error('Failed to parse DOCX file')
      mockParseFile.mockRejectedValue(parseError)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useScriptUpload({ onSuccess }))

      const testFile = new File(['invalid content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled()
      })
    })
  })

  describe('Loading States', () => {
    it('should reflect loading state from useDocxParser', () => {
      ;(useDocxParser as any).mockReturnValue({
        parseFile: mockParseFile,
        isLoading: true,
        error: null
      })

      const { result } = renderHook(() => useScriptUpload())

      expect(result.current.isParsing).toBe(true)
    })

    it('should reflect error state from useDocxParser', () => {
      const error = new Error('Parser error')
      ;(useDocxParser as any).mockReturnValue({
        parseFile: mockParseFile,
        isLoading: false,
        error
      })

      const { result } = renderHook(() => useScriptUpload())

      expect(result.current.parseError).toBe(error)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null file gracefully', async () => {
      const { result } = renderHook(() => useScriptUpload())

      await act(async () => {
        await result.current.handleFileSelect(null as any)
      })

      expect(mockParseFile).not.toHaveBeenCalled()
    })

    it('should handle multiple consecutive file selections', async () => {
      mockParseFile.mockResolvedValueOnce(mockParsedDocument).mockResolvedValueOnce({
        ...mockParsedDocument,
        filename: 'second-script.docx'
      })

      const { result } = renderHook(() => useScriptUpload())

      const file1 = new File(['content 1'], 'test1.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
      const file2 = new File(['content 2'], 'test2.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(file1)
      })

      await waitFor(() => {
        expect(result.current.document?.filename).toBe('test-script.docx')
      })

      await act(async () => {
        await result.current.handleFileSelect(file2)
      })

      await waitFor(() => {
        expect(result.current.document?.filename).toBe('second-script.docx')
      })

      expect(mockParseFile).toHaveBeenCalledTimes(2)
    })

    it('should handle rapid fire selections (debounce behavior)', async () => {
      mockParseFile.mockResolvedValue(mockParsedDocument)
      const { result } = renderHook(() => useScriptUpload())

      const file = new File(['content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      // Rapidly select same file multiple times
      await act(async () => {
        await Promise.all([
          result.current.handleFileSelect(file),
          result.current.handleFileSelect(file),
          result.current.handleFileSelect(file)
        ])
      })

      // Should process all requests (no automatic debouncing)
      expect(mockParseFile).toHaveBeenCalledTimes(3)
    })
  })

  describe('Reset Functionality', () => {
    it('should provide reset function to clear document', async () => {
      mockParseFile.mockResolvedValue(mockParsedDocument)
      const { result } = renderHook(() => useScriptUpload())

      const testFile = new File(['test content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(result.current.document).not.toBeNull()
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.document).toBeNull()
    })

    it('should clear parse errors on reset', async () => {
      const parseError = new Error('Failed to parse')
      mockParseFile.mockRejectedValue(parseError)
      const { result } = renderHook(() => useScriptUpload())

      const testFile = new File(['invalid'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      await act(async () => {
        await result.current.handleFileSelect(testFile)
      })

      await waitFor(() => {
        expect(result.current.parseError).not.toBeNull()
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.parseError).toBeNull()
    })
  })
})
