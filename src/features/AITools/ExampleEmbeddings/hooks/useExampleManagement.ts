/**
 * Custom hook for managing AI script example embeddings
 * Feature: 007-frontend-script-example
 *
 * Provides CRUD operations for script examples with TanStack Query integration
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api'

import type { ReplaceRequest, UploadRequest } from '../../types'

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
      return await api.getAllExamples()
    }
  })

  // Mutation: Upload new example
  const uploadExample = useMutation({
    mutationFn: async (request: UploadRequest) => {
      return await api.uploadExample(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] })
    }
  })

  // Mutation: Replace existing example
  const replaceExample = useMutation({
    mutationFn: async ({ id, request }: { id: string; request: ReplaceRequest }) => {
      return await api.replaceExample(id, request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] })
    }
  })

  // Mutation: Delete example
  const deleteExample = useMutation({
    mutationFn: async (id: string) => {
      return await api.deleteExample(id)
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
