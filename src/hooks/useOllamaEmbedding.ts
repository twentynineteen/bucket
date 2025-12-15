/**
 * useOllamaEmbedding Hook
 * Feature: 007-frontend-script-example
 * Purpose: Generate embeddings using Ollama's nomic-embed-text model
 */

import { createNamespacedLogger } from '@utils/logger'
import { useEffect, useState } from 'react'

import { logger } from '@/utils/logger'

const logger = createNamespacedLogger('useOllamaEmbedding')

interface UseOllamaEmbeddingResult {
  embed: (text: string) => Promise<number[]>
  isReady: boolean
  isLoading: boolean
  error: Error | null
  modelName: string
}

interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
  details?: {
    format?: string
    family?: string
    parameter_size?: string
  }
}

interface OllamaTagsResponse {
  models: OllamaModel[]
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
        const tagsResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
          signal: AbortSignal.timeout(5000)
        })

        if (!tagsResponse.ok) {
          throw new Error('Ollama is not running. Please start Ollama.')
        }

        const data = (await tagsResponse.json()) as OllamaTagsResponse
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

      const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          prompt: text
        }),
        signal: AbortSignal.timeout(30000) // 30s timeout for large texts
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama API error: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid response from Ollama: missing embedding array')
      }

      const embedding = data.embedding as number[]
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
