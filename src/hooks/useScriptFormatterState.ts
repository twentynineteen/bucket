/**
 * useScriptFormatterState Hook
 * Purpose: Manages all state and handlers for the ScriptFormatter workflow
 *
 * REFACTORED (DEBT-001): Now uses composition of focused hooks
 * - useScriptWorkflow: Orchestrates the complete workflow
 * - Additional UI-specific state (save dialog)
 * - Additional feature: Save formatted text as example for RAG
 */

import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useState } from 'react'

import { ExampleCategory } from '@/types/exampleEmbeddings'

import { useExampleManagement } from './useExampleManagement'
import { useScriptWorkflow } from './useScriptWorkflow'

const log = createNamespacedLogger('ScriptFormatterState')

// Re-export WorkflowStep type for backward compatibility
export type { WorkflowStep } from '@/types/scriptFormatter'

export function useScriptFormatterState() {
  // Use the new orchestration hook
  const workflow = useScriptWorkflow()

  // Additional UI state not managed by workflow
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Example management for saving formatted text as RAG example
  const { uploadMutation } = useExampleManagement()

  /**
   * Saves the current formatted text as a new RAG example
   */
  const handleSaveAsExample = useCallback(
    async (title: string, category: ExampleCategory, qualityScore: number) => {
      if (!workflow.document || !workflow.modifiedText) {
        throw new Error('Missing document or formatted text')
      }

      log.info('Saving formatted text as example:', title)

      // Create a Blob from the modified text
      const blob = new Blob([workflow.modifiedText], { type: 'text/plain' })
      const file = new File([blob], `${title}.txt`, { type: 'text/plain' })

      await uploadMutation.mutateAsync({
        file,
        title,
        category,
        qualityScore,
        source: 'uploaded'
      })

      log.info('Example saved successfully')
      setShowSaveDialog(false)
    },
    [workflow.document, workflow.modifiedText, uploadMutation]
  )

  /**
   * Wrapper for handleChange that maintains backward compatibility
   */
  const handleModifiedChange = useCallback(
    (text: string) => {
      workflow.handleChange(text)
    },
    [workflow]
  )

  // Return the complete interface
  return {
    // Workflow state
    currentStep: workflow.currentStep,
    document: workflow.document,
    selectedModelId: workflow.selectedModelId,
    isProcessing: workflow.isProcessing,
    processedOutput: workflow.processedOutput,
    modifiedText: workflow.modifiedText,
    markdownText: workflow.markdownText,
    progress: workflow.progress,
    ragStatus: workflow.ragStatus,
    examplesCount: workflow.examplesCount,
    enabledExampleIds: workflow.enabledExampleIds,
    hasChanges: workflow.hasChanges,
    hasUnsavedChanges: workflow.hasUnsavedChanges,
    editHistory: workflow.editHistory,
    canUndo: workflow.canUndo,
    canRedo: workflow.canRedo,

    // Validation state
    canAdvanceToSelectModel: workflow.canAdvanceToSelectModel,
    canStartProcessing: workflow.canStartProcessing,
    canAdvanceToReview: workflow.canAdvanceToReview,

    // Loading states
    isParsing: workflow.isParsing,
    isValidatingProvider: workflow.isValidatingProvider,
    isLoadingModels: workflow.isLoadingModels,
    isLoadingExamples: workflow.isLoadingExamples,
    isEmbeddingLoading: workflow.isEmbeddingLoading,
    isEmbeddingReady: workflow.isEmbeddingReady,
    isGenerating: workflow.isGenerating,
    isBusy: workflow.isBusy,

    // Error states
    parseError: workflow.parseError,
    processingError: workflow.processingError,
    embeddingError: workflow.embeddingError,
    generateError: workflow.generateError,

    // Data
    models: workflow.models,
    allExamples: workflow.allExamples,
    activeProvider: workflow.activeProvider,
    availableProviders: workflow.availableProviders,

    // UI-specific state
    showSaveDialog,

    // Actions - Workflow
    goToStep: workflow.goToStep,
    handleFileSelect: workflow.handleFileSelect,
    setSelectedModelId: workflow.setSelectedModelId,
    handleProviderValidate: workflow.handleProviderValidate,
    handleFormatScript: workflow.handleFormatScript,
    handleExampleToggle: workflow.handleExampleToggle,
    switchProvider: workflow.switchProvider,
    cancelProcessing: workflow.cancelProcessing,
    handleStartOver: workflow.handleStartOver,

    // Actions - Review
    handleModifiedChange,
    undo: workflow.undo,
    redo: workflow.redo,
    markAsSaved: workflow.markAsSaved,

    // Actions - Download
    handleDownload: workflow.handleDownload,

    // Actions - UI-specific
    handleSaveAsExample,
    setShowSaveDialog
  }
}
