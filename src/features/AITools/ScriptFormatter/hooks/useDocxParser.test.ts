/**
 * Behavioural tests for useDocxParser — drives a real .docx through mammoth and
 * the metadata extractor, asserting that list nesting levels are computed from
 * the actual document structure (not the previous hard-coded `level: 1` stub).
 */
import { Document, LevelFormat, Packer, Paragraph, TextRun } from 'docx'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The Tauri renderer resolves `mammoth` to its browser build (via the package's
// `browser` field), which unzips from an ArrayBuffer — exactly what parseFile
// passes. Under vitest's node resolution the default build is used instead and
// only accepts a Buffer, so we point the import at the same browser build the
// real app runs. This is a resolution fix, not a behaviour stub: the real
// mammoth still does the docx -> HTML conversion.
vi.mock('mammoth', async () => {
  // Non-literal specifier so tsc does not try to resolve the untyped browser
  // subpath; vitest still resolves it at runtime.
  const specifier = 'mammoth/mammoth.browser.js'
  const browser = (await import(specifier)) as {
    default?: Record<string, unknown>
  } & Record<string, unknown>
  const mod = browser.default ?? browser
  return { default: mod, ...mod }
})

import { useDocxParser } from './useDocxParser'

/**
 * Build an in-memory .docx as the upload flow would hand it to parseFile.
 * jsdom's File does not implement arrayBuffer(), so we supply the minimal File
 * surface parseFile actually consumes (name, size, arrayBuffer).
 */
async function makeDocx(build: () => Document, name = 'script.docx'): Promise<File> {
  const buffer = await Packer.toBuffer(build())
  const bytes = new Uint8Array(buffer)
  return {
    name,
    size: bytes.byteLength,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    arrayBuffer: async () => bytes.buffer
  } as unknown as File
}

function nestedBulletDoc(): Document {
  return new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: '•', alignment: 'left' },
            { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: 'left' }
          ]
        }
      ]
    },
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun('Top item')],
            numbering: { reference: 'bullets', level: 0 }
          }),
          new Paragraph({
            children: [new TextRun('Nested item')],
            numbering: { reference: 'bullets', level: 1 }
          })
        ]
      }
    ]
  })
}

describe('useDocxParser list nesting', () => {
  it('computes a deeper level for a nested list item than its parent', async () => {
    const { result } = renderHook(() => useDocxParser())
    const file = await makeDocx(nestedBulletDoc)

    const doc = await result.current.parseFile(file)
    const levels = doc.formattingMetadata.lists.map((l) => l.level)

    // Sanity: mammoth emitted two <li> nodes for our two paragraphs.
    expect(doc.formattingMetadata.lists).toHaveLength(2)
    // The parent sits one level shallower than the nested child; the child is
    // strictly deeper (this is exactly what the removed `level: 1` stub got wrong).
    const [parentLevel, childLevel] = levels
    expect(childLevel).toBeGreaterThan(parentLevel)
    expect(levels).toEqual([1, 2])
  })
})
