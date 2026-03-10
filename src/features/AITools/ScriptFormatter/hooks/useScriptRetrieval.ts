/**
 * useScriptRetrieval Hook
 * Feature: 006-i-wish-to RAG Enhancement
 * Purpose: Retrieve similar autocue script examples using vector search
 */

import { useQuery } from '@tanstack/react-query'
import { searchSimilarScripts } from '../../api'
import { createNamespacedLogger } from '@shared/utils'

import type { SimilarExample } from '../../types'

export type { SimilarExample }

import { useEmbedding } from './useEmbedding'

const logger = createNamespacedLogger('useScriptRetrieval')

interface UseScriptRetrievalOptions {
  enabled?: boolean
  topK?: number
  minSimilarity?: number
}

interface UseScriptRetrievalResult {
  examples: SimilarExample[]
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export function useScriptRetrieval(
  scriptText: string,
  options: UseScriptRetrievalOptions = {}
): UseScriptRetrievalResult {
  const { enabled = true, topK = 3, minSimilarity = 0.65 } = options
  const { embed, isReady } = useEmbedding()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['script-retrieval', scriptText.slice(0, 100), topK, minSimilarity],
    queryFn: async (): Promise<SimilarExample[]> => {
      logger.log('Starting retrieval...')

      // 1. Generate embedding for user script
      logger.log('Generating embedding...')
      const embedding = await embed(scriptText)

      // 2. Call Tauri command to search database
      logger.log('Searching for similar examples...')
      const results = await searchSimilarScripts(embedding, topK, minSimilarity)

      logger.log(`Found ${results.length} similar examples`)
      results.forEach((r, i) => {
        logger.log(`  ${i + 1}. ${r.title} (${Math.round(r.similarity * 100)}% similar)`)
      })

      return results
    },
    enabled: enabled && isReady && scriptText.length > 50,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000 // Keep in cache for 15 minutes
  })

  return {
    examples: data || [],
    isLoading: isLoading || !isReady,
    isError,
    error: error as Error | null
  }
}
