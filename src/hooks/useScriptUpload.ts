/**
 * useScriptUpload Hook
 * Manages file selection and parsing for script formatter workflow
 *
 * Responsibilities:
 * - File selection and parsing
 * - Document state management
 * - Parse error handling
 * - Transition callbacks
 */

import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useState } from 'react'

import type { ScriptDocument } from '@/types/scriptFormatter'

import { useDocxParser } from './useDocxParser'

const log = createNamespacedLogger('ScriptUpload')

interface UseScriptUploadOptions {
  onSuccess?: (document: ScriptDocument) => void
  onError?: (error: Error) => void
}

export function useScriptUpload(options?: UseScriptUploadOptions) {
  const { onSuccess, onError } = options || {}

  const [document, setDocument] = useState<ScriptDocument | null>(null)
  const [localError, setLocalError] = useState<Error | null>(null)
  const { parseFile, isLoading: isParsing, error: parserError } = useDocxParser()

  // Use local error if present, otherwise fall back to parser error
  const parseError = localError || parserError

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) {
        log.warn('handleFileSelect called with null/undefined file')
        return
      }

      // Clear previous errors
      setLocalError(null)

      try {
        log.debug('Parsing file:', file.name)
        const parsed = await parseFile(file)

        setDocument(parsed)
        log.info('File parsed successfully:', parsed.filename)

        if (onSuccess) {
          onSuccess(parsed)
        }
      } catch (error) {
        const err = error as Error
        log.error('Failed to parse file:', err.message)
        setLocalError(err)

        if (onError) {
          onError(err)
        }
      }
    },
    [parseFile, onSuccess, onError]
  )

  const reset = useCallback(() => {
    log.debug('Resetting upload state')
    setDocument(null)
    setLocalError(null)
  }, [])

  return {
    // State
    document,
    isParsing,
    parseError,

    // Actions
    handleFileSelect,
    reset
  }
}
