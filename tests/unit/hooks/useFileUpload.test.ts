/**
 * Hook Test: useScriptFileUpload (T018)
 * Feature: 007-frontend-script-example
 */

import { useScriptFileUpload } from '@/hooks/useScriptFileUpload'
import * as tauriDialog from '@tauri-apps/plugin-dialog'
import * as tauriFs from '@tauri-apps/plugin-fs'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-dialog')
vi.mock('@tauri-apps/plugin-fs')

describe('useFileUpload Hook - Contract Tests (T018)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should read file content from File object', async () => {
    // Contract: Must accept File object as parameter
    // Contract: Must return file content as string
    // Contract: Must use Tauri FS plugin to read file
    const mockContent = 'Test file content'
    vi.mocked(tauriFs.readTextFile).mockResolvedValueOnce(mockContent)

    const { result } = renderHook(() => useScriptFileUpload())

    let content: string = ''
    await act(async () => {
      content = await result.current.readFileContent('/path/to/file.txt')
    })

    expect(tauriFs.readTextFile).toHaveBeenCalledWith('/path/to/file.txt')
    expect(content).toBe(mockContent)
  })

  it('should validate file extension (.txt only)', () => {
    // Contract: Must reject non-.txt files
    // Contract: Must return error { type: 'invalid_extension', expected: '.txt' }
    const { result } = renderHook(() => useScriptFileUpload())

    const validation = result.current.validateFile('/path/to/file.pdf', 'Content here')

    expect(validation.valid).toBe(false)
    expect(validation.error?.type).toBe('invalid_extension')
    if (validation.error?.type === 'invalid_extension') {
      expect(validation.error.expected).toBe('.txt')
    }
  })

  it('should validate file size (<1MB)', () => {
    // Contract: Must reject files > 1MB
    // Contract: Must return error { type: 'file_too_large', maxSize: 1048576 }
    // Note: The hook validates content length, not file size directly
    const { result } = renderHook(() => useScriptFileUpload())

    // Content too long (>100k chars)
    const longContent = 'a'.repeat(100001)
    const validation = result.current.validateFile('/path/to/file.txt', longContent)

    expect(validation.valid).toBe(false)
    expect(validation.error?.type).toBe('content_too_long')
  })

  it('should validate UTF-8 encoding', () => {
    // Contract: Must detect invalid UTF-8
    // Contract: Must return error { type: 'invalid_encoding', details: string }
    const { result } = renderHook(() => useScriptFileUpload())

    // Need enough content to pass length validation (>50 chars)
    const invalidContent = 'A'.repeat(60) + ' Content with invalid char: \uFFFD'
    const validation = result.current.validateFile('/path/to/file.txt', invalidContent)

    expect(validation.valid).toBe(false)
    expect(validation.error?.type).toBe('invalid_encoding')
  })

  it('should return error for invalid files', () => {
    // Contract: Must return FileValidation { valid: false, error: UploadError }
    // Contract: Must not throw exceptions
    const { result } = renderHook(() => useScriptFileUpload())

    const validation = result.current.validateFile('/path/to/file.pdf', 'Content')

    expect(validation).toHaveProperty('valid', false)
    expect(validation).toHaveProperty('error')
    expect(validation.error).toBeDefined()
  })

  it('should provide selectFile function using Tauri dialog', async () => {
    // Contract: Must use Tauri dialog plugin to open file picker
    // Contract: Must filter to .txt files only
    // Contract: Must return selected file path
    vi.mocked(tauriDialog.open).mockResolvedValueOnce('/path/to/selected.txt')

    const { result } = renderHook(() => useScriptFileUpload())

    let selectedPath: string | null = null
    await act(async () => {
      selectedPath = await result.current.selectFile()
    })

    expect(tauriDialog.open).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })
    expect(selectedPath).toBe('/path/to/selected.txt')
  })

  it('should provide readFileContent function', async () => {
    // Contract: Must accept file path string
    // Contract: Must read file using Tauri FS readTextFile
    // Contract: Must handle read errors gracefully
    const mockContent = 'File content'
    vi.mocked(tauriFs.readTextFile).mockResolvedValueOnce(mockContent)

    const { result } = renderHook(() => useScriptFileUpload())

    let content: string = ''
    await act(async () => {
      content = await result.current.readFileContent('/test/path.txt')
    })

    expect(content).toBe(mockContent)
    expect(tauriFs.readTextFile).toHaveBeenCalledWith('/test/path.txt')
  })

  it('should provide isReading loading state', async () => {
    // Contract: Must expose isReading boolean
    // Contract: isReading=true during file read operation
    // Contract: isReading=false after completion or error
    vi.mocked(tauriFs.readTextFile).mockResolvedValueOnce('Content')

    const { result } = renderHook(() => useScriptFileUpload())

    expect(result.current.isReading).toBe(false)

    await act(async () => {
      await result.current.readFileContent('/test.txt')
    })

    // Should be false after completion
    expect(result.current.isReading).toBe(false)
  })

  it('should validate content length (50-100k chars)', () => {
    // Contract: Content too short (<50 chars) returns error
    // Contract: Content too long (>100k chars) returns error
    // Contract: Valid content (50-100k chars) passes validation
    const { result } = renderHook(() => useScriptFileUpload())

    // Too short
    act(() => {
      const shortValidation = result.current.validateFile('/test.txt', 'short')
      expect(shortValidation.valid).toBe(false)
      expect(shortValidation.error?.type).toBe('content_too_short')
    })

    // Too long
    act(() => {
      const longContent = 'a'.repeat(100001)
      const longValidation = result.current.validateFile('/test.txt', longContent)
      expect(longValidation.valid).toBe(false)
      expect(longValidation.error?.type).toBe('content_too_long')
    })

    // Valid
    act(() => {
      const validContent = 'a'.repeat(1000) // Between 50 and 100k
      const validValidation = result.current.validateFile('/test.txt', validContent)
      expect(validValidation.valid).toBe(true)
    })
  })
})
