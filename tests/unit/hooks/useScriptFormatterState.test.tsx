/**
 * Tests for useScriptFormatterState Hook
 * TDD Methodology: RED → GREEN → REFACTOR
 * Phase: RED (Write failing tests)
 *
 * This hook is a composition wrapper around useScriptWorkflow + useExampleManagement
 * It adds UI-specific state (showSaveDialog) and save-as-example functionality.
 */

import { useExampleManagement } from '@features/AITools/ExampleEmbeddings/hooks/useExampleManagement'
import { useScriptFormatterState } from '@features/AITools/ScriptFormatter/hooks/useScriptFormatterState'
import { useOllamaEmbedding } from '@features/AITools/ScriptFormatter/hooks/useOllamaEmbedding'
import { useScriptWorkflow } from '@features/AITools/ScriptFormatter/hooks/useScriptWorkflow'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ExampleCategory } from '@shared/types'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the composed hooks
vi.mock('@features/AITools/ScriptFormatter/hooks/useScriptWorkflow', () => ({
  useScriptWorkflow: vi.fn()
}))

vi.mock('@features/AITools/ExampleEmbeddings/hooks/useExampleManagement', () => ({
  useExampleManagement: vi.fn()
}))

vi.mock('@features/AITools/ScriptFormatter/hooks/useOllamaEmbedding', () => ({
  useOllamaEmbedding: vi.fn()
}))

vi.mock('@shared/utils/logger', () => ({
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

  // Names match useExampleManagement's real return. They previously did not
  // (uploadMutation / replaceMutation / deleteMutation), so these tests passed
  // against a hook shape that has never existed and the production code's
  // `uploadMutation` -- undefined at runtime -- went unnoticed (#178).
  const mockExampleManagement = {
    uploadExample: {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null
    },
    replaceExample: {
      mutateAsync: vi.fn(),
      isPending: false
    },
    deleteExample: {
      mutateAsync: vi.fn(),
      isPending: false
    }
  }

  const EMBEDDING = [0.1, 0.2, 0.3]
  const mockEmbedding = {
    embed: vi.fn(async () => EMBEDDING),
    isReady: true,
    isLoading: false,
    error: null,
    modelName: 'nomic-embed-text'
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
    mockEmbedding.embed.mockResolvedValue(EMBEDDING)
    vi.mocked(useOllamaEmbedding).mockReturnValue(mockEmbedding as any)
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
      const mockDocument = { filename: 'test.docx', textContent: 'Raw script' }
      const mockModifiedText = 'Formatted script content'

      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: mockDocument,
        modifiedText: mockModifiedText
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act
      await act(async () => {
        await result.current.handleSaveAsExample('My Example', ExampleCategory.EDUCATIONAL, 4)
      })

      // Assert - the UploadRequest shape the Tauri command actually accepts
      expect(mockExampleManagement.uploadExample.mutateAsync).toHaveBeenCalledWith({
        beforeContent: 'Raw script',
        afterContent: mockModifiedText,
        metadata: {
          title: 'My Example',
          category: ExampleCategory.EDUCATIONAL,
          qualityScore: 4
        },
        embedding: EMBEDDING
      })
    })

    test('T008: embeds the unformatted script, not the reviewed text', async () => {
      // The example is retrieved by similarity to a *new* unformatted script,
      // so the embedding has to come from beforeContent.
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: 'Formatted script content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      await act(async () => {
        await result.current.handleSaveAsExample('My Example', ExampleCategory.BUSINESS, 3)
      })

      expect(mockEmbedding.embed).toHaveBeenCalledWith('Raw script')
    })

    test('T008b: rejects when the embedding comes back empty', async () => {
      mockEmbedding.embed.mockResolvedValue([])

      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: 'Formatted script content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      await act(async () => {
        await expect(
          result.current.handleSaveAsExample('My Example', ExampleCategory.BUSINESS, 3)
        ).rejects.toThrow('Failed to generate embedding')
      })

      expect(mockExampleManagement.uploadExample.mutateAsync).not.toHaveBeenCalled()
    })

    test('T009: closes save dialog after successful save', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: 'Formatted text'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      act(() => {
        result.current.setShowSaveDialog(true)
      })
      expect(result.current.showSaveDialog).toBe(true)

      // Act
      await act(async () => {
        await result.current.handleSaveAsExample('Example', ExampleCategory.EDUCATIONAL, 5)
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
          result.current.handleSaveAsExample('Example', ExampleCategory.EDUCATIONAL, 5)
        ).rejects.toThrow('Missing document or formatted text')
      })
    })

    test('T011: throws error if modifiedText is missing', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: ''
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.handleSaveAsExample('Example', ExampleCategory.EDUCATIONAL, 5)
        ).rejects.toThrow('Missing document or formatted text')
      })
    })

    test('T012: supports all example categories', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: 'Content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      const categories = [
        ExampleCategory.BUSINESS,
        ExampleCategory.EDUCATIONAL,
        ExampleCategory.NARRATIVE
      ]

      // Act & Assert
      for (const category of categories) {
        await act(async () => {
          await result.current.handleSaveAsExample(`Example ${category}`, category, 3)
        })

        expect(mockExampleManagement.uploadExample.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({ category })
          })
        )
      }
    })

    test('T013: supports quality scores 1-5', async () => {
      // Arrange
      vi.mocked(useScriptWorkflow).mockReturnValue({
        ...mockWorkflowState,
        document: { filename: 'test.docx', textContent: 'Raw script' },
        modifiedText: 'Content'
      } as any)

      const { result } = renderHook(() => useScriptFormatterState(), { wrapper })
      const scores = [1, 2, 3, 4, 5]

      // Act & Assert
      for (const score of scores) {
        await act(async () => {
          await result.current.handleSaveAsExample('Example', ExampleCategory.BUSINESS, score)
        })

        expect(mockExampleManagement.uploadExample.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({ qualityScore: score })
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
