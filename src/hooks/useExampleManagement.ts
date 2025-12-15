/**
 * Custom hook for managing AI script example embeddings
 * Feature: 007-frontend-script-example
 *
 * Provides CRUD operations for script examples with TanStack Query integration
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

import type {
  ExampleWithMetadata,
  ReplaceRequest,
  UploadRequest
} from '@/types/exampleEmbeddings'

export function useExampleManagement() {
  const queryClient = useQueryClient()

  // Query: Get all examples with metadata
  const {
    data: examples = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['examples', 'list'],
    queryFn: async () => {
      return await invoke<ExampleWithMetadata[]>('get_all_examples_with_metadata')
    }
  })

  // Mutation: Upload new example
  const uploadExample = useMutation({
    mutationFn: async (request: UploadRequest) => {
      return await invoke<string>('upload_example', { request })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] })
    }
  })

  // Mutation: Replace existing example
  const replaceExample = useMutation({
    mutationFn: async ({ id, request }: { id: string; request: ReplaceRequest }) => {
      return await invoke<void>('replace_example', { id, request })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] })
    }
  })

  // Mutation: Delete example
  const deleteExample = useMutation({
    mutationFn: async (id: string) => {
      return await invoke<void>('delete_example', { id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] })
    }
  })

  return {
    // Query state
    examples,
    isLoading,
    error,
    refetch,

    // Mutations
    uploadExample,
    replaceExample,
    deleteExample
  }
}
