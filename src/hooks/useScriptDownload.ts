/**
 * useScriptDownload Hook
 * Manages DOCX file generation and download from markdown
 *
 * Responsibilities:
 * - Markdown to HTML conversion
 * - DOCX file generation
 * - Download handling
 * - Generation error handling
 */

import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useState } from 'react'

import type { ScriptDocument } from '@/types/scriptFormatter'

import { useDocxGenerator } from './useDocxGenerator'

const log = createNamespacedLogger('ScriptDownload')

interface UseScriptDownloadOptions {
  onSuccess?: () => void
  onError?: (error: Error) => void
  filenameFormatter?: (originalFilename: string) => string
}

/**
 * Converts markdown formatting to HTML
 */
function convertMarkdownToHtml(text: string): string {
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
  return result
}

/**
 * Default filename formatter
 */
function defaultFilenameFormatter(originalFilename: string): string {
  if (originalFilename.endsWith('.docx')) {
    return originalFilename.replace('.docx', '_formatted.docx')
  }
  return `${originalFilename}_formatted.docx`
}

export function useScriptDownload(options?: UseScriptDownloadOptions) {
  const {
    onSuccess,
    onError,
    filenameFormatter = defaultFilenameFormatter
  } = options || {}

  const [localError, setLocalError] = useState<Error | null>(null)
  const { generateFile, isGenerating, error: generatorError } = useDocxGenerator()

  // Use local error if present, otherwise fall back to generator error
  const generateError = localError || generatorError

  const handleDownload = useCallback(
    async (document: ScriptDocument | null, markdownText: string) => {
      if (!document || !markdownText) {
        log.warn('handleDownload called without document or markdown text')
        return
      }

      // Clear previous errors
      setLocalError(null)

      try {
        log.debug('Converting markdown to HTML for:', document.filename)

        // Convert markdown to HTML with paragraph wrapping
        const htmlContent = markdownText
          .split('\n')
          .filter((line) => line.trim()) // Filter out empty lines
          .map((line) => `<p>${convertMarkdownToHtml(line)}</p>`)
          .join('')

        log.debug('HTML content generated, length:', htmlContent.length)

        // Generate filename
        const filename = filenameFormatter(document.filename)
        log.info('Generating DOCX file:', filename)

        // Generate and download the file
        await generateFile(htmlContent, filename)

        log.info('File downloaded successfully')

        if (onSuccess) {
          onSuccess()
        }
      } catch (error) {
        const err = error as Error
        log.error('Failed to download file:', err.message)
        setLocalError(err)

        if (onError) {
          onError(err)
        }
      }
    },
    [generateFile, filenameFormatter, onSuccess, onError]
  )

  return {
    // State
    isGenerating,
    generateError,

    // Actions
    handleDownload
  }
}
