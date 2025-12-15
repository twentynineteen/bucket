/**
 * Custom hook for script file upload and validation
 * Feature: 007-frontend-script-example
 *
 * Handles .txt file selection, reading, and validation for example uploads
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { useState } from 'react'

import type { FileValidation, UploadError } from '@/types/exampleEmbeddings'

interface UseScriptFileUploadReturn {
  isReading: boolean
  error: UploadError | null
  selectFile: () => Promise<string | null>
  readFileContent: (path: string) => Promise<string>
  validateFile: (path: string, content: string) => FileValidation
}

// const MAX_FILE_SIZE = 1024 * 1024 // 1MB (reserved for future use)
const MIN_CONTENT_LENGTH = 50
const MAX_CONTENT_LENGTH = 100_000

export function useScriptFileUpload(): UseScriptFileUploadReturn {
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<UploadError | null>(null)

  /**
   * Open file dialog to select a .txt file
   */
  const selectFile = async (): Promise<string | null> => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Text Files',
            extensions: ['txt']
          }
        ]
      })

      if (typeof selected === 'string') {
        return selected
      }

      return null
    } catch (err) {
      setError({
        type: 'network_error',
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Read file content using Tauri FS
   */
  const readFileContent = async (path: string): Promise<string> => {
    setIsReading(true)
    setError(null)

    try {
      const content = await readTextFile(path)
      setIsReading(false)
      return content
    } catch (err) {
      setIsReading(false)
      const error: UploadError = {
        type: 'network_error',
        error: err instanceof Error ? err.message : String(err)
      }
      setError(error)
      throw error
    }
  }

  /**
   * Validate file path and content
   */
  const validateFile = (path: string, content: string): FileValidation => {
    // Check file extension
    if (!path.toLowerCase().endsWith('.txt')) {
      const error: UploadError = {
        type: 'invalid_extension',
        expected: '.txt'
      }
      setError(error)
      return { valid: false, error }
    }

    // Validate content length
    const trimmedContent = content.trim()
    if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      const error: UploadError = {
        type: 'content_too_short',
        minLength: MIN_CONTENT_LENGTH
      }
      setError(error)
      return { valid: false, error }
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      const error: UploadError = {
        type: 'content_too_long',
        maxLength: MAX_CONTENT_LENGTH
      }
      setError(error)
      return { valid: false, error }
    }

    // Validate UTF-8 encoding (JavaScript strings are UTF-16, but Tauri reads as UTF-8)
    // If readTextFile succeeded, it's valid UTF-8
    // Additional check: look for replacement characters that indicate encoding issues
    if (content.includes('\uFFFD')) {
      const error: UploadError = {
        type: 'invalid_encoding',
        details: 'File contains invalid UTF-8 characters'
      }
      setError(error)
      return { valid: false, error }
    }

    setError(null)
    return { valid: true }
  }

  return {
    isReading,
    error,
    selectFile,
    readFileContent,
    validateFile
  }
}
