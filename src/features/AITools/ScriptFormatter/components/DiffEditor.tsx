/**
 * DiffEditor Component
 * Feature: 006-i-wish-to (T046)
 * Purpose: Monaco Editor for viewing and editing formatted output
 */

import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useTheme } from 'next-themes'
import React, { useEffect, useMemo, useRef, useState } from 'react'

// Monaco is bundled locally via vite-plugin-monaco-editor
// The plugin automatically configures workers for Tauri environment
// No manual worker configuration needed

interface DiffEditorProps {
  original: string // Kept for compatibility but not displayed
  modified: string
  onModifiedChange: (value: string) => void
  height?: string
}

// Light themes that should use vs-light Monaco theme
const LIGHT_THEMES = ['light', 'catppuccin-latte']

export const DiffEditor: React.FC<DiffEditorProps> = ({ modified, onModifiedChange }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const { resolvedTheme } = useTheme()

  // Determine Monaco editor theme based on app theme
  const monacoTheme = useMemo(() => {
    if (!resolvedTheme) return 'vs-dark'
    return LIGHT_THEMES.includes(resolvedTheme) ? 'vs-light' : 'vs-dark'
  }, [resolvedTheme])

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onModifiedChange(value)
    }
  }

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    setIsEditorReady(true)

    // Force layout after mount
    setTimeout(() => {
      editor.layout()
    }, 100)
  }

  // Re-layout editor when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="border-border mb-2 flex h-[calc(100vh-300px)] flex-col overflow-hidden rounded-lg border">
      <div className="bg-muted border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="text-foreground text-sm font-medium">
          Formatted Script (Editable)
        </span>
        <span className="text-muted-foreground text-xs">
          Use **text** for bold formatting
        </span>
      </div>

      <div ref={containerRef} className="relative flex-1">
        {!isEditorReady && (
          <div className="bg-background absolute inset-0 z-10 flex items-center justify-center">
            <div className="text-center">
              <div className="border-foreground mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground text-sm">Loading editor...</p>
              <p className="text-muted-foreground/70 mt-1 text-xs">
                This may take a few seconds
              </p>
            </div>
          </div>
        )}
        <Editor
          height="100%"
          width="100%"
          language="markdown"
          value={modified || ''}
          defaultValue={modified || ''}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="border-foreground mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
                <p className="text-muted-foreground text-sm">Loading Monaco Editor...</p>
                <p className="text-muted-foreground/70 mt-2 text-xs">
                  If this persists, check browser console for errors
                </p>
              </div>
            </div>
          }
          options={{
            wordWrap: 'bounded',
            wrappingStrategy: 'advanced',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            readOnly: false,
            automaticLayout: true,
            renderWhitespace: 'selection',
            tabSize: 2,
            unicodeHighlight: {
              ambiguousCharacters: false,
              invisibleCharacters: false,
              nonBasicASCII: false
            }
          }}
          theme={monacoTheme}
        />
      </div>
    </div>
  )
}
