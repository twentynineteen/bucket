/**
 * Hook Test: useExampleManagement (T017)
 * Feature: 007-frontend-script-example
 */

import { useExampleManagement } from '@/hooks/useExampleManagement'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as tauriCore from '@tauri-apps/api/core'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockExamples: ExampleWithMetadata[] = [
  {
    id: '1',
    title: 'Test Example',
    category: 'test',
    source: 'bundled',
    beforeText: 'Before',
    afterText: 'After',
    tags: ['test'],
    wordCount: 100,
    qualityScore: 4,
    createdAt: '2024-01-01T00:00:00Z'
  }
]

describe('useExampleManagement Hook - Contract Tests (T017)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity // Prevent automatic refetches
        },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
    // Set up default mock before each test
    vi.mocked(tauriCore.invoke).mockResolvedValue(mockExamples)
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('should fetch examples using TanStack Query', async () => {
    // Contract: Must use useQuery with key ['examples', 'list']
    // Contract: Must call get_all_examples_with_metadata Tauri command
    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(tauriCore.invoke).toHaveBeenCalledWith('get_all_examples_with_metadata')
    expect(result.current.examples).toEqual(mockExamples)
  })

  it('should provide upload mutation', async () => {
    // Contract: Must return useMutation for upload_example
    // Contract: Upload must invalidate examples query cache
    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Mock the upload response after initial query loads
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce('new-id')

    const uploadRequest = {
      beforeContent: 'Before',
      afterContent: 'After',
      metadata: {
        title: 'New Example',
        category: 'test' as any,
        tags: ['test'],
        qualityScore: 4
      },
      embedding: [0.1, 0.2, 0.3]
    }

    await result.current.uploadExample.mutateAsync(uploadRequest)

    expect(tauriCore.invoke).toHaveBeenCalledWith('upload_example', {
      request: uploadRequest
    })
  })

  it('should provide replace mutation', async () => {
    // Contract: Must return useMutation for replace_example
    // Contract: Replace must invalidate examples query cache
    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Mock the replace response after initial query loads
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined)

    const replaceData = {
      id: '1',
      request: {
        beforeContent: 'Updated Before',
        afterContent: 'Updated After',
        embedding: [0.4, 0.5, 0.6]
      }
    }

    await result.current.replaceExample.mutateAsync(replaceData)

    expect(tauriCore.invoke).toHaveBeenCalledWith('replace_example', {
      id: '1',
      request: replaceData.request
    })
  })

  it('should provide delete mutation', async () => {
    // Contract: Must return useMutation for delete_example
    // Contract: Delete must invalidate examples query cache
    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Mock the delete response after initial query loads
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined)

    await result.current.deleteExample.mutateAsync('1')

    expect(tauriCore.invoke).toHaveBeenCalledWith('delete_example', { id: '1' })
  })

  it('should handle errors correctly', async () => {
    // Contract: Mutations must expose error state
    // Contract: Errors should be typed as string from Tauri
    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Mock the error response after initial query loads
    vi.mocked(tauriCore.invoke).mockRejectedValueOnce(new Error('Delete failed'))

    try {
      await result.current.deleteExample.mutateAsync('1')
    } catch (error) {
      expect(error).toBeDefined()
    }

    await waitFor(() => {
      expect(result.current.deleteExample.isError).toBe(true)
    })
  })

  it('should invalidate cache after successful mutations', async () => {
    // Contract: After upload/replace/delete, must call queryClient.invalidateQueries(['examples'])
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useExampleManagement(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Mock the delete response after initial query loads
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined)

    await result.current.deleteExample.mutateAsync('1')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['examples'] })
  })
})
