/**
 * Tests for useScriptFormatterState Hook
 * TDD Methodology: RED → GREEN → REFACTOR
 * Phase: RED (Write failing tests)
 *
 * This hook is a composition wrapper around useScriptWorkflow + useExampleManagement
 * It adds UI-specific state (showSaveDialog) and save-as-example functionality.
 */

import { useExampleManagement } from '@/hooks/useExampleManagement'
import { useScriptFormatterState } from '@/hooks/useScriptFormatterState'
import { useScriptWorkflow } from '@/hooks/useScriptWorkflow'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the composed hooks
vi.mock('@/hooks/useScriptWorkflow', () => ({
  useScriptWorkflow: vi.fn()
}))

vi.mock('@/hooks/useExampleManagement', () => ({
  useExampleManagement: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  createNamespacedLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('useScriptFormatterState', () => {
  let queryClient: QueryClient
  const mockWorkflowState = {
    // Workflow state
    currentStep: 'upload' as const,
    document: null,
    selectedModelId: null,
    isProcessing: false,
    processedOutput: null,
    modifiedText: '',
    markdownText: '',
    progress: 0,
    ragStatus: 'idle' as const,
    examplesCount: 0,
    enabledExampleIds: [],
    hasChanges: false,
    hasUnsavedChanges: false,
    editHistory: [],
    canUndo: false,
    canRedo: false,

    // Validation state
    canAdvanceToSelectModel: false,
    canStartProcessing: false,
    canAdvanceToReview: false,

    // Loading states
    isParsing: false,
    isValidatingProvider: false,
    isLoadingModels: false,
    isLoadingExamples: false,
    isEmbeddingLoading: false,
    isEmbeddingReady: false,
    isGenerating: false,
    isBusy: false,

    // Error states
    parseError: null,
    processingError: null,
    embeddingError: null,
    generateError: null,

    // Data
    models: [],
    allExamples: [],
    activeProvider: 'ollama' as const,
    availableProviders: ['ollama'],

    // Actions
    goToStep: vi.fn(),
    handleFileSelect: vi.fn(),
    setSelectedModelId: vi.fn(),
    handleProviderValidate: vi.fn(),
    handleFormatScript: vi.fn(),
    handleExampleToggle: vi.fn(),
    switchProvider: vi.fn(),
    cancelProcessing: vi.fn(),
    handleStartOver: vi.fn(),
    handleChange: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    markAsSaved: vi.fn(),
    handleDownload: vi.fn()
  }

  const mockExampleManagement = {
    uploadMutation: {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null
    },
    replaceMutation: {
      mutateAsync: vi.fn(),
      isPending: false
    },
    deleteMutation: {
      mutateAsync: vi.fn(),
      isPending: false
    }
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
    vi.mocked(useScriptWorkflow).mockReturnValue(mockWorkflowState as any)
    vi.mocked(useExampleManagement).mockReturnValue(mockExampleManagement as any)
  })

  describe('Initialization', () => {
    test('T001: returns complete interface with workflow state', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Assert - Should have all workflow properties
      expect(result.current.currentStep).toBe('upload')
      expect(result.current.document).toBeNull()
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.showSaveDialog).toBe(false)
    })

    test('T002: initializes with showSaveDialog=false', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Assert
      expect(result.current.showSaveDialog).toBe(false)
    })

    test('T003: exposes all workflow actions', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Assert
      expect(result.current.goToStep).toBeDefined()
      expect(result.current.handleFileSelect).toBeDefined()
      expect(result.current.setSelectedModelId).toBeDefined()
      expect(result.current.handleFormatScript).toBeDefined()
      expect(result.current.handleDownload).toBeDefined()
      expect(result.current.handleSaveAsExample).toBeDefined()
      expect(result.current.setShowSaveDialog).toBeDefined()
    })

    test('T004: exposes review actions (undo/redo)', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Assert
      expect(result.current.undo).toBeDefined()
      expect(result.current.redo).toBeDefined()
      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
    })
  })

  describe('showSaveDialog state management', () => {
    test('T005: toggles showSaveDialog to true', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      expect(result.current.showSaveDialog).toBe(false)

      // Act
      act(() => {
        result.current.setShowSaveDialog(true)
      })

      // Assert
      expect(result.current.showSaveDialog).toBe(true)
    })

    test('T006: toggles showSaveDialog to false', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      act(() => {
        result.current.setShowSaveDialog(true)
      })
      expect(result.current.showSaveDialog).toBe(true)

      // Act
      act(() => {
        result.current.setShowSaveDialog(false)
      })

      // Assert
      expect(result.current.showSaveDialog).toBe(false)
    })
  })

  describe('handleSaveAsExample', () => {
    test('T007: saves formatted text as example', async () => {
      // Arrange
      const mockDocument = { name: 'test.docx', content: [] }
      const mockModifiedText = 'Formatted script content'

      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: mockDocument,
        modifiedText: mockModifiedText
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act
      await act(async () => {
        await result.current.handleSaveAsExample('My Example', 'technical', 4)
      })

      // Assert
      expect(mockExampleManagement.uploadMutation.mutateAsync).toHaveBeenCalledWith({
        file: expect.any(File),
        title: 'My Example',
        category: 'technical',
        qualityScore: 4,
        source: 'uploaded'
      })
    })

    test('T008: creates File with correct name and content', async () => {
      // Arrange
      const mockModifiedText = 'Formatted script content'

      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { name: 'test.docx', content: [] },
        modifiedText: mockModifiedText
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act
      await act(async () => {
        await result.current.handleSaveAsExample('My Example', 'general', 3)
      })

      // Assert
      const callArgs = mockExampleManagement.uploadMutation.mutateAsync.mock.calls[0][0]
      expect(callArgs.file).toBeInstanceOf(File)
      expect(callArgs.file.name).toBe('My Example.txt')
      expect(callArgs.file.type).toBe('text/plain')

      // Verify file content using FileReader (compatible with test environment)
      const reader = new FileReader()
      const fileContentPromise = new Promise<string>(resolve => {
        reader.onload = () => resolve(reader.result as string)
      })
      reader.readAsText(callArgs.file)
      const fileContent = await fileContentPromise
      expect(fileContent).toBe(mockModifiedText)
    })

    test('T009: closes save dialog after successful save', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { name: 'test.docx', content: [] },
        modifiedText: 'Formatted text'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      act(() => {
        result.current.setShowSaveDialog(true)
      })
      expect(result.current.showSaveDialog).toBe(true)

      // Act
      await act(async () => {
        await result.current.handleSaveAsExample('Example', 'technical', 5)
      })

      // Assert
      expect(result.current.showSaveDialog).toBe(false)
    })

    test('T010: throws error if document is missing', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: null,
        modifiedText: 'Some text'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.handleSaveAsExample('Example', 'technical', 5)
        ).rejects.toThrow('Missing document or formatted text')
      })
    })

    test('T011: throws error if modifiedText is missing', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { name: 'test.docx', content: [] },
        modifiedText: ''
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.handleSaveAsExample('Example', 'technical', 5)
        ).rejects.toThrow('Missing document or formatted text')
      })
    })

    test('T012: supports all example categories', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { name: 'test.docx', content: [] },
        modifiedText: 'Content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      const categories: Array<'general' | 'technical' | 'narrative'> = [
        'general',
        'technical',
        'narrative'
      ]

      // Act & Assert
      for (const category of categories) {
        await act(async () => {
          await result.current.handleSaveAsExample(`Example ${category}`, category, 3)
        })

        expect(mockExampleManagement.uploadMutation.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            category
          })
        )
      }
    })

    test('T013: supports quality scores 1-5', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { name: 'test.docx', content: [] },
        modifiedText: 'Content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      const scores = [1, 2, 3, 4, 5]

      // Act & Assert
      for (const score of scores) {
        await act(async () => {
          await result.current.handleSaveAsExample('Example', 'general', score)
        })

        expect(mockExampleManagement.uploadMutation.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            qualityScore: score
          })
        )
      }
    })
  })

  describe('handleModifiedChange wrapper', () => {
    test('T014: delegates to workflow.handleChange', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      const newText = 'Updated script text'

      // Act
      act(() => {
        result.current.handleModifiedChange(newText)
      })

      // Assert
      expect(mockWorkflowState.handleChange).toHaveBeenCalledWith(newText)
    })

    test('T015: maintains backward compatibility', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Assert - Should expose handleModifiedChange (old name)
      expect(result.current.handleModifiedChange).toBeDefined()
      expect(typeof result.current.handleModifiedChange).toBe('function')
    })
  })

  describe('Integration with workflow', () => {
    test('T016: reflects workflow state changes', () => {
      // Arrange
      const { result, rerender } = renderHook(() => useScriptFormatterState(), {
        wrapper
      })

      expect(result.current.currentStep).toBe('upload')

      // Act - Simulate workflow state change
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        currentStep: 'review'
      } as any)

      rerender()

      // Assert
      expect(result.current.currentStep).toBe('review')
    })

    test('T017: forwards workflow actions correctly', () => {
      // Arrange
      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act
      act(() => {
        result.current.goToStep('review')
      })

      // Assert
      expect(mockWorkflowState.goToStep).toHaveBeenCalledWith('review')
    })
  })
})
