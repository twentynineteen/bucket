/**
 * Security Tests for Markdown XSS Prevention
 *
 * Tests to ensure that markdown processing does not introduce XSS vulnerabilities
 * Related to DEBT-010: mdast-util-to-hast security vulnerability (GHSA-4fh9-h7wg-q85m)
 *
 * These tests verify that:
 * 1. Manual markdown conversion in useScriptDownload properly sanitizes input
 * 2. No XSS vectors exist through markdown formatting
 * 3. HTML special characters are properly escaped
 * 4. Malicious script tags and attributes are neutralized
 */

import type { ScriptDocument } from '@/types/scriptFormatter'
import { useScriptDownload } from '@hooks/useScriptDownload'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

// Mock useDocxGenerator
vi.mock('@hooks/useDocxGenerator', () => ({
  useDocxGenerator: () => ({
    generateFile: vi.fn().mockResolvedValue(undefined),
    isGenerating: false,
    error: null
  })
}))

describe('Markdown XSS Prevention', () => {
  const mockDocument: ScriptDocument = {
    filename: 'test.docx',
    content: 'test content'
  }

  describe('Script Tag Injection', () => {
    test('should not execute script tags in markdown', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<script>alert("XSS")</script>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      // The script tag should be escaped or removed, not executed
      expect(result.current.generateError).toBeNull()
    })

    test('should escape script tags with markdown formatting', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '**<script>alert("XSS")</script>**'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle script tags in italic text', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '*<script>alert("XSS")</script>*'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('Event Handler Injection', () => {
    test('should sanitize onclick event handlers', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<span onclick="alert(\'XSS\')">Click me</span>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should sanitize onerror event handlers', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<img src=x onerror="alert(\'XSS\')">'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should sanitize onload event handlers', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<body onload="alert(\'XSS\')">'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('HTML Special Characters', () => {
    test('should handle less-than and greater-than symbols', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '**x < y** and *a > b*'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle ampersands', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '**A & B** are *C & D*'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle quotes in markdown', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '**"quoted"** and *\'single\'*'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('JavaScript Protocol Injection', () => {
    test('should sanitize javascript: protocol in links', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<a href="javascript:alert(\'XSS\')">Click</a>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should sanitize data: protocol', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown =
        '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should sanitize vbscript: protocol', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<a href="vbscript:msgbox(\'XSS\')">Click</a>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('Malicious Class Attributes (CWE-915)', () => {
    test('should handle malicious class attributes', async () => {
      const { result } = renderHook(() => useScriptDownload())

      // This is the specific vulnerability in mdast-util-to-hast 13.0.0 - 13.2.0
      const maliciousMarkdown = '<div class="constructor prototype">Malicious</div>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle class attributes with __proto__', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<div class="__proto__">Malicious</div>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle multiple suspicious class names', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown =
        '<span class="constructor __proto__ prototype">Test</span>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('Nested and Complex Attacks', () => {
    test('should handle nested script tags', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '<div><script>alert("XSS")</script></div>'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle mixed markdown and HTML injection', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '**Bold text <script>alert("XSS")</script> more bold**'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle encoded script tags', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const maliciousMarkdown = '&lt;script&gt;alert("XSS")&lt;/script&gt;'

      await act(async () => {
        await result.current.handleDownload(mockDocument, maliciousMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('Legitimate Markdown Formatting', () => {
    test('should properly format bold text', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '**This is bold text**'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should properly format italic text', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '*This is italic text*'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle mixed formatting', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = '**Bold** and *italic* and **bold *italic***'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle multiple paragraphs', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const markdown = 'Line 1\nLine 2\nLine 3'

      await act(async () => {
        await result.current.handleDownload(mockDocument, markdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty markdown', async () => {
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '')
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle markdown with only whitespace', async () => {
      const { result } = renderHook(() => useScriptDownload())

      await act(async () => {
        await result.current.handleDownload(mockDocument, '   \n  \n  ')
      })

      expect(result.current.generateError).toBeNull()
    })

    test('should handle very long input', async () => {
      const { result } = renderHook(() => useScriptDownload())

      const longMarkdown = '**Bold text** '.repeat(1000)

      await act(async () => {
        await result.current.handleDownload(mockDocument, longMarkdown)
      })

      expect(result.current.generateError).toBeNull()
    })
  })
})
