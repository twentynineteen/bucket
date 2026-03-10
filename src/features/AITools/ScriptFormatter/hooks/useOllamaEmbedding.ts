/**
 * useOllamaEmbedding Hook
 * Feature: 007-frontend-script-example
 * Purpose: Generate embeddings using Ollama's nomic-embed-text model
 */

import { createNamespacedLogger } from '@shared/utils'

import { checkOllamaModels, generateOllamaEmbedding } from '../../api'
import { useEffect, useState } from 'react'

const logger = createNamespacedLogger('useOllamaEmbedding')

interface UseOllamaEmbeddingResult {
  embed: (text: string) => Promise<number[]>
  isReady: boolean
  isLoading: boolean
  error: Error | null
  modelName: string
}

const OLLAMA_BASE_URL = 'http://localhost:11434'
const EMBEDDING_MODEL = 'nomic-embed-text'

export function useOllamaEmbedding(): UseOllamaEmbeddingResult {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Check if Ollama is running and model is available
  useEffect(() => {
    const checkModelAvailability = async () => {
      setIsLoading(true)
      setError(null)

      try {
        logger.log('Checking Ollama connection...')

        // Check if Ollama is running
        const data = await checkOllamaModels(OLLAMA_BASE_URL)
        const models = data.models || []

        logger.log(
          'Available models:',
          models.map((m) => m.name)
        )

        // Check if nomic-embed-text is installed
        const hasEmbeddingModel = models.some((m) => m.name.includes(EMBEDDING_MODEL))

        if (!hasEmbeddingModel) {
          throw new Error(
            `Embedding model "${EMBEDDING_MODEL}" not found. Please run: ollama pull ${EMBEDDING_MODEL}`
          )
        }

        logger.log('Model available:', EMBEDDING_MODEL)
        setIsReady(true)
      } catch (err) {
        logger.error('[useOllamaEmbedding] Failed to check model availability:', err)
        setError(err instanceof Error ? err : new Error('Failed to connect to Ollama'))
        setIsReady(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkModelAvailability()
  }, [])

  const embed = async (text: string): Promise<number[]> => {
    if (!isReady) {
      throw new Error('Embedding model not ready. Please ensure Ollama is running.')
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty')
    }

    try {
      logger.log(`Generating embedding for text (${text.length} chars)...`)

      const embedding = await generateOllamaEmbedding(
        OLLAMA_BASE_URL,
        EMBEDDING_MODEL,
        text
      )
      logger.log(`Embedding generated (${embedding.length} dimensions)`)

      return embedding
    } catch (err) {
      logger.error('[useOllamaEmbedding] Failed to generate embedding:', err)
      throw err instanceof Error ? err : new Error('Failed to generate embedding')
    }
  }

  return {
    embed,
    isReady,
    isLoading,
    error,
    modelName: EMBEDDING_MODEL
  }
}
