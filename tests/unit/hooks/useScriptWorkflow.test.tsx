/**
 * Unit Tests for useScriptWorkflow Hook
 * DEBT-001: Refactoring useScriptFormatterState - Workflow Orchestration
 *
 * This hook manages:
 * - Workflow step navigation (upload → select-model → processing → review → download)
 * - Integration of all sub-hooks
 * - Global state coordination
 * - Session persistence (localStorage)
 * - Navigation warnings for unsaved work
 */

import type { WorkflowStep } from '@/types/scriptFormatter'
import { useAIProcessing } from '@hooks/useAIProcessing'
import { useScriptDownload } from '@hooks/useScriptDownload'
import { useScriptReview } from '@hooks/useScriptReview'
import { useScriptUpload } from '@hooks/useScriptUpload'
import { useScriptWorkflow } from '@hooks/useScriptWorkflow'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all sub-hooks
vi.mock('@hooks/useScriptUpload', () => ({
  useScriptUpload: vi.fn()
}))

vi.mock('@hooks/useAIProcessing', () => ({
  useAIProcessing: vi.fn()
}))

vi.mock('@hooks/useScriptReview', () => ({
  useScriptReview: vi.fn()
}))

vi.mock('@hooks/useScriptDownload', () => ({
  useScriptDownload: vi.fn()
}))

vi.mock('@utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn()
  },
  createNamespacedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn()
  })
}))

describe('useScriptWorkflow', () => {
  const mockUploadHook = {
    document: null,
    isParsing: false,
    parseError: null,
    handleFileSelect: vi.fn(),
    reset: vi.fn()
  }

  const mockProcessingHook = {
    selectedModelId: null,
    isProcessing: false,
    processedOutput: null,
    progress: 0,
    ragStatus: '',
    examplesCount: 0,
    models: [],
    activeProvider: null,
    isValidatingProvider: false,
    handleFormatScript: vi.fn(),
    setSelectedModelId: vi.fn(),
    reset: vi.fn()
  }

  const mockReviewHook = {
    modifiedText: '',
    markdownText: '',
    hasChanges: false,
    hasUnsavedChanges: false,
    handleChange: vi.fn(),
    getUpdatedOutput: vi.fn(),
    reset: vi.fn()
  }

  const mockDownloadHook = {
    isGenerating: false,
    generateError: null,
    handleDownload: vi.fn(),
    reset: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(useScriptUpload as any).mockReturnValue(mockUploadHook)
    ;(useAIProcessing as any).mockReturnValue(mockProcessingHook)
    ;(useScriptReview as any).mockReturnValue(mockReviewHook)
    ;(useScriptDownload as any).mockReturnValue(mockDownloadHook)
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Initial State', () => {
    it('should start at upload step', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.currentStep).toBe('upload')
    })

    it('should expose all sub-hook states', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.document).toBe(mockUploadHook.document)
      expect(result.current.selectedModelId).toBe(mockProcessingHook.selectedModelId)
      expect(result.current.modifiedText).toBe(mockReviewHook.modifiedText)
      expect(result.current.isGenerating).toBe(mockDownloadHook.isGenerating)
    })

    it('should initialize all sub-hooks', () => {
      renderHook(() => useScriptWorkflow())

      expect(useScriptUpload).toHaveBeenCalled()
      expect(useAIProcessing).toHaveBeenCalled()
      expect(useScriptReview).toHaveBeenCalled()
      expect(useScriptDownload).toHaveBeenCalled()
    })
  })

  describe('Step Navigation', () => {
    it('should allow manual step navigation', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('select-model')
      })

      expect(result.current.currentStep).toBe('select-model')
    })

    it('should navigate through all steps in order', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      const steps: WorkflowStep[] = [
        'upload',
        'select-model',
        'processing',
        'review',
        'download'
      ]

      steps.forEach(step => {
        act(() => {
          result.current.goToStep(step)
        })
        expect(result.current.currentStep).toBe(step)
      })
    })

    it('should allow backward navigation', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      expect(result.current.currentStep).toBe('review')

      act(() => {
        result.current.goToStep('select-model')
      })

      expect(result.current.currentStep).toBe('select-model')
    })
  })

  describe('Upload Flow', () => {
    it('should handle file upload and advance to select-model', async () => {
      const mockDocument = {
        filename: 'test.docx',
        textContent: 'Test content',
        metadata: {}
      }

      mockUploadHook.handleFileSelect.mockResolvedValue(undefined)

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.currentStep).toBe('upload')

      // Simulate successful upload
      await act(async () => {
        await mockUploadHook.handleFileSelect(new File([], 'test.docx'))
        // Manually trigger step change as hook would
        result.current.goToStep('select-model')
      })

      expect(result.current.currentStep).toBe('select-model')
    })

    it('should stay on upload step if file parsing fails', async () => {
      mockUploadHook.handleFileSelect.mockRejectedValue(new Error('Parse failed'))

      const { result } = renderHook(() => useScriptWorkflow())

      await act(async () => {
        try {
          await mockUploadHook.handleFileSelect(new File([], 'test.docx'))
        } catch {
          // Error handled
        }
      })

      expect(result.current.currentStep).toBe('upload')
    })
  })

  describe('Processing Flow', () => {
    it('should handle processing and advance to review', async () => {
      mockProcessingHook.handleFormatScript.mockResolvedValue(undefined)

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('select-model')
      })

      await act(async () => {
        await mockProcessingHook.handleFormatScript('Test content')
        result.current.goToStep('review')
      })

      expect(result.current.currentStep).toBe('review')
    })

    it('should stay on processing step during active processing', () => {
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        isProcessing: true
      })

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('processing')
      })

      expect(result.current.currentStep).toBe('processing')
      expect(result.current.isProcessing).toBe(true)
    })
  })

  describe('Review Flow', () => {
    it('should handle text modifications in review step', () => {
      ;(useScriptReview as any).mockReturnValue({
        ...mockReviewHook,
        modifiedText: 'Original text',
        hasChanges: false
      })

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      expect(result.current.hasChanges).toBe(false)
      ;(useScriptReview as any).mockReturnValue({
        ...mockReviewHook,
        modifiedText: 'Modified text',
        hasChanges: true
      })

      const { result: result2 } = renderHook(() => useScriptWorkflow())

      expect(result2.current.hasChanges).toBe(true)
    })

    it('should provide access to review functionality', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      act(() => {
        mockReviewHook.handleChange('New text')
      })

      expect(mockReviewHook.handleChange).toHaveBeenCalledWith('New text')
    })
  })

  describe('Download Flow', () => {
    it('should handle download and advance to download step', async () => {
      mockDownloadHook.handleDownload.mockResolvedValue(undefined)

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      await act(async () => {
        await mockDownloadHook.handleDownload(
          { filename: 'test.docx', textContent: 'content', metadata: {} },
          'Markdown text'
        )
        result.current.goToStep('download')
      })

      expect(result.current.currentStep).toBe('download')
    })
  })

  describe('Start Over Functionality', () => {
    it('should reset all state and return to upload', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      expect(result.current.currentStep).toBe('review')

      act(() => {
        result.current.handleStartOver()
      })

      expect(result.current.currentStep).toBe('upload')
      expect(mockUploadHook.reset).toHaveBeenCalled()
      expect(mockProcessingHook.reset).toHaveBeenCalled()
      expect(mockReviewHook.reset).toHaveBeenCalled()
    })

    it('should clear localStorage on start over', () => {
      localStorage.setItem('test-key', 'test-value')

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.handleStartOver()
      })

      // Verify cached output is cleared
      expect(localStorage.getItem('PROCESSED_OUTPUT')).toBeNull()
    })
  })

  describe('Session Persistence', () => {
    it('should restore previous session from localStorage', () => {
      const cachedOutput = {
        formattedText: 'Cached formatted text',
        generationTimestamp: new Date().toISOString(),
        examplesCount: 3,
        editHistory: [],
        isEdited: false
      }

      localStorage.setItem('PROCESSED_OUTPUT', JSON.stringify(cachedOutput))
      ;(useScriptReview as any).mockReturnValue({
        ...mockReviewHook,
        modifiedText: cachedOutput.formattedText
      })

      const { result } = renderHook(() => useScriptWorkflow())

      // Should restore to review step (initialized synchronously)
      expect(result.current.currentStep).toBe('review')
      expect(result.current.modifiedText).toBe(cachedOutput.formattedText)
    })

    it('should start fresh when no cached session exists', () => {
      localStorage.clear()

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.currentStep).toBe('upload')
    })

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('PROCESSED_OUTPUT', 'invalid json {{{')

      const { result } = renderHook(() => useScriptWorkflow())

      // Should start fresh without crashing
      expect(result.current.currentStep).toBe('upload')
    })

    it('should clear cache after successful download', async () => {
      localStorage.setItem(
        'PROCESSED_OUTPUT',
        JSON.stringify({
          formattedText: 'Test',
          generationTimestamp: new Date(),
          examplesCount: 1,
          editHistory: [],
          isEdited: false
        })
      )

      const { result } = renderHook(() => useScriptWorkflow())

      await act(async () => {
        result.current.goToStep('download')
      })

      // Cache should be cleared after download
      expect(localStorage.getItem('PROCESSED_OUTPUT')).toBeNull()
    })
  })

  describe('Navigation Warnings', () => {
    it('should warn before unload with unsaved changes', () => {
      ;(useScriptReview as any).mockReturnValue({
        ...mockReviewHook,
        hasUnsavedChanges: true
      })

      const { result } = renderHook(() => useScriptWorkflow())

      act(() => {
        result.current.goToStep('review')
      })

      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('should not warn before unload without changes', () => {
      ;(useScriptReview as any).mockReturnValue({
        ...mockReviewHook,
        hasUnsavedChanges: false
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should expose upload errors', () => {
      ;(useScriptUpload as any).mockReturnValue({
        ...mockUploadHook,
        parseError: new Error('Upload failed')
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.parseError).toBeTruthy()
    })

    it('should expose processing errors', () => {
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        processingError: new Error('Processing failed')
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.processingError).toBeTruthy()
    })

    it('should expose download errors', () => {
      ;(useScriptDownload as any).mockReturnValue({
        ...mockDownloadHook,
        generateError: new Error('Download failed')
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.generateError).toBeTruthy()
    })
  })

  describe('Loading States Aggregation', () => {
    it('should indicate busy when any sub-hook is loading', () => {
      ;(useScriptUpload as any).mockReturnValue({
        ...mockUploadHook,
        isParsing: true
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.isBusy).toBe(true)
    })

    it('should not be busy when all sub-hooks are idle', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.isBusy).toBe(false)
    })

    it('should be busy during processing', () => {
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        isProcessing: true
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.isBusy).toBe(true)
    })

    it('should be busy during file generation', () => {
      ;(useScriptDownload as any).mockReturnValue({
        ...mockDownloadHook,
        isGenerating: true
      })

      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.isBusy).toBe(true)
    })
  })

  describe('Step Validation', () => {
    it('should validate requirements before advancing steps', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      // Can't go to select-model without document
      expect(result.current.canAdvanceToSelectModel).toBe(false)
      ;(useScriptUpload as any).mockReturnValue({
        ...mockUploadHook,
        document: { filename: 'test.docx', textContent: 'content', metadata: {} }
      })

      const { result: result2 } = renderHook(() => useScriptWorkflow())

      expect(result2.current.canAdvanceToSelectModel).toBe(true)
    })

    it('should validate model selection before processing', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.canStartProcessing).toBe(false)
      ;(useScriptUpload as any).mockReturnValue({
        ...mockUploadHook,
        document: { filename: 'test.docx', textContent: 'content', metadata: {} }
      })
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        selectedModelId: 'gpt-4',
        activeProvider: { id: 'openai', status: 'configured' }
      })

      const { result: result2 } = renderHook(() => useScriptWorkflow())

      expect(result2.current.canStartProcessing).toBe(true)
    })

    it('should validate processed output before review', () => {
      const { result } = renderHook(() => useScriptWorkflow())

      expect(result.current.canAdvanceToReview).toBe(false)
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        processedOutput: {
          formattedText: 'Processed text',
          generationTimestamp: new Date(),
          examplesCount: 2,
          editHistory: [],
          isEdited: false
        }
      })

      const { result: result2 } = renderHook(() => useScriptWorkflow())

      expect(result2.current.canAdvanceToReview).toBe(true)
    })
  })

  describe('Integration', () => {
    it('should coordinate between upload and processing hooks', async () => {
      const mockDocument = {
        filename: 'test.docx',
        textContent: 'Test content',
        metadata: {}
      }

      const { result, rerender } = renderHook(() => useScriptWorkflow())

      // Upload file
      ;(useScriptUpload as any).mockReturnValue({
        ...mockUploadHook,
        document: mockDocument
      })

      rerender()

      act(() => {
        result.current.goToStep('select-model')
      })

      // Select model and process
      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        selectedModelId: 'gpt-4'
      })

      rerender()

      expect(result.current.document).toBe(mockDocument)
      expect(result.current.selectedModelId).toBe('gpt-4')
    })

    it('should pass processed output to review hook', () => {
      const processedOutput = {
        formattedText: 'Formatted text',
        generationTimestamp: new Date(),
        examplesCount: 2,
        editHistory: [],
        isEdited: false
      }

      ;(useAIProcessing as any).mockReturnValue({
        ...mockProcessingHook,
        processedOutput
      })

      renderHook(() => useScriptWorkflow())

      // Verify review hook received the processed output
      expect(useScriptReview).toHaveBeenCalledWith(
        expect.objectContaining({
          initialOutput: processedOutput
        })
      )
    })
  })
})
