/**
 * useScriptWorkflow Hook
 * Orchestrates the complete script formatting workflow
 *
 * Responsibilities:
 * - Workflow step navigation (upload → select-model → processing → review → download)
 * - Integration of all sub-hooks
 * - Global state coordination
 * - Session persistence (localStorage)
 * - Navigation warnings for unsaved work
 */

import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ProcessedOutput, WorkflowStep } from '@/types/scriptFormatter'
import { logger } from '@/utils/logger'

import { useAIProcessing } from './useAIProcessing'
import { useScriptDownload } from './useScriptDownload'
import { useScriptReview } from './useScriptReview'
import { useScriptUpload } from './useScriptUpload'

const log = createNamespacedLogger('ScriptWorkflow')

const STORAGE_KEY = 'script-workflow-session'
const PROCESSED_OUTPUT_KEY = 'PROCESSED_OUTPUT'

interface WorkflowSession {
  currentStep: WorkflowStep
  processedOutput: ProcessedOutput | null
}

function getInitialStep(): WorkflowStep {
  try {
    // Check for processed output (legacy key)
    const processedOutputStr = localStorage.getItem(PROCESSED_OUTPUT_KEY)
    if (processedOutputStr) {
      try {
        JSON.parse(processedOutputStr) // Validate it's valid JSON
        return 'review'
      } catch {
        localStorage.removeItem(PROCESSED_OUTPUT_KEY)
      }
    }

    // Check for full session
    const savedSession = localStorage.getItem(STORAGE_KEY)
    if (savedSession) {
      const session: WorkflowSession = JSON.parse(savedSession)
      return session.currentStep
    }
  } catch (error) {
    logger.error('Failed to get initial step:', (error as Error).message)
  }

  return 'upload'
}

export function useScriptWorkflow() {
  // State - Initialize from localStorage
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(getInitialStep)

  // Sub-hooks
  const uploadHook = useScriptUpload({
    onSuccess: (document) => {
      log.info('File uploaded successfully:', document.filename)
      // Automatically advance to model selection step
      setCurrentStep('select-model')
    },
    onError: (error) => {
      logger.error('File upload failed:', error.message)
    }
  })

  const processingHook = useAIProcessing({
    onSuccess: (output) => {
      log.info('Script processing completed')
      reviewHook.loadOutput(output)
      goToStep('review')
    },
    onError: (error) => {
      logger.error('Script processing failed:', error.message)
    }
  })

  const reviewHook = useScriptReview({
    initialOutput: processingHook.processedOutput,
    onChange: (text) => {
      log.debug('Script text modified, length:', text.length)
    }
  })

  const downloadHook = useScriptDownload({
    onSuccess: () => {
      log.info('File downloaded successfully')
    },
    onError: (error) => {
      logger.error('File download failed:', error.message)
    }
  })

  // Validation rules
  const canAdvanceToSelectModel = useMemo(
    () => uploadHook.document !== null,
    [uploadHook.document]
  )

  const canStartProcessing = useMemo(
    () =>
      uploadHook.document !== null &&
      processingHook.selectedModelId !== null &&
      processingHook.activeProvider !== null,
    [uploadHook.document, processingHook.selectedModelId, processingHook.activeProvider]
  )

  const canAdvanceToReview = useMemo(
    () => processingHook.processedOutput !== null,
    [processingHook.processedOutput]
  )

  // Busy state aggregation
  const isBusy = useMemo(
    () =>
      uploadHook.isParsing ||
      processingHook.isProcessing ||
      downloadHook.isGenerating ||
      processingHook.isValidatingProvider,
    [
      uploadHook.isParsing,
      processingHook.isProcessing,
      downloadHook.isGenerating,
      processingHook.isValidatingProvider
    ]
  )

  // Session persistence - restore processed output on mount if needed
  useEffect(() => {
    if (currentStep === 'review') {
      try {
        // Check for processed output (legacy key)
        const processedOutputStr = localStorage.getItem(PROCESSED_OUTPUT_KEY)
        if (processedOutputStr && processingHook.processedOutput === null) {
          const processedOutput: ProcessedOutput = JSON.parse(processedOutputStr)
          log.debug('Restored processed output from localStorage')
          reviewHook.loadOutput(processedOutput)
        }

        // Check for full session
        const savedSession = localStorage.getItem(STORAGE_KEY)
        if (savedSession && processingHook.processedOutput === null) {
          const session: WorkflowSession = JSON.parse(savedSession)
          if (session.processedOutput) {
            reviewHook.loadOutput(session.processedOutput)
          }
        }
      } catch (error) {
        logger.error('Failed to restore processed output:', (error as Error).message)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Session persistence - save to localStorage on state changes
  useEffect(() => {
    try {
      const session: WorkflowSession = {
        currentStep,
        processedOutput: processingHook.processedOutput
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      log.debug('Saved session to localStorage')
    } catch (error) {
      logger.error('Failed to save session:', (error as Error).message)
    }
  }, [currentStep, processingHook.processedOutput])

  // Navigation
  const goToStep = useCallback((step: WorkflowStep) => {
    log.info('Navigating to step:', step)
    setCurrentStep(step)

    // Clear processed output cache when going to download step
    if (step === 'download') {
      try {
        localStorage.removeItem(PROCESSED_OUTPUT_KEY)
        log.debug('Cleared PROCESSED_OUTPUT from localStorage')
      } catch (error) {
        logger.error('Failed to clear PROCESSED_OUTPUT:', (error as Error).message)
      }
    }
  }, [])

  const handleStartOver = useCallback(() => {
    log.info('Starting over - resetting all hooks')

    // Reset all hooks
    uploadHook.reset()
    processingHook.reset()
    reviewHook.reset()

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY)
      log.debug('Cleared session from localStorage')
    } catch (error) {
      logger.error('Failed to clear session:', (error as Error).message)
    }

    // Go back to upload step
    setCurrentStep('upload')
  }, [uploadHook, processingHook, reviewHook])

  // Wrapper for handleFormatScript that provides the document text automatically
  const handleFormatScript = useCallback(() => {
    if (!uploadHook.document?.textContent) {
      log.warn('Cannot format script: no document text available')
      return
    }
    log.info('Starting format script with document text')
    setCurrentStep('processing')
    processingHook.handleFormatScript(uploadHook.document.textContent)
  }, [uploadHook.document, processingHook])

  return {
    // Current state
    currentStep,

    // Step validation
    canAdvanceToSelectModel,
    canStartProcessing,
    canAdvanceToReview,

    // Navigation
    goToStep,
    handleStartOver,

    // Upload hook state
    document: uploadHook.document,
    isParsing: uploadHook.isParsing,
    parseError: uploadHook.parseError,
    handleFileSelect: uploadHook.handleFileSelect,

    // AI Processing hook state
    selectedModelId: processingHook.selectedModelId,
    isProcessing: processingHook.isProcessing,
    processedOutput: processingHook.processedOutput,
    progress: processingHook.progress,
    ragStatus: processingHook.ragStatus,
    examplesCount: processingHook.examplesCount,
    enabledExampleIds: processingHook.enabledExampleIds,
    isValidatingProvider: processingHook.isValidatingProvider,
    isLoadingModels: processingHook.isLoadingModels,
    isLoadingExamples: processingHook.isLoadingExamples,
    isEmbeddingLoading: processingHook.isEmbeddingLoading,
    isEmbeddingReady: processingHook.isEmbeddingReady,
    processingError: processingHook.processingError,
    embeddingError: processingHook.embeddingError,
    models: processingHook.models,
    allExamples: processingHook.allExamples,
    activeProvider: processingHook.activeProvider,
    availableProviders: processingHook.availableProviders,
    setSelectedModelId: processingHook.setSelectedModelId,
    handleProviderValidate: processingHook.handleProviderValidate,
    handleFormatScript,
    handleExampleToggle: processingHook.handleExampleToggle,
    switchProvider: processingHook.switchProvider,
    cancelProcessing: processingHook.cancelProcessing,

    // Review hook state
    modifiedText: reviewHook.modifiedText,
    markdownText: reviewHook.markdownText,
    hasChanges: reviewHook.hasChanges,
    hasUnsavedChanges: reviewHook.hasUnsavedChanges,
    editHistory: reviewHook.editHistory,
    canUndo: reviewHook.canUndo,
    canRedo: reviewHook.canRedo,
    handleChange: reviewHook.handleChange,
    undo: reviewHook.undo,
    redo: reviewHook.redo,
    markAsSaved: reviewHook.markAsSaved,
    getUpdatedOutput: reviewHook.getUpdatedOutput,

    // Download hook state
    isGenerating: downloadHook.isGenerating,
    generateError: downloadHook.generateError,
    handleDownload: downloadHook.handleDownload,

    // Aggregated states
    isBusy
  }
}
