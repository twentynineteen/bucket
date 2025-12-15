/**
 * useDocxGenerator Hook
 * Feature: 006-i-wish-to (T039)
 * Purpose: Generate .docx files from HTML using docx package
 */

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { useState } from 'react'

interface UseDocxGeneratorResult {
  generateFile: (html: string, defaultFilename: string) => Promise<void>
  isGenerating: boolean
  error: Error | null
}

export function useDocxGenerator(): UseDocxGeneratorResult {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateFile = async (html: string, defaultFilename: string) => {
    setIsGenerating(true)
    setError(null)

    try {
      // Step 1: Convert HTML to docx structure
      const paragraphs = htmlToDocxParagraphs(html)

      // Step 2: Create docx document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs
          }
        ]
      })

      // Step 3: Generate blob
      const blob = await Packer.toBlob(doc)

      // Step 4: Trigger Tauri save dialog
      const savePath = await save({
        filters: [
          {
            name: 'Word Document',
            extensions: ['docx']
          }
        ],
        defaultPath: defaultFilename
      })

      if (!savePath) {
        // User cancelled
        setIsGenerating(false)
        return
      }

      // Step 5: Write file using Tauri FS plugin
      const arrayBuffer = await blob.arrayBuffer()
      await writeFile(savePath, new Uint8Array(arrayBuffer))

      setIsGenerating(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate file')
      setError(error)
      setIsGenerating(false)
      throw error
    }
  }

  return { generateFile, isGenerating, error }
}

// Convert HTML to docx Paragraph array with formatting preservation
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const paragraphs: Paragraph[] = []

  // Process each element in the body
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element

      // Handle headings
      if (element.tagName.match(/^H[1-6]$/)) {
        const level = parseInt(element.tagName[1])
        const headingLevel = [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6
        ][level - 1]

        paragraphs.push(
          new Paragraph({
            text: element.textContent || '',
            heading: headingLevel
          })
        )
      }
      // Handle paragraphs
      else if (element.tagName === 'P') {
        const runs = parseTextRuns(element)
        paragraphs.push(new Paragraph({ children: runs }))
      }
      // Handle line breaks
      else if (element.tagName === 'BR') {
        paragraphs.push(new Paragraph({ text: '' }))
      }
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      // Handle plain text nodes
      paragraphs.push(new Paragraph({ text: node.textContent }))
    }
  })

  return paragraphs
}

// Parse text runs with formatting (bold, italic, underline)
function parseTextRuns(element: Element): TextRun[] {
  const runs: TextRun[] = []

  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || ''
      if (text.trim()) {
        runs.push(new TextRun(text))
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childElement = child as Element
      const text = childElement.textContent || ''

      if (!text.trim()) return

      // Detect formatting
      const isBold = ['STRONG', 'B'].includes(childElement.tagName)
      const isItalic = ['EM', 'I'].includes(childElement.tagName)
      const isUnderline = childElement.tagName === 'U'

      runs.push(
        new TextRun({
          text,
          bold: isBold,
          italics: isItalic,
          underline: isUnderline ? {} : undefined
        })
      )
    }
  })

  return runs
}
