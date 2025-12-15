/**
 * useAIProcessing Hook
 * Manages AI provider selection, model selection, and script processing
 *
 * Responsibilities:
 * - AI provider selection and validation
 * - Model selection and management
 * - Script processing with progress tracking
 * - RAG example management
 * - Processing error handling and cancellation
 */

import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useEffect, useState } from 'react'

import type { ProcessedOutput, ProviderConfiguration } from '@/types/scriptFormatter'

import { useAIModels } from './useAIModels'
import { useAIProvider } from './useAIProvider'
import { useExampleManagement } from './useExampleManagement'
import { useScriptProcessor } from './useScriptProcessor'

const log = createNamespacedLogger('AIProcessing')

interface UseAIProcessingOptions {
  onSuccess?: (output: ProcessedOutput) => void
  onError?: (error: Error) => void
}

export function useAIProcessing(options?: UseAIProcessingOptions) {
  const { onSuccess, onError } = options || {}

  // State
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [processedOutput, setProcessedOutput] = useState<ProcessedOutput | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [ragStatus, setRagStatus] = useState<string>('')
  const [examplesCount, setExamplesCount] = useState<number>(0)
  const [enabledExampleIds, setEnabledExampleIds] = useState<Set<string>>(new Set())
  const [isValidatingProvider, setIsValidatingProvider] = useState(false)

  // Sub-hooks
  const { activeProvider, availableProviders, switchProvider, validateProvider } =
    useAIProvider()

  const { models, isLoading: isLoadingModels } = useAIModels({
    providerId: activeProvider?.id || '',
    configuration: activeProvider?.configuration || {
      serviceUrl: '',
      connectionStatus: 'not-configured'
    },
    enabled: !!activeProvider && activeProvider.status === 'configured'
  })

  const {
    processScript,
    error: processingError,
    cancel: cancelProcessing,
    isEmbeddingReady,
    isEmbeddingLoading,
    embeddingError
  } = useScriptProcessor()

  const { examples: allExamples, isLoading: isLoadingExamples } = useExampleManagement()

  // Derived state
  const isProcessing = progress > 0 && progress < 100 && !processingError

  // Initialize enabled examples when examples are loaded
  useEffect(() => {
    if (allExamples.length > 0 && enabledExampleIds.size === 0) {
      setEnabledExampleIds(new Set(allExamples.map((ex) => ex.id)))
    }
  }, [allExamples, enabledExampleIds.size])

  // Auto-select first model when models become available
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      log.debug('Auto-selecting first model:', models[0].id)
      setSelectedModelId(models[0].id)
    }
  }, [models, selectedModelId])

  const handleProviderValidate = useCallback(
    async (providerId: string, config: ProviderConfiguration) => {
      setIsValidatingProvider(true)
      try {
        await validateProvider(providerId, config)
      } finally {
        setIsValidatingProvider(false)
      }
    },
    [validateProvider]
  )

  const handleFormatScript = useCallback(
    async (text: string) => {
      if (!text || !selectedModelId || !activeProvider) {
        log.warn('Missing required data for processing:', {
          hasText: !!text,
          selectedModelId,
          activeProvider: activeProvider?.id
        })
        return
      }

      // Clear previous state
      setProcessedOutput(null)
      setProgress(0)
      setRagStatus('')
      setExamplesCount(0)

      try {
        log.info('Starting script processing')

        const output = await processScript({
          text,
          modelId: selectedModelId,
          providerId: activeProvider.id,
          configuration: activeProvider.configuration,
          enabledExampleIds,
          onProgress: (prog) => {
            log.debug(`Progress: ${prog}%`)
            setProgress(prog)
          },
          onRAGUpdate: (status, count) => {
            log.debug(`RAG update: ${status}, count: ${count}`)
            setRagStatus(status)
            setExamplesCount(count)
          }
        })

        log.info('Processing completed successfully')
        setProcessedOutput(output)
        setProgress(100)

        if (onSuccess) {
          onSuccess(output)
        }
      } catch (error) {
        const err = error as Error
        log.error('Processing failed:', err.message)
        setProgress(0)

        if (onError) {
          onError(err)
        }
      }
    },
    [
      selectedModelId,
      activeProvider,
      enabledExampleIds,
      processScript,
      onSuccess,
      onError
    ]
  )

  const handleExampleToggle = useCallback((exampleId: string) => {
    setEnabledExampleIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(exampleId)) {
        newSet.delete(exampleId)
      } else {
        newSet.add(exampleId)
      }
      return newSet
    })
  }, [])

  const reset = useCallback(() => {
    log.debug('Resetting processing state')
    setSelectedModelId(null)
    setProcessedOutput(null)
    setProgress(0)
    setRagStatus('')
    setExamplesCount(0)
  }, [])

  return {
    // State
    selectedModelId,
    isProcessing,
    processedOutput,
    progress,
    ragStatus,
    examplesCount,
    enabledExampleIds,
    isValidatingProvider,

    // Loading states
    isLoadingModels,
    isLoadingExamples,
    isEmbeddingLoading,
    isEmbeddingReady,

    // Errors
    processingError,
    embeddingError,

    // Data
    models,
    allExamples,
    activeProvider,
    availableProviders,

    // Actions
    setSelectedModelId,
    handleProviderValidate,
    handleFormatScript,
    handleExampleToggle,
    switchProvider,
    cancelProcessing,
    reset
  }
}
