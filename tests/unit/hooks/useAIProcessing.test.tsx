/**
 * Unit Tests for useAIProcessing Hook
 * DEBT-001: Refactoring useScriptFormatterState - AI Processing Responsibility
 *
 * This hook manages:
 * - AI provider selection and validation
 * - Model selection
 * - Script processing with progress tracking
 * - RAG example management
 * - Processing error handling
 */

import type { ProcessedOutput, ProviderConfiguration } from '@/types/scriptFormatter'
import { useAIModels } from '@hooks/useAIModels'
import { useAIProcessing } from '@hooks/useAIProcessing'
import { useAIProvider } from '@hooks/useAIProvider'
import { useExampleManagement } from '@hooks/useExampleManagement'
import { useScriptProcessor } from '@hooks/useScriptProcessor'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('@hooks/useAIProvider', () => ({
  useAIProvider: vi.fn()
}))

vi.mock('@hooks/useAIModels', () => ({
  useAIModels: vi.fn()
}))

vi.mock('@hooks/useScriptProcessor', () => ({
  useScriptProcessor: vi.fn()
}))

vi.mock('@hooks/useExampleManagement', () => ({
  useExampleManagement: vi.fn()
}))

vi.mock('@utils/logger', () => ({
  createNamespacedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useAIProcessing', () => {
  const mockProvider = {
    id: 'openai',
    name: 'OpenAI',
    status: 'configured' as const,
    configuration: {
      serviceUrl: 'https://api.openai.com',
      connectionStatus: 'connected' as const
    }
  }

  const mockModels = [
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ]

  const mockExamples = [
    { id: 'ex1', title: 'Example 1', category: 'general' },
    { id: 'ex2', title: 'Example 2', category: 'technical' }
  ]

  const mockProcessedOutput: ProcessedOutput = {
    formattedText: 'Formatted script content',
    generationTimestamp: new Date(),
    examplesCount: 2,
    editHistory: [],
    isEdited: false
  }

  const mockProcessScript = vi.fn()
  const mockCancelProcessing = vi.fn()
  const mockValidateProvider = vi.fn()
  const mockSwitchProvider = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAIProvider as any).mockReturnValue({
      activeProvider: mockProvider,
      availableProviders: [mockProvider],
      validateProvider: mockValidateProvider,
      switchProvider: mockSwitchProvider
    })

    // Default: no models loaded yet (most tests will override this)
    ;(useAIModels as any).mockReturnValue({
      models: [],
      isLoading: false
    })
    ;(useScriptProcessor as any).mockReturnValue({
      processScript: mockProcessScript,
      cancel: mockCancelProcessing,
      error: null,
      isEmbeddingReady: true,
      isEmbeddingLoading: false,
      embeddingError: null
    })
    ;(useExampleManagement as any).mockReturnValue({
      examples: mockExamples,
      isLoading: false
    })
  })

  describe('Initial State', () => {
    it('should initialize with no selected model', () => {
      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.selectedModelId).toBeNull()
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.processedOutput).toBeNull()
    })

    it('should expose active provider from useAIProvider', () => {
      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.activeProvider).toEqual(mockProvider)
    })

    it('should expose available models', () => {
      ;(useAIModels as any).mockReturnValue({
        models: mockModels,
        isLoading: false
      })

      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.models).toEqual(mockModels)
    })

    it('should initialize with all examples enabled', () => {
      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.enabledExampleIds.size).toBe(mockExamples.length)
      expect(result.current.enabledExampleIds.has('ex1')).toBe(true)
      expect(result.current.enabledExampleIds.has('ex2')).toBe(true)
    })
  })

  describe('Model Selection', () => {
    it('should allow setting selected model', () => {
      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      expect(result.current.selectedModelId).toBe('gpt-4')
    })

    it('should auto-select first model when models become available', async () => {
      ;(useAIModels as any).mockReturnValue({
        models: [],
        isLoading: true
      })

      const { result, rerender } = renderHook(() => useAIProcessing())

      expect(result.current.selectedModelId).toBeNull()

      // Simulate models loaded
      ;(useAIModels as any).mockReturnValue({
        models: mockModels,
        isLoading: false
      })

      rerender()

      await waitFor(() => {
        expect(result.current.selectedModelId).toBe('gpt-4')
      })
    })

    it('should not auto-select if model already selected', () => {
      const { result, rerender } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-3.5-turbo')
      })
      ;(useAIModels as any).mockReturnValue({
        models: [...mockModels, { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }],
        isLoading: false
      })

      rerender()

      expect(result.current.selectedModelId).toBe('gpt-3.5-turbo')
    })
  })

  describe('Provider Validation', () => {
    it('should validate provider with configuration', async () => {
      const { result } = renderHook(() => useAIProcessing())

      const config: ProviderConfiguration = {
        serviceUrl: 'https://api.openai.com',
        connectionStatus: 'not-configured'
      }

      await act(async () => {
        await result.current.handleProviderValidate('openai', config)
      })

      expect(mockValidateProvider).toHaveBeenCalledWith('openai', config)
    })

    it('should set validating state during validation', async () => {
      let resolveValidation: () => void
      const validationPromise = new Promise<void>(resolve => {
        resolveValidation = resolve
      })

      mockValidateProvider.mockReturnValue(validationPromise)

      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.isValidatingProvider).toBe(false)

      // Start validation without awaiting
      act(() => {
        result.current.handleProviderValidate('openai', mockProvider.configuration)
      })

      // Check that validating state is set to true
      await waitFor(() => {
        expect(result.current.isValidatingProvider).toBe(true)
      })

      // Resolve the validation and wait for state to update
      await act(async () => {
        resolveValidation!()
        await validationPromise
      })

      expect(result.current.isValidatingProvider).toBe(false)
    })
  })

  describe('Script Processing - Happy Path', () => {
    it('should process script with selected model and provider', async () => {
      mockProcessScript.mockResolvedValue(mockProcessedOutput)

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      expect(mockProcessScript).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test script content',
          modelId: 'gpt-4',
          providerId: 'openai',
          configuration: mockProvider.configuration
        })
      )
    })

    it('should track progress during processing', async () => {
      const progressUpdates: number[] = []
      mockProcessScript.mockImplementation(async ({ onProgress }) => {
        onProgress(25)
        onProgress(50)
        onProgress(75)
        onProgress(100)
        return mockProcessedOutput
      })

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      let processingStarted = false
      act(() => {
        result.current.handleFormatScript('Test script content').then(() => {
          processingStarted = true
        })
      })

      await waitFor(() => processingStarted)

      expect(result.current.progress).toBe(100)
    })

    it('should update RAG status during processing', async () => {
      mockProcessScript.mockImplementation(async ({ onRAGUpdate }) => {
        onRAGUpdate('Finding examples...', 0)
        onRAGUpdate('Processing examples...', 2)
        onRAGUpdate('Complete', 2)
        return mockProcessedOutput
      })

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      expect(result.current.ragStatus).toBe('Complete')
      expect(result.current.examplesCount).toBe(2)
    })

    it('should set processed output on success', async () => {
      mockProcessScript.mockResolvedValue(mockProcessedOutput)

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(result.current.processedOutput).toEqual(mockProcessedOutput)
      })
    })

    it('should call onSuccess callback after processing', async () => {
      mockProcessScript.mockResolvedValue(mockProcessedOutput)
      const onSuccess = vi.fn()

      const { result } = renderHook(() => useAIProcessing({ onSuccess }))

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockProcessedOutput)
      })
    })
  })

  describe('Script Processing - Error Handling', () => {
    it('should not process without selected model', async () => {
      const { result } = renderHook(() => useAIProcessing())

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      expect(mockProcessScript).not.toHaveBeenCalled()
    })

    it('should not process without active provider', async () => {
      ;(useAIProvider as any).mockReturnValue({
        activeProvider: null,
        availableProviders: [],
        validateProvider: mockValidateProvider,
        switchProvider: mockSwitchProvider
      })

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      expect(mockProcessScript).not.toHaveBeenCalled()
    })

    it('should handle processing errors gracefully', async () => {
      const processingError = new Error('AI API failed')
      mockProcessScript.mockRejectedValue(processingError)

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(result.current.processedOutput).toBeNull()
        expect(result.current.progress).toBe(0)
      })
    })

    it('should call onError callback when processing fails', async () => {
      const processingError = new Error('AI API failed')
      mockProcessScript.mockRejectedValue(processingError)
      const onError = vi.fn()

      const { result } = renderHook(() => useAIProcessing({ onError }))

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error))
      })
    })

    it('should reset progress on error', async () => {
      mockProcessScript.mockImplementation(async ({ onProgress }) => {
        onProgress(50)
        throw new Error('Processing failed')
      })

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(result.current.progress).toBe(0)
      })
    })
  })

  describe('Example Management', () => {
    it('should toggle example enabled state', () => {
      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.enabledExampleIds.has('ex1')).toBe(true)

      act(() => {
        result.current.handleExampleToggle('ex1')
      })

      expect(result.current.enabledExampleIds.has('ex1')).toBe(false)

      act(() => {
        result.current.handleExampleToggle('ex1')
      })

      expect(result.current.enabledExampleIds.has('ex1')).toBe(true)
    })

    it('should pass enabled examples to processScript', async () => {
      mockProcessScript.mockResolvedValue(mockProcessedOutput)

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
        result.current.handleExampleToggle('ex2') // Disable ex2
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      expect(mockProcessScript).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledExampleIds: expect.any(Set)
        })
      )

      const call = mockProcessScript.mock.calls[0][0]
      expect(call.enabledExampleIds.has('ex1')).toBe(true)
      expect(call.enabledExampleIds.has('ex2')).toBe(false)
    })
  })

  describe('Processing Cancellation', () => {
    it('should expose cancel processing function', () => {
      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.cancelProcessing).toBeDefined()
      expect(typeof result.current.cancelProcessing).toBe('function')
    })

    it('should call cancel from useScriptProcessor', () => {
      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.cancelProcessing()
      })

      expect(mockCancelProcessing).toHaveBeenCalled()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all processing state', async () => {
      mockProcessScript.mockResolvedValue(mockProcessedOutput)

      const { result } = renderHook(() => useAIProcessing())

      act(() => {
        result.current.setSelectedModelId('gpt-4')
      })

      await act(async () => {
        await result.current.handleFormatScript('Test script content')
      })

      await waitFor(() => {
        expect(result.current.processedOutput).not.toBeNull()
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.selectedModelId).toBeNull()
      expect(result.current.processedOutput).toBeNull()
      expect(result.current.progress).toBe(0)
      expect(result.current.ragStatus).toBe('')
      expect(result.current.examplesCount).toBe(0)
    })
  })

  describe('Loading States', () => {
    it('should reflect models loading state', () => {
      ;(useAIModels as any).mockReturnValue({
        models: [],
        isLoading: true
      })

      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.isLoadingModels).toBe(true)
    })

    it('should reflect examples loading state', () => {
      ;(useExampleManagement as any).mockReturnValue({
        examples: [],
        isLoading: true
      })

      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.isLoadingExamples).toBe(true)
    })

    it('should reflect embedding loading state', () => {
      ;(useScriptProcessor as any).mockReturnValue({
        processScript: mockProcessScript,
        cancel: mockCancelProcessing,
        error: null,
        isEmbeddingReady: false,
        isEmbeddingLoading: true,
        embeddingError: null
      })

      const { result } = renderHook(() => useAIProcessing())

      expect(result.current.isEmbeddingLoading).toBe(true)
      expect(result.current.isEmbeddingReady).toBe(false)
    })
  })
})
