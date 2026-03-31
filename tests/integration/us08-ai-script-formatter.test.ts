/**
 * Integration Test: US-08 — AI Script Formatter Workflow
 *
 * As a user, when I navigate to /ai-tools/script-formatter, I can progress
 * through the multi-step workflow: upload → select-model → processing → review
 * → download. The workflow persists state in localStorage so it survives
 * page refreshes.
 *
 * Tests the useScriptWorkflow hook from
 * src/features/AITools/ScriptFormatter/hooks/useScriptWorkflow.ts.
 * Mocking strategy: mock all sub-hooks so workflow orchestration can be tested
 * in isolation. No direct @tauri-apps imports.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be
 * restored in beforeEach.
 */

import { useScriptWorkflow } from '../../src/features/AITools/ScriptFormatter/hooks/useScriptWorkflow'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// vi.hoisted() — declare mock functions before vi.mock() hoisting runs
// ============================================================================

const {
  mockUploadReset,
  mockProcessingReset,
  mockProcessingHandleFormatScript,
  mockProcessingLoadOutput,
  mockReviewReset,
  mockReviewLoadOutput
} = vi.hoisted(() => ({
  mockUploadReset: vi.fn(),
  mockProcessingReset: vi.fn(),
  mockProcessingHandleFormatScript: vi.fn(),
  mockProcessingLoadOutput: vi.fn(),
  mockReviewReset: vi.fn(),
  mockReviewLoadOutput: vi.fn()
}))

// ============================================================================
// Sub-hook mocks — all delegated hooks are replaced with controllable stubs
// ============================================================================

vi.mock('../../src/features/AITools/ScriptFormatter/hooks/useScriptUpload', () => ({
  useScriptUpload: vi.fn().mockReturnValue({
    document: null,
    isParsing: false,
    parseError: null,
    handleFileSelect: vi.fn(),
    reset: mockUploadReset
  })
}))

vi.mock('../../src/features/AITools/ScriptFormatter/hooks/useAIProcessing', () => ({
  useAIProcessing: vi.fn().mockReturnValue({
    selectedModelId: null,
    isProcessing: false,
    processedOutput: null,
    progress: 0,
    ragStatus: 'idle',
    examplesCount: 0,
    enabledExampleIds: [],
    isValidatingProvider: false,
    isLoadingModels: false,
    isLoadingExamples: false,
    isEmbeddingLoading: false,
    isEmbeddingReady: false,
    processingError: null,
    embeddingError: null,
    models: [],
    allExamples: [],
    activeProvider: null,
    availableProviders: [],
    setSelectedModelId: vi.fn(),
    handleProviderValidate: vi.fn(),
    handleFormatScript: mockProcessingHandleFormatScript,
    handleExampleToggle: vi.fn(),
    switchProvider: vi.fn(),
    cancelProcessing: vi.fn(),
    reset: mockProcessingReset,
    loadOutput: mockProcessingLoadOutput
  })
}))

vi.mock('../../src/features/AITools/ScriptFormatter/hooks/useScriptReview', () => ({
  useScriptReview: vi.fn().mockReturnValue({
    modifiedText: '',
    markdownText: '',
    hasChanges: false,
    hasUnsavedChanges: false,
    editHistory: [],
    canUndo: false,
    canRedo: false,
    handleChange: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    markAsSaved: vi.fn(),
    getUpdatedOutput: vi.fn(),
    loadOutput: mockReviewLoadOutput,
    reset: mockReviewReset
  })
}))

vi.mock('../../src/features/AITools/ScriptFormatter/hooks/useScriptDownload', () => ({
  useScriptDownload: vi.fn().mockReturnValue({
    isGenerating: false,
    generateError: null,
    handleDownload: vi.fn()
  })
}))

// ============================================================================
// localStorage keys (matches useScriptWorkflow implementation)
// ============================================================================

const STORAGE_KEY = 'script-workflow-session'
const PROCESSED_OUTPUT_KEY = 'PROCESSED_OUTPUT'

// ============================================================================
// US-08: Script Formatter Workflow — step navigation and localStorage persistence
// ============================================================================

describe('US-08 — AI Script Formatter: Workflow Navigation', () => {
  beforeEach(async () => {
    localStorage.clear()

    // mockReset: true clears vi.fn() implementations — restore sub-hook mocks
    const { useScriptUpload } = await import(
      '../../src/features/AITools/ScriptFormatter/hooks/useScriptUpload'
    )
    const { useAIProcessing } = await import(
      '../../src/features/AITools/ScriptFormatter/hooks/useAIProcessing'
    )
    const { useScriptReview } = await import(
      '../../src/features/AITools/ScriptFormatter/hooks/useScriptReview'
    )
    const { useScriptDownload } = await import(
      '../../src/features/AITools/ScriptFormatter/hooks/useScriptDownload'
    )

    vi.mocked(useScriptUpload).mockReturnValue({
      document: null,
      isParsing: false,
      parseError: null,
      handleFileSelect: vi.fn(),
      reset: mockUploadReset
    })

    vi.mocked(useAIProcessing).mockReturnValue({
      selectedModelId: null,
      isProcessing: false,
      processedOutput: null,
      progress: 0,
      ragStatus: 'idle',
      examplesCount: 0,
      enabledExampleIds: [],
      isValidatingProvider: false,
      isLoadingModels: false,
      isLoadingExamples: false,
      isEmbeddingLoading: false,
      isEmbeddingReady: false,
      processingError: null,
      embeddingError: null,
      models: [],
      allExamples: [],
      activeProvider: null,
      availableProviders: [],
      setSelectedModelId: vi.fn(),
      handleProviderValidate: vi.fn(),
      handleFormatScript: mockProcessingHandleFormatScript,
      handleExampleToggle: vi.fn(),
      switchProvider: vi.fn(),
      cancelProcessing: vi.fn(),
      reset: mockProcessingReset,
      loadOutput: mockProcessingLoadOutput
    } as any)

    vi.mocked(useScriptReview).mockReturnValue({
      modifiedText: '',
      markdownText: '',
      hasChanges: false,
      hasUnsavedChanges: false,
      editHistory: [],
      canUndo: false,
      canRedo: false,
      handleChange: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      markAsSaved: vi.fn(),
      getUpdatedOutput: vi.fn(),
      loadOutput: mockReviewLoadOutput,
      reset: mockReviewReset
    } as any)

    vi.mocked(useScriptDownload).mockReturnValue({
      isGenerating: false,
      generateError: null,
      handleDownload: vi.fn()
    } as any)
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ---- Initial step resolution ----

  it('US-08a — should default to upload step when no session is saved', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    expect(result.current.currentStep).toBe('upload')
  })

  it('US-08b — should restore to review step when PROCESSED_OUTPUT key exists', () => {
    // Pre-seed the legacy processed output key
    localStorage.setItem(
      PROCESSED_OUTPUT_KEY,
      JSON.stringify({ title: 'My Script', sections: [] })
    )

    const { result } = renderHook(() => useScriptWorkflow())

    expect(result.current.currentStep).toBe('review')
  })

  it('US-08c — should restore currentStep from script-workflow-session', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentStep: 'select-model', processedOutput: null })
    )

    const { result } = renderHook(() => useScriptWorkflow())

    expect(result.current.currentStep).toBe('select-model')
  })

  it('US-08d — should restore processing step from session', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentStep: 'processing', processedOutput: null })
    )

    const { result } = renderHook(() => useScriptWorkflow())

    expect(result.current.currentStep).toBe('processing')
  })

  it('US-08e — should prefer PROCESSED_OUTPUT key over session when both exist', () => {
    // PROCESSED_OUTPUT key is checked first in getInitialStep()
    localStorage.setItem(PROCESSED_OUTPUT_KEY, JSON.stringify({ sections: [] }))
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentStep: 'select-model', processedOutput: null })
    )

    const { result } = renderHook(() => useScriptWorkflow())

    expect(result.current.currentStep).toBe('review')
  })

  // ---- Step navigation ----

  it('US-08f — should navigate to a target step via goToStep()', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.goToStep('select-model')
    })

    expect(result.current.currentStep).toBe('select-model')
  })

  it('US-08g — should navigate through all workflow steps in order', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    const steps = ['select-model', 'processing', 'review', 'download'] as const
    for (const step of steps) {
      act(() => {
        result.current.goToStep(step)
      })
      expect(result.current.currentStep).toBe(step)
    }
  })

  // ---- localStorage persistence ----

  it('US-08h — should save session to localStorage on step change', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.goToStep('select-model')
    })

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(saved.currentStep).toBe('select-model')
  })

  it('US-08i — should clear PROCESSED_OUTPUT key when navigating to download step', () => {
    localStorage.setItem(PROCESSED_OUTPUT_KEY, JSON.stringify({ sections: [] }))

    // Start at review (PROCESSED_OUTPUT causes that), then go to download
    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.goToStep('download')
    })

    expect(localStorage.getItem(PROCESSED_OUTPUT_KEY)).toBeNull()
  })

  it('US-08j — should NOT clear PROCESSED_OUTPUT when navigating to review step', () => {
    localStorage.setItem(PROCESSED_OUTPUT_KEY, JSON.stringify({ sections: [] }))

    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.goToStep('review')
    })

    // PROCESSED_OUTPUT should still be there (only cleared on download)
    expect(localStorage.getItem(PROCESSED_OUTPUT_KEY)).not.toBeNull()
  })

  // ---- handleStartOver ----

  it('US-08k — should reset currentStep to upload on handleStartOver()', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentStep: 'review', processedOutput: null })
    )

    const { result } = renderHook(() => useScriptWorkflow())
    expect(result.current.currentStep).toBe('review')

    act(() => {
      result.current.handleStartOver()
    })

    expect(result.current.currentStep).toBe('upload')
  })

  it('US-08l — should reset session in localStorage to upload step on handleStartOver()', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentStep: 'processing', processedOutput: null })
    )

    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.handleStartOver()
    })

    // After handleStartOver(), the useEffect re-saves the session with the reset step.
    // The key should either be absent or contain currentStep: 'upload'.
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
      const parsed = JSON.parse(saved)
      expect(parsed.currentStep).toBe('upload')
    }
    // Either way, the step in memory is correct
    expect(result.current.currentStep).toBe('upload')
  })

  it('US-08m — should call reset() on all sub-hooks during handleStartOver()', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    act(() => {
      result.current.handleStartOver()
    })

    expect(mockUploadReset).toHaveBeenCalled()
    expect(mockProcessingReset).toHaveBeenCalled()
    expect(mockReviewReset).toHaveBeenCalled()
  })

  // ---- Interface shape ----

  it('US-08n — should expose all required interface properties', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    // Navigation
    expect(typeof result.current.goToStep).toBe('function')
    expect(typeof result.current.handleStartOver).toBe('function')
    expect(typeof result.current.handleFormatScript).toBe('function')

    // File upload
    expect(typeof result.current.handleFileSelect).toBe('function')
    expect(typeof result.current.isParsing).toBe('boolean')

    // AI processing
    expect(typeof result.current.isProcessing).toBe('boolean')

    // Review
    expect(typeof result.current.handleChange).toBe('function')

    // Download
    expect(typeof result.current.handleDownload).toBe('function')
    expect(typeof result.current.isGenerating).toBe('boolean')

    // Step validation
    expect(typeof result.current.canAdvanceToSelectModel).toBe('boolean')
    expect(typeof result.current.canStartProcessing).toBe('boolean')
    expect(typeof result.current.canAdvanceToReview).toBe('boolean')

    // Busy state
    expect(typeof result.current.isBusy).toBe('boolean')
  })

  it('US-08o — should have canAdvanceToSelectModel=false when document is null', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    // document is null from the mocked useScriptUpload
    expect(result.current.canAdvanceToSelectModel).toBe(false)
  })

  it('US-08p — should have isBusy=false when all sub-hooks report idle', () => {
    const { result } = renderHook(() => useScriptWorkflow())

    // All sub-hooks mocked to idle state
    expect(result.current.isBusy).toBe(false)
  })
})
