/**
 * useScriptProcessor Hook
 * Feature: 006-i-wish-to (T042)
 * Purpose: AI script processing with streaming, retry, and tool calling
 * Enhanced with RAG (Retrieval-Augmented Generation)
 */

import { ModelFactory } from '@services/ai/modelFactory'
import { invoke } from '@tauri-apps/api/core'
import { buildRAGPrompt } from '@utils/aiPrompts'
import { createNamespacedLogger } from '@utils/logger'
import { streamText } from 'ai'
import { useRef, useState } from 'react'

import type { ProcessedOutput, ProviderConfiguration } from '@/types/scriptFormatter'
import { logger } from '@/utils/logger'

import { useOllamaEmbedding } from './useOllamaEmbedding'
import type { SimilarExample } from './useScriptRetrieval'

const logger = createNamespacedLogger('useScriptProcessor')

interface ProcessScriptOptions {
  text: string
  modelId: string
  providerId: string
  configuration: ProviderConfiguration
  enabledExampleIds?: Set<string>
  onProgress?: (progress: number) => void
  onRetry?: (attempt: number) => void
  onRAGUpdate?: (status: string, examplesCount: number) => void
}

interface UseScriptProcessorResult {
  processScript: (options: ProcessScriptOptions) => Promise<ProcessedOutput>
  isProcessing: boolean
  progress: number
  result: ProcessedOutput | null
  error: Error | null
  retry: () => Promise<void>
  cancel: () => void
  isEmbeddingReady: boolean
  isEmbeddingLoading: boolean
  embeddingError: Error | null
}

/**
 * Retrieves similar examples using RAG (Retrieval-Augmented Generation)
 */
async function retrieveSimilarExamples(
  options: ProcessScriptOptions,
  embed: (text: string) => Promise<number[]>,
  isEmbeddingReady: boolean
): Promise<SimilarExample[]> {
  const enableRAG = true

  if (!enableRAG || !isEmbeddingReady || options.text.length <= 50) {
    logger.log('RAG disabled or not ready - processing without examples', {
      enableRAG,
      isEmbeddingReady,
      textLength: options.text.length
    })
    options.onRAGUpdate?.('RAG not available', 0)
    return []
  }

  try {
    options.onRAGUpdate?.('Searching for similar examples...', 0)

    // Generate embedding for query
    logger.log('Generating embedding for query text...')
    const queryEmbedding = await embed(options.text)
    logger.log(`Query embedding generated: ${queryEmbedding.length} dimensions`)

    // Search for similar scripts
    logger.log('Searching database for similar examples...')
    const allSimilarExamples = await invoke<SimilarExample[]>('search_similar_scripts', {
      queryEmbedding,
      topK: 10,
      minSimilarity: 0.4
    })

    // Filter by enabled example IDs if provided
    const examples = filterEnabledExamples(allSimilarExamples, options.enabledExampleIds)

    logger.log(`Search complete: Using ${examples.length} similar examples`)

    if (examples.length > 0) {
      logger.log(
        'Example details:',
        examples.map((ex) => ({
          id: ex.id,
          title: ex.title,
          similarity: ex.similarity,
          category: ex.category
        }))
      )
      options.onRAGUpdate?.(
        `Using ${examples.length} similar example${examples.length > 1 ? 's' : ''}`,
        examples.length
      )
    } else {
      const reason = getNoExamplesReason(options.enabledExampleIds)
      logger.log(reason)
      options.onRAGUpdate?.(reason, 0)
    }

    return examples
  } catch (ragError) {
    logger.error('[useScriptProcessor] RAG retrieval failed:', ragError)
    options.onRAGUpdate?.(
      'RAG search failed: ' +
        (ragError instanceof Error ? ragError.message : String(ragError)),
      0
    )
    return []
  }
}

/**
 * Filters examples based on enabled IDs
 */
function filterEnabledExamples(
  allExamples: SimilarExample[],
  enabledIds?: Set<string>
): SimilarExample[] {
  if (!enabledIds || enabledIds.size === 0) {
    return allExamples.slice(0, 3)
  }

  const filtered = allExamples.filter((ex) => enabledIds.has(ex.id))
  logger.log(`Filtered ${allExamples.length} examples to ${filtered.length} enabled`)
  return filtered
}

/**
 * Gets reason message when no examples are found
 */
function getNoExamplesReason(enabledIds?: Set<string>): string {
  if (enabledIds && enabledIds.size === 0) {
    return 'All examples disabled'
  }
  return 'No similar examples found (try enabling more examples)'
}

/**
 * Streams AI response and collects formatted text
 */
async function streamAIResponse(
  options: ProcessScriptOptions,
  systemPrompt: string,
  abortSignal: AbortSignal
): Promise<string> {
  const totalPromptSize = systemPrompt.length + options.text.length
  logger.log('Processing with AI...')
  logger.log('System prompt length:', systemPrompt.length, 'characters')
  logger.log('User text length:', options.text.length, 'characters')
  logger.log(
    'Total prompt size:',
    totalPromptSize,
    'characters (~' + Math.ceil(totalPromptSize / 4) + ' tokens)'
  )

  // Warn if prompt is very large
  if (totalPromptSize > 20000) {
    logger.log('⚠️  Large prompt detected - first response may take 30-60 seconds')
  }

  const model = ModelFactory.createModel({
    providerId: options.providerId,
    modelId: options.modelId,
    configuration: options.configuration
  })

  const streamResult = streamText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Format this script for autocue/teleprompter reading. Preserve ALL the original words and content exactly as written - DO NOT rewrite, paraphrase, or change the meaning. ONLY add formatting (line breaks, bold, pauses). Output ONLY the formatted script with no preamble, introduction, or explanation.

SCRIPT TO FORMAT:
${options.text}`
      }
    ],
    temperature: 0.3,
    abortSignal,
    // Ollama-specific options via providerOptions
    providerOptions: {
      ollama: {
        options: {
          // Context window size - set to 8192 for better compatibility with longer prompts
          // Reduced from previous larger values to prevent timeout issues
          // 8192 tokens (~32K chars) provides good balance between capacity and performance
          num_ctx: 8192,
          // Unlimited output tokens for long scripts
          num_predict: -1,
          // Keep model loaded for 10 minutes to avoid cold start delays
          keep_alive: '10m',
          // Reduce temperature for more consistent output
          temperature: 0.3
        }
      }
    }
  })

  // Collect streamed text
  let formattedText = ''
  let chunkCount = 0

  for await (const chunk of streamResult.textStream) {
    formattedText += chunk
    chunkCount++

    // Update progress (20-95%)
    const streamProgress = 20 + Math.min(75, (chunkCount / 100) * 75)
    options.onProgress?.(streamProgress)
  }

  return formattedText
}

/**
 * Creates ProcessedOutput from formatted text
 */
function createProcessedOutput(
  formattedText: string,
  originalText: string,
  examplesCount: number
): ProcessedOutput {
  // Debug logging
  logger.debug(
    'Formatted text preview (first 200 chars):',
    formattedText.substring(0, 200)
  )
  logger.debug('Line breaks found:', formattedText.split('\n').length)

  // Convert line breaks to proper HTML paragraphs
  const htmlContent = formattedText
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${line}</p>`)
    .join('\n')

  return {
    id: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    formattedHtml: htmlContent,
    formattedText,
    diffData: {
      additions: [],
      deletions: [],
      modifications: [],
      originalLineCount: originalText.split('\n').length,
      modifiedLineCount: formattedText.split('\n').length
    },
    editHistory: [],
    generationTimestamp: new Date(),
    isEdited: false,
    examplesCount
  }
}

/**
 * Validates that AI output is not empty
 */
function validateAIOutput(formattedText: string): void {
  if (!formattedText || formattedText.trim().length === 0) {
    throw new Error(
      'AI processing failed: No output received. The model may have timed out or encountered an error. Please try again.'
    )
  }
}

export function useScriptProcessor(): UseScriptProcessorResult {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ProcessedOutput | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastOptionsRef = useRef<ProcessScriptOptions | null>(null)

  // Use embedding hook for RAG - using Ollama for Tauri compatibility
  const {
    embed,
    isReady: isEmbeddingReady,
    isLoading: isEmbeddingLoading,
    error: embeddingError
  } = useOllamaEmbedding()

  const processScript = async (
    options: ProcessScriptOptions
  ): Promise<ProcessedOutput> => {
    lastOptionsRef.current = options
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    setResult(null)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    const maxRetries = 3
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        // Step 1: Retrieve similar examples using RAG (10% progress)
        logger.log('Step 1: Retrieving similar examples...')
        setProgress(5)
        options.onProgress?.(5)

        const examples = await retrieveSimilarExamples(options, embed, isEmbeddingReady)

        setProgress(15)
        options.onProgress?.(15)

        // Step 2: Build enhanced prompt with examples (20% progress)
        logger.log('Step 2: Building prompt...')
        const systemPrompt = buildRAGPrompt(options.text, examples)
        setProgress(20)
        options.onProgress?.(20)

        // Step 3: Stream AI response (20-95% progress)
        const formattedText = await streamAIResponse(
          options,
          systemPrompt,
          abortControllerRef.current.signal
        )

        // Complete processing
        setProgress(100)
        options.onProgress?.(100)

        // Step 4: Validate and create output
        validateAIOutput(formattedText)
        const output = createProcessedOutput(formattedText, options.text, examples.length)

        setResult(output)
        setIsProcessing(false)
        return output
      } catch (err) {
        attempt++

        // Log detailed error information
        logger.error(
          '[useScriptProcessor] Processing error (attempt',
          attempt,
          'of',
          maxRetries,
          '):',
          err
        )
        if (err instanceof Error) {
          logger.error('[useScriptProcessor] Error name:', err.name)
          logger.error('[useScriptProcessor] Error message:', err.message)
          logger.error('[useScriptProcessor] Error stack:', err.stack)
        }

        if (abortControllerRef.current?.signal.aborted) {
          // User cancelled
          const cancelError = new Error('Processing cancelled by user')
          setError(cancelError)
          setIsProcessing(false)
          throw cancelError
        }

        if (attempt >= maxRetries) {
          // Final failure after retries
          const finalError =
            err instanceof Error ? err : new Error('Failed to process script')
          logger.error(
            '[useScriptProcessor] Max retries exceeded. Final error:',
            finalError
          )
          setError(finalError)
          setIsProcessing(false)
          throw finalError
        }

        // Retry with exponential backoff
        logger.log(
          `Retrying in ${Math.pow(2, attempt)}s... (attempt ${attempt} of ${maxRetries})`
        )
        options.onRetry?.(attempt)
        const backoffDelay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
      }
    }

    throw new Error('Max retries exceeded')
  }

  const retry = async () => {
    if (lastOptionsRef.current) {
      await processScript(lastOptionsRef.current)
    }
  }

  const cancel = () => {
    abortControllerRef.current?.abort()
  }

  return {
    processScript,
    isProcessing,
    progress,
    result,
    error,
    retry,
    cancel,
    isEmbeddingReady,
    isEmbeddingLoading,
    embeddingError
  }
}
