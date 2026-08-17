/**
 * useScriptReview Hook
 * Manages text editing and review for formatted scripts
 *
 * Responsibilities:
 * - Text viewing and editing
 * - Edit history tracking
 * - Undo/redo functionality
 * - Change detection
 * - Unsaved changes warnings
 */

import { createNamespacedLogger } from '@shared/utils'
import { useCallback, useMemo, useState } from 'react'

import type { Edit, ProcessedOutput } from '@shared/types'

const log = createNamespacedLogger('ScriptReview')

interface UseScriptReviewOptions {
  initialOutput?: ProcessedOutput | null
  onChange?: (newText: string) => void
}

export function useScriptReview(options?: UseScriptReviewOptions) {
  const { initialOutput, onChange } = options || {}

  // Initialize state from initial output
  const [originalText, setOriginalText] = useState(
    () => initialOutput?.formattedText || ''
  )
  const [modifiedText, setModifiedText] = useState(
    () => initialOutput?.formattedText || ''
  )
  const [editHistory, setEditHistory] = useState<Edit[]>(
    () => initialOutput?.editHistory || []
  )
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const [isSaved, setIsSaved] = useState(true)

  // Derived state
  const markdownText = modifiedText
  const hasChanges = useMemo(
    () => modifiedText !== originalText,
    [modifiedText, originalText]
  )
  const hasUnsavedChanges = useMemo(() => hasChanges && !isSaved, [hasChanges, isSaved])
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const handleChange = useCallback(
    (newText: string) => {
      if (newText === modifiedText) {
        return // No change
      }

      log.debug('Text changed, length:', newText.length)

      // Add current text to undo stack
      setUndoStack((prev) => [...prev, modifiedText])
      setRedoStack([]) // Clear redo stack on new change

      // Update text
      setModifiedText(newText)
      setIsSaved(false)

      // Add to edit history
      const historyEntry: Edit = {
        timestamp: new Date(),
        type: 'manual',
        changeDescription: 'Manual edit',
        previousValue: modifiedText,
        newValue: newText
      }

      setEditHistory((prev) => [...prev, historyEntry])

      // Notify callback
      if (onChange) {
        onChange(newText)
      }
    },
    [modifiedText, onChange]
  )

  const undo = useCallback(() => {
    if (undoStack.length === 0) {
      log.warn('Nothing to undo')
      return
    }

    log.debug('Undo operation')

    // Pop from undo stack
    const previousText = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))

    // Push current to redo stack
    setRedoStack((prev) => [...prev, modifiedText])

    // Restore previous text
    setModifiedText(previousText)
    setIsSaved(false)
  }, [undoStack, modifiedText])

  const redo = useCallback(() => {
    if (redoStack.length === 0) {
      log.warn('Nothing to redo')
      return
    }

    log.debug('Redo operation')

    // Pop from redo stack
    const nextText = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))

    // Push current to undo stack
    setUndoStack((prev) => [...prev, modifiedText])

    // Apply next text
    setModifiedText(nextText)
    setIsSaved(false)
  }, [redoStack, modifiedText])

  // Null with no initialOutput: there is nothing to produce an updated copy
  // of. The previous code returned a five-field object cast as a whole
  // ProcessedOutput, so any caller reading id, requestId, formattedHtml or
  // diffData from it got undefined (#178).
  const getUpdatedOutput = useCallback((): ProcessedOutput | null => {
    if (!initialOutput) {
      return null
    }

    return {
      ...initialOutput,
      formattedText: modifiedText,
      editHistory,
      isEdited: hasChanges
    }
  }, [initialOutput, modifiedText, editHistory, hasChanges])

  const reset = useCallback(() => {
    log.debug('Resetting review state')
    setModifiedText(originalText)
    setEditHistory(initialOutput?.editHistory || [])
    setUndoStack([])
    setRedoStack([])
    setIsSaved(true)
  }, [originalText, initialOutput])

  const loadOutput = useCallback((output: ProcessedOutput) => {
    log.info('Loading new output')
    setOriginalText(output.formattedText)
    setModifiedText(output.formattedText)
    setEditHistory(output.editHistory)
    setUndoStack([])
    setRedoStack([])
    setIsSaved(true)
  }, [])

  const markAsSaved = useCallback(() => {
    log.debug('Marking as saved')
    setIsSaved(true)
  }, [])

  return {
    // State
    markdownText,
    modifiedText,
    hasChanges,
    hasUnsavedChanges,
    editHistory,
    canUndo,
    canRedo,

    // Actions
    handleChange,
    undo,
    redo,
    getUpdatedOutput,
    reset,
    loadOutput,
    markAsSaved
  }
}
