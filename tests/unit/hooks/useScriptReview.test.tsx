/**
 * Unit Tests for useScriptReview Hook
 * DEBT-001: Refactoring useScriptFormatterState - Review Responsibility
 *
 * This hook manages:
 * - Markdown text viewing and editing
 * - Modified text state
 * - Edit history tracking
 * - Undo/redo functionality
 * - Change detection
 */

import type { ProcessedOutput } from '@/types/scriptFormatter'
import { useScriptReview } from '@hooks/useScriptReview'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@utils/logger', () => ({
  createNamespacedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useScriptReview', () => {
  const initialProcessedOutput: ProcessedOutput = {
    formattedText: 'Initial formatted text',
    generationTimestamp: new Date('2024-01-01'),
    examplesCount: 2,
    editHistory: [],
    isEdited: false
  }

  describe('Initial State', () => {
    it('should initialize with null when no processed output provided', () => {
      const { result } = renderHook(() => useScriptReview())

      expect(result.current.markdownText).toBe('')
      expect(result.current.modifiedText).toBe('')
      expect(result.current.hasChanges).toBe(false)
    })

    it('should initialize with processed output text', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      expect(result.current.markdownText).toBe('Initial formatted text')
      expect(result.current.modifiedText).toBe('Initial formatted text')
      expect(result.current.hasChanges).toBe(false)
    })

    it('should initialize with empty edit history', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      expect(result.current.editHistory).toEqual([])
    })
  })

  describe('Text Modification', () => {
    it('should update modified text when handleChange is called', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Updated text content')
      })

      expect(result.current.modifiedText).toBe('Updated text content')
      expect(result.current.markdownText).toBe('Updated text content')
    })

    it('should detect changes from original', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      expect(result.current.hasChanges).toBe(false)

      act(() => {
        result.current.handleChange('Modified content')
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should not detect changes when text is reverted to original', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content')
      })

      expect(result.current.hasChanges).toBe(true)

      act(() => {
        result.current.handleChange('Initial formatted text')
      })

      expect(result.current.hasChanges).toBe(false)
    })

    it('should call onChange callback when text changes', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput,
          onChange
        })
      )

      act(() => {
        result.current.handleChange('New content')
      })

      expect(onChange).toHaveBeenCalledWith('New content')
    })

    it('should not call onChange if text is same', () => {
      const onChange = vi.fn()
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput,
          onChange
        })
      )

      act(() => {
        result.current.handleChange('Initial formatted text')
      })

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('Edit History', () => {
    it('should add entry to edit history on change', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content')
      })

      expect(result.current.editHistory).toHaveLength(1)
      expect(result.current.editHistory[0]).toMatchObject({
        type: 'manual',
        changeDescription: 'Manual edit',
        previousValue: 'Initial formatted text',
        newValue: 'Modified content'
      })
    })

    it('should track multiple edits in history', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('First edit')
      })

      act(() => {
        result.current.handleChange('Second edit')
      })

      act(() => {
        result.current.handleChange('Third edit')
      })

      expect(result.current.editHistory).toHaveLength(3)
      expect(result.current.editHistory[0].newValue).toBe('First edit')
      expect(result.current.editHistory[1].newValue).toBe('Second edit')
      expect(result.current.editHistory[2].newValue).toBe('Third edit')
    })

    it('should include timestamp in edit history', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      const beforeEdit = new Date()

      act(() => {
        result.current.handleChange('Modified content')
      })

      const afterEdit = new Date()

      expect(result.current.editHistory[0].timestamp).toBeDefined()
      expect(result.current.editHistory[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeEdit.getTime()
      )
      expect(result.current.editHistory[0].timestamp.getTime()).toBeLessThanOrEqual(
        afterEdit.getTime()
      )
    })

    it('should preserve existing edit history from initial output', () => {
      const outputWithHistory: ProcessedOutput = {
        ...initialProcessedOutput,
        editHistory: [
          {
            timestamp: new Date('2024-01-01'),
            type: 'ai-generated',
            changeDescription: 'Initial AI formatting',
            previousValue: 'Raw text',
            newValue: 'Initial formatted text'
          }
        ]
      }

      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: outputWithHistory
        })
      )

      expect(result.current.editHistory).toHaveLength(1)

      act(() => {
        result.current.handleChange('User edit')
      })

      expect(result.current.editHistory).toHaveLength(2)
      expect(result.current.editHistory[0].type).toBe('ai-generated')
      expect(result.current.editHistory[1].type).toBe('manual')
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('should support undo to previous state', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('First edit')
      })

      act(() => {
        result.current.handleChange('Second edit')
      })

      expect(result.current.modifiedText).toBe('Second edit')
      expect(result.current.canUndo).toBe(true)

      act(() => {
        result.current.undo()
      })

      expect(result.current.modifiedText).toBe('First edit')
    })

    it('should support redo after undo', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('First edit')
      })

      act(() => {
        result.current.handleChange('Second edit')
      })

      act(() => {
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.redo()
      })

      expect(result.current.modifiedText).toBe('Second edit')
    })

    it('should not undo beyond initial state', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Single edit')
      })

      act(() => {
        result.current.undo()
      })

      expect(result.current.modifiedText).toBe('Initial formatted text')
      expect(result.current.canUndo).toBe(false)

      act(() => {
        result.current.undo() // Should do nothing
      })

      expect(result.current.modifiedText).toBe('Initial formatted text')
    })

    it('should clear redo stack when new edit is made after undo', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('First edit')
      })

      act(() => {
        result.current.handleChange('Second edit')
      })

      act(() => {
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.handleChange('New branch edit')
      })

      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('Updated Output', () => {
    it('should provide updated output with current state', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content')
      })

      const updatedOutput = result.current.getUpdatedOutput()

      expect(updatedOutput.formattedText).toBe('Modified content')
      expect(updatedOutput.isEdited).toBe(true)
      expect(updatedOutput.editHistory).toHaveLength(1)
    })

    it('should preserve original metadata in updated output', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content')
      })

      const updatedOutput = result.current.getUpdatedOutput()

      expect(updatedOutput.generationTimestamp).toEqual(
        initialProcessedOutput.generationTimestamp
      )
      expect(updatedOutput.examplesCount).toBe(initialProcessedOutput.examplesCount)
    })

    it('should mark output as edited when text changes', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      let updatedOutput = result.current.getUpdatedOutput()
      expect(updatedOutput.isEdited).toBe(false)

      act(() => {
        result.current.handleChange('Modified content')
      })

      updatedOutput = result.current.getUpdatedOutput()
      expect(updatedOutput.isEdited).toBe(true)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content 1')
      })

      act(() => {
        result.current.handleChange('Modified content 2')
      })

      expect(result.current.hasChanges).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.modifiedText).toBe('Initial formatted text')
      expect(result.current.hasChanges).toBe(false)
      expect(result.current.editHistory).toHaveLength(0)
    })

    it('should clear undo/redo stacks on reset', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('First edit')
      })

      act(() => {
        result.current.handleChange('Second edit')
      })

      act(() => {
        result.current.undo()
      })

      // After two changes and one undo, we should have both undo and redo available
      expect(result.current.canUndo).toBe(true)
      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('Load New Output', () => {
    it('should load new processed output', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      const newOutput: ProcessedOutput = {
        formattedText: 'New formatted text',
        generationTimestamp: new Date('2024-02-01'),
        examplesCount: 3,
        editHistory: [],
        isEdited: false
      }

      act(() => {
        result.current.loadOutput(newOutput)
      })

      expect(result.current.modifiedText).toBe('New formatted text')
      expect(result.current.hasChanges).toBe(false)
    })

    it('should clear previous changes when loading new output', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('User modifications')
      })

      expect(result.current.hasChanges).toBe(true)

      const newOutput: ProcessedOutput = {
        formattedText: 'New formatted text',
        generationTimestamp: new Date('2024-02-01'),
        examplesCount: 3,
        editHistory: [],
        isEdited: false
      }

      act(() => {
        result.current.loadOutput(newOutput)
      })

      expect(result.current.hasChanges).toBe(false)
      expect(result.current.editHistory).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const emptyOutput: ProcessedOutput = {
        ...initialProcessedOutput,
        formattedText: ''
      }

      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: emptyOutput
        })
      )

      expect(result.current.modifiedText).toBe('')

      act(() => {
        result.current.handleChange('Now has content')
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should handle very large text efficiently', () => {
      const largeText = 'A'.repeat(100000) // 100KB of text

      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: {
            ...initialProcessedOutput,
            formattedText: largeText
          }
        })
      )

      expect(result.current.modifiedText).toBe(largeText)

      const start = performance.now()
      act(() => {
        result.current.handleChange(largeText + ' modified')
      })
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100) // Should complete in <100ms
    })

    it('should handle rapid consecutive changes', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.handleChange(`Edit ${i}`)
        }
      })

      expect(result.current.modifiedText).toBe('Edit 49')
      expect(result.current.editHistory).toHaveLength(50)
    })

    it('should handle special characters in text', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      const specialText =
        '**Bold** _italic_ <script>alert("xss")</script> \n\n Line breaks'

      act(() => {
        result.current.handleChange(specialText)
      })

      expect(result.current.modifiedText).toBe(specialText)
    })
  })

  describe('Warning Before Unload', () => {
    it('should indicate unsaved changes exist', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      expect(result.current.hasUnsavedChanges).toBe(false)

      act(() => {
        result.current.handleChange('Modified content')
      })

      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('should clear unsaved changes flag after explicit save', () => {
      const { result } = renderHook(() =>
        useScriptReview({
          initialOutput: initialProcessedOutput
        })
      )

      act(() => {
        result.current.handleChange('Modified content')
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      act(() => {
        result.current.markAsSaved()
      })

      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })
})
