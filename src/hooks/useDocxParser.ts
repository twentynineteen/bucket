/**
 * useDocxParser Hook
 * Feature: 006-i-wish-to (T038)
 * Purpose: Parse .docx files using mammoth.js with validation
 */

import mammoth from 'mammoth'
import { useState } from 'react'

import type { FormattingMetadata, ScriptDocument } from '@/types/scriptFormatter'
import { logger } from '@/utils/logger'

interface UseDocxParserResult {
  parseFile: (file: File) => Promise<ScriptDocument>
  isLoading: boolean
  error: Error | null
}

export function useDocxParser(): UseDocxParserResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const parseFile = async (file: File): Promise<ScriptDocument> => {
    setIsLoading(true)
    setError(null)

    try {
      // Step 1: Client-side validation
      // Validate file extension
      if (!file.name.toLowerCase().endsWith('.docx')) {
        throw new Error('File must be a .docx document')
      }

      // Validate file size (1GB limit)
      if (file.size > 1024 * 1024 * 1024) {
        throw new Error('File size exceeds 1GB limit')
      }

      // Step 2: Parse .docx file with mammoth.js
      const arrayBuffer = await file.arrayBuffer()

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            'b => strong',
            'i => em',
            'u => u'
          ],
          convertImage: mammoth.images.imgElement(async () => {
            // Skip images for autocue scripts
            return { src: '' }
          })
        }
      )

      const htmlContent = result.value

      // Convert HTML to plain text while preserving paragraph structure
      const plainText = htmlContent
        .replace(/<\/p>/gi, '\n') // Convert closing </p> tags to newlines
        .replace(/<\/h[1-6]>/gi, '\n') // Convert closing heading tags to newlines
        .replace(/<br\s*\/?>/gi, '\n') // Convert <br> tags to newlines
        .replace(/<[^>]*>/g, '') // Strip remaining HTML tags
        .trim()

      // Check if document is empty
      if (!plainText || plainText.length === 0) {
        throw new Error('Document is empty or corrupted')
      }

      // Step 3: Extract formatting metadata
      const formattingMetadata = extractFormattingMetadata(htmlContent)

      // Step 4: Create ScriptDocument
      const document: ScriptDocument = {
        id: crypto.randomUUID(),
        filename: file.name,
        fileSize: file.size,
        uploadTimestamp: new Date(),
        textContent: plainText,
        htmlContent,
        formattingMetadata,
        validationStatus: 'valid'
      }

      setIsLoading(false)
      return document
    } catch (err) {
      let errorMessage = 'Failed to parse file'

      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }

      // Provide more helpful error messages
      if (errorMessage.includes('arrayBuffer')) {
        errorMessage =
          'Unable to read file. Please ensure the file is a valid .docx document.'
      } else if (errorMessage.includes('convertToHtml')) {
        errorMessage =
          'Failed to parse .docx file. The file may be corrupted or in an unsupported format.'
      }

      const error = new Error(errorMessage)
      setError(error)
      setIsLoading(false)
      throw error
    }
  }

  return { parseFile, isLoading, error }
}

// Helper function to extract formatting metadata from HTML
function extractFormattingMetadata(html: string): FormattingMetadata {
  const metadata: FormattingMetadata = {
    boldRanges: [],
    italicRanges: [],
    underlineRanges: [],
    headings: [],
    lists: [],
    paragraphs: []
  }

  // Guard against empty HTML
  if (!html || html.trim().length === 0) {
    return metadata
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    let currentPosition = 0

    // Extract bold ranges
    doc.querySelectorAll('strong, b').forEach((element) => {
      const text = element.textContent || ''
      metadata.boldRanges.push({
        start: currentPosition,
        end: currentPosition + text.length,
        text
      })
    })

    // Extract italic ranges
    doc.querySelectorAll('em, i').forEach((element) => {
      const text = element.textContent || ''
      metadata.italicRanges.push({
        start: currentPosition,
        end: currentPosition + text.length,
        text
      })
    })

    // Extract underline ranges
    doc.querySelectorAll('u').forEach((element) => {
      const text = element.textContent || ''
      metadata.underlineRanges.push({
        start: currentPosition,
        end: currentPosition + text.length,
        text
      })
    })

    // Extract headings
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((element) => {
      const level = parseInt(element.tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6
      const text = element.textContent || ''
      metadata.headings.push({
        level,
        text,
        position: currentPosition
      })
    })

    // Extract lists
    doc.querySelectorAll('ul, ol').forEach((listElement) => {
      const isOrdered = listElement.tagName === 'OL'
      listElement.querySelectorAll('li').forEach((item) => {
        const text = item.textContent || ''
        metadata.lists.push({
          type: isOrdered ? 'ordered' : 'unordered',
          text,
          level: 1, // TODO: Calculate nesting level
          position: currentPosition
        })
      })
    })

    // Extract paragraphs
    doc.querySelectorAll('p').forEach((element) => {
      const text = element.textContent || ''
      metadata.paragraphs.push({
        text,
        start: currentPosition,
        end: currentPosition + text.length
      })
      currentPosition += text.length
    })

    return metadata
  } catch (error) {
    // If metadata extraction fails, return empty metadata
    logger.warn('Failed to extract formatting metadata:', error)
    return metadata
  }
}
