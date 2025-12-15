/**
 * Unit Tests for useScriptDownload Hook
 * DEBT-001: Refactoring useScriptFormatterState - Download Responsibility
 *
 * This hook manages:
 * - DOCX file generation from markdown
 * - Markdown to HTML conversion
 * - File download handling
 * - Download state and errors
 */

import type { ScriptDocument } from '@/types/scriptFormatter'
import { useDocxGenerator } from '@hooks/useDocxGenerator'
import { useScriptDownload } from '@hooks/useScriptDownload'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('@hooks/useDocxGenerator', () => ({
  useDocxGenerator: vi.fn()
}))

vi.mock('@utils/logger', () => ({
  createNamespacedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useScriptDownload', () => {
  const mockGenerateFile = vi.fn()

  const mockDocument: ScriptDocument = {
    filename: 'test-script.docx',
    textContent: 'Original text content',
    metadata: {
      title: 'Test Script',
      createdAt: new Date('2024-01-01')
    }
  }

  const mockMarkdownText = `**Bold text**
_Italic text_
Normal text paragraph`

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useDocxGenerator as any).mockReturnValue({
      generateFile: mockGenerateFile,
      isGenerating: false,
      error: null
    })
  })

  describe('Initial State', () => {
    it('should initialize with not generating state', () => {
      const { result } = renderHook(() => useScriptDownload())

      expect(result.current.isGenerating).toBe(false)
      expect(result.current.generateError).toBeNull()
    })

    it('should expose handleDownload function', () => {
      const { result } = renderHook(() => useScriptDownload())

      expect(result.current.handleDownload).toBeDefined()
      expect(typeof result.current.handleDownload).toBe('function')
    })
  })

  describe('Markdown to HTML Conversion', () => {
    it('should convert bold markdown (**text**) to HTML', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '**Bold text**')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<strong>Bold text</strong>')
    })

    it('should convert italic markdown (_text_) to HTML', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '_Italic text_')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<em>Italic text</em>')
    })

    it('should wrap each line in paragraph tags', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, 'Line 1\nLine 2\nLine 3')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<p>Line 1</p>')
      expect(htmlArg).toContain('<p>Line 2</p>')
      expect(htmlArg).toContain('<p>Line 3</p>')
    })

    it('should filter out empty lines', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(
          mockDocument,
          'Line 1\n\n\nLine 2\n  \nLine 3'
        )
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      const paragraphCount = (htmlArg.match(/<p>/g) || []).length
      expect(paragraphCount).toBe(3) // Only non-empty lines
    })

    it('should handle mixed markdown formatting', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(
          mockDocument,
          'This is **bold** and _italic_ text'
        )
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<strong>bold</strong>')
      expect(htmlArg).toContain('<em>italic</em>')
    })

    it('should handle alternate markdown syntax (__text__ for bold)', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '__Bold with underscores__')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<strong>Bold with underscores</strong>')
    })
  })

  describe('File Generation - Happy Path', () => {
    it('should generate file with correct filename', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'test-script_formatted.docx'
      )
    })

    it('should replace .docx extension correctly', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const doc = {
        ...mockDocument,
        filename: 'my-script.docx'
      }

      await act(async () => {
        await result.current.handleDownload(doc, mockMarkdownText)
      })

      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'my-script_formatted.docx'
      )
    })

    it('should handle filename without .docx extension', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const doc = {
        ...mockDocument,
        filename: 'script'
      }

      await act(async () => {
        await result.current.handleDownload(doc, mockMarkdownText)
      })

      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'script_formatted.docx'
      )
    })

    it('should call onSuccess callback after successful download', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useScriptDownload({ onSuccess }))

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
    })

    it('should pass HTML content to generateFile', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<p>')
      expect(htmlArg).toContain('</p>')
    })
  })

  describe('File Generation - Error Handling', () => {
    it('should not generate without document', async () => {
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(null as any, mockMarkdownText)
      })

      expect(mockGenerateFile).not.toHaveBeenCalled()
    })

    it('should not generate without markdown text', async () => {
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '')
      })

      expect(mockGenerateFile).not.toHaveBeenCalled()
    })

    it('should handle generation errors gracefully', async () => {
      const generationError = new Error('Failed to generate DOCX')
      mockGenerateFile.mockRejectedValue(generationError)

      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      await waitFor(() => {
        expect(result.current.generateError).toBeTruthy()
      })
    })

    it('should call onError callback when generation fails', async () => {
      const generationError = new Error('Failed to generate DOCX')
      mockGenerateFile.mockRejectedValue(generationError)
      const onError = vi.fn()

      const { result } = renderHook(() => useScriptDownload({ onError }))

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error))
      })
    })

    it('should not call onSuccess when generation fails', async () => {
      const generationError = new Error('Failed to generate DOCX')
      mockGenerateFile.mockRejectedValue(generationError)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useScriptDownload({ onSuccess }))

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled()
      })
    })
  })

  describe('Loading States', () => {
    it('should reflect generating state from useDocxGenerator', () => {
      ;(useDocxGenerator as any).mockReturnValue({
        generateFile: mockGenerateFile,
        isGenerating: true,
        error: null
      })

      const { result } = renderHook(() => useScriptDownload())

      expect(result.current.isGenerating).toBe(true)
    })

    it('should reflect error state from useDocxGenerator', () => {
      const error = new Error('Generator error')
      ;(useDocxGenerator as any).mockReturnValue({
        generateFile: mockGenerateFile,
        isGenerating: false,
        error
      })

      const { result } = renderHook(() => useScriptDownload())

      expect(result.current.generateError).toBe(error)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long markdown text', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const longText = Array.from({ length: 10000 }, (_, i) => `Line ${i}`).join('\n')

      await act(async () => {
        await result.current.handleDownload(mockDocument, longText)
      })

      expect(mockGenerateFile).toHaveBeenCalled()
    })

    it('should handle special characters in text', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const specialText = '<>&"\'áéíóú\n中文\n🎉 emoji'

      await act(async () => {
        await result.current.handleDownload(mockDocument, specialText)
      })

      expect(mockGenerateFile).toHaveBeenCalled()
      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<p>')
    })

    it('should handle markdown with nested formatting', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const nestedText = '**Bold with _nested italic_ inside**'

      await act(async () => {
        await result.current.handleDownload(mockDocument, nestedText)
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<strong>')
      expect(htmlArg).toContain('<em>')
    })

    it('should handle consecutive downloads', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, 'First download')
      })

      await act(async () => {
        await result.current.handleDownload(mockDocument, 'Second download')
      })

      expect(mockGenerateFile).toHaveBeenCalledTimes(2)
    })

    it('should handle filenames with multiple dots', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      const doc = {
        ...mockDocument,
        filename: 'my.script.v2.docx'
      }

      await act(async () => {
        await result.current.handleDownload(doc, mockMarkdownText)
      })

      // Should only replace the last .docx
      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'my.script.v2_formatted.docx'
      )
    })
  })

  describe('Custom Filename', () => {
    it('should accept custom filename pattern', async () => {
      mockGenerateFile.mockResolvedValue(undefined)

      const { result } = renderHook(() =>
        useScriptDownload({
          filenameFormatter: original => original.replace('.docx', '_FINAL.docx')
        })
      )

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'test-script_FINAL.docx'
      )
    })

    it('should use default formatter if custom formatter not provided', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, mockMarkdownText)
      })

      expect(mockGenerateFile).toHaveBeenCalledWith(
        expect.any(String),
        'test-script_formatted.docx'
      )
    })
  })

  describe('HTML Sanitization', () => {
    it('should preserve markdown-generated HTML', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '**Bold** and _italic_')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(htmlArg).toContain('<strong>')
      expect(htmlArg).toContain('<em>')
    })

    it('should handle markdown with HTML entities', async () => {
      mockGenerateFile.mockResolvedValue(undefined)
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, 'Text with & < > symbols')
      })

      const htmlArg = mockGenerateFile.mock.calls[0][0]
      expect(mockGenerateFile).toHaveBeenCalled()
    })
  })
})
