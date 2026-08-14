/**
 * Custom hook for managing video links in breadcrumbs
 * Feature: 004-embed-multiple-video
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { logger } from '@shared/utils'

import {
  bakerAssociateVideoLink,
  bakerGetVideoLinks,
  bakerRemoveVideoLink,
  bakerReorderVideoLinks,
  bakerUpdateVideoLink
} from '../api'
import type { VideoLink } from '../types'

interface UseBreadcrumbsVideoLinksOptions {
  projectPath: string
  enabled?: boolean
}

export function useBreadcrumbsVideoLinks({
  projectPath,
  enabled = true
}: UseBreadcrumbsVideoLinksOptions) {
  const queryClient = useQueryClient()

  // Query: Get video links
  const {
    data: videoLinks = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['breadcrumbs', 'videoLinks', projectPath],
    queryFn: async () => {
      try {
        return await bakerGetVideoLinks(projectPath)
      } catch (err) {
        // What the user is shown is deliberately no longer the raw message
        // (issue #226), so log the backend's own words once, here, where they
        // are still exact.
        logger.error('Failed to read video links from breadcrumbs:', projectPath, err)
        throw err
      }
    },
    enabled: enabled && !!projectPath
  })

  // Mutation: Add video link
  const addVideoLink = useMutation({
    mutationFn: async (videoLink: VideoLink) => {
      return await bakerAssociateVideoLink(projectPath, videoLink)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'videoLinks', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
    }
  })

  // Mutation: Remove video link
  const removeVideoLink = useMutation({
    mutationFn: async (videoIndex: number) => {
      return await bakerRemoveVideoLink(projectPath, videoIndex)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'videoLinks', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
    }
  })

  // Mutation: Update video link
  const updateVideoLink = useMutation({
    mutationFn: async ({
      videoIndex,
      updatedLink
    }: {
      videoIndex: number
      updatedLink: VideoLink
    }) => {
      return await bakerUpdateVideoLink(projectPath, videoIndex, updatedLink)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'videoLinks', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
    }
  })

  // Mutation: Reorder video links
  const reorderVideoLinks = useMutation({
    mutationFn: async ({
      fromIndex,
      toIndex
    }: {
      fromIndex: number
      toIndex: number
    }) => {
      return await bakerReorderVideoLinks(projectPath, fromIndex, toIndex)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['breadcrumbs', 'videoLinks', projectPath]
      })
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs', projectPath] })
    }
  })

  const isUpdating =
    addVideoLink.isPending ||
    removeVideoLink.isPending ||
    updateVideoLink.isPending ||
    reorderVideoLinks.isPending

  return {
    videoLinks,
    isLoading,
    error,
    /** Re-runs the breadcrumbs read, so a failure can offer the user a retry. */
    refetch,
    addVideoLink: addVideoLink.mutate,
    addVideoLinkAsync: addVideoLink.mutateAsync,
    removeVideoLink: removeVideoLink.mutate,
    removeVideoLinkAsync: removeVideoLink.mutateAsync,
    updateVideoLink: updateVideoLink.mutate,
    updateVideoLinkAsync: updateVideoLink.mutateAsync,
    reorderVideoLinks: reorderVideoLinks.mutate,
    reorderVideoLinksAsync: reorderVideoLinks.mutateAsync,
    isUpdating,
    addError: addVideoLink.error,
    removeError: removeVideoLink.error,
    updateError: updateVideoLink.error,
    reorderError: reorderVideoLinks.error
  }
}
