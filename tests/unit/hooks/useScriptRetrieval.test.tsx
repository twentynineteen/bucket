/**
 * Test Suite: useScriptRetrieval Hook
 *
 * Tests for the RAG-powered script example retrieval hook.
 * Following TDD methodology as per DEBT-009 Phase 3.
 *
 * Test Categories:
 * 1. Initialization (2 tests)
 * 2. Successful Retrieval (3 tests)
 * 3. Query Conditions (3 tests)
 * 4. Error Handling (2 tests)
 * 5. Caching Behavior (2 tests)
 *
 * Total: 12 tests
 */

import { useEmbedding } from '@/hooks/useEmbedding'
import { useScriptRetrieval, type SimilarExample } from '@/hooks/useScriptRetrieval'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@/hooks/useEmbedding', () => ({
  useEmbedding: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  createNamespacedLogger: () => ({
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('useScriptRetrieval Hook', () => {
  let queryClient: QueryClient
  let mockEmbed: ReturnType<typeof vi.fn>
  let mockInvoke: ReturnType<typeof vi.fn>

  // Mock data
  const mockScriptText =
    'This is a test script that needs formatting for autocue reading.'
  const mockEmbedding = new Array(384).fill(0.5) // Typical embedding dimension

  const mockExamples: SimilarExample[] = [
    {
      id: '1',
      title: 'Example Script 1',
      category: 'news',
      before_text: 'Raw news script text',
      after_text: 'Formatted news script',
      similarity: 0.89
    },
    {
      id: '2',
      title: 'Example Script 2',
      category: 'interview',
      before_text: 'Raw interview text',
      after_text: 'Formatted interview script',
      similarity: 0.78
    },
    {
      id: '3',
      title: 'Example Script 3',
      category: 'documentary',
      before_text: 'Raw documentary text',
      after_text: 'Formatted documentary script',
      similarity: 0.71
    }
  ]

  // Test wrapper with QueryClient
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0
        }
      }
    })

    // Setup default mocks
    mockEmbed = vi.fn().mockResolvedValue(mockEmbedding)
    mockInvoke = vi.fn().mockResolvedValue(mockExamples)
    ;(invoke as any).mockImplementation(mockInvoke)
    ;(useEmbedding as any).mockReturnValue({
      embed: mockEmbed,
      isReady: true
    })
  })

  // =================================================================
  // Test Category 1: Initialization (2 tests)
  // =================================================================

  describe('Initialization', () => {
    test('returns correct interface', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Assert
      expect(result.current).toEqual({
        examples: expect.any(Array),
        isLoading: expect.any(Boolean),
        isError: expect.any(Boolean),
        error: null
      })
    })

    test('initializes with empty examples array while loading', () => {
      // Arrange & Act
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Assert - Initial state before query resolves
      expect(result.current.examples).toEqual([])
      expect(result.current.isLoading).toBe(true)
    })
  })

  // =================================================================
  // Test Category 2: Successful Retrieval (3 tests)
  // =================================================================

  describe('Successful Retrieval', () => {
    test('retrieves similar examples successfully', async () => {
      // Arrange
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Act & Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.examples).toEqual(mockExamples)
      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('generates embedding and calls Tauri command with correct parameters', async () => {
      // Arrange
      const topK = 5
      const minSimilarity = 0.7

      const { result } = renderHook(
        () =>
          useScriptRetrieval(mockScriptText, {
            topK,
            minSimilarity
          }),
        { wrapper }
      )

      // Act
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Assert
      expect(mockEmbed).toHaveBeenCalledWith(mockScriptText)
      expect(mockInvoke).toHaveBeenCalledWith('search_similar_scripts', {
        queryEmbedding: mockEmbedding,
        topK,
        minSimilarity
      })
    })

    test('returns examples sorted by similarity', async () => {
      // Arrange
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Act
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Assert - Examples should be ordered by similarity (descending)
      const { examples } = result.current
      expect(examples[0].similarity).toBeGreaterThan(examples[1].similarity)
      expect(examples[1].similarity).toBeGreaterThan(examples[2].similarity)
    })
  })

  // =================================================================
  // Test Category 3: Query Conditions (3 tests)
  // =================================================================

  describe('Query Conditions', () => {
    test('does not execute query when enabled=false', async () => {
      // Arrange & Act
      const { result } = renderHook(
        () =>
          useScriptRetrieval(mockScriptText, {
            enabled: false
          }),
        { wrapper }
      )

      // Wait a bit to ensure query doesn't execute
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockEmbed).not.toHaveBeenCalled()
      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.examples).toEqual([])
    })

    test('does not execute query when embedding not ready', async () => {
      // Arrange
      ;(useEmbedding as any).mockReturnValue({
        embed: mockEmbed,
        isReady: false // Not ready
      })

      // Act
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Wait a bit to ensure query doesn't execute
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockEmbed).not.toHaveBeenCalled()
      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(true) // Still loading because embedding not ready
      expect(result.current.examples).toEqual([])
    })

    test('does not execute query when script text too short (<50 chars)', async () => {
      // Arrange
      const shortScript = 'Too short' // Less than 50 characters

      // Act
      const { result } = renderHook(() => useScriptRetrieval(shortScript), {
        wrapper
      })

      // Wait a bit to ensure query doesn't execute
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockEmbed).not.toHaveBeenCalled()
      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.examples).toEqual([])
    })
  })

  // =================================================================
  // Test Category 4: Error Handling (2 tests)
  // =================================================================

  describe('Error Handling', () => {
    test('handles embedding generation errors', async () => {
      // Arrange
      const embeddingError = new Error('Embedding model failed')
      mockEmbed.mockRejectedValue(embeddingError)

      // Act
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(embeddingError)
      expect(result.current.examples).toEqual([])
    })

    test('handles Tauri command search errors', async () => {
      // Arrange
      const searchError = new Error('Database search failed')
      mockInvoke.mockRejectedValue(searchError)

      // Act
      const { result } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(searchError)
      expect(result.current.examples).toEqual([])
    })
  })

  // =================================================================
  // Test Category 5: Caching Behavior (2 tests)
  // =================================================================

  describe('Caching Behavior', () => {
    test('uses cached results for identical queries', async () => {
      // Arrange & Act - First render
      const { result: result1 } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      // Clear mocks to check if they're called again
      vi.clearAllMocks()

      // Second render with same script text
      const { result: result2 } = renderHook(() => useScriptRetrieval(mockScriptText), {
        wrapper
      })

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false)
      })

      // Assert - Should use cached results, not call again
      expect(mockEmbed).not.toHaveBeenCalled()
      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result2.current.examples).toEqual(mockExamples)
    })

    test('generates new query when script text changes', async () => {
      // Arrange - First query
      const { result, rerender } = renderHook(({ text }) => useScriptRetrieval(text), {
        wrapper,
        initialProps: { text: mockScriptText }
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockEmbed).toHaveBeenCalledTimes(1)
      expect(mockInvoke).toHaveBeenCalledTimes(1)

      // Act - Rerender with different script text
      const newScriptText =
        'This is completely different script text that needs different examples.'
      rerender({ text: newScriptText })

      // Assert - Should trigger new query
      await waitFor(() => {
        expect(mockEmbed).toHaveBeenCalledTimes(2)
      })

      expect(mockEmbed).toHaveBeenCalledWith(newScriptText)
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
})
