/**
 * Custom hook for managing video links in breadcrumbs
 * Feature: 004-embed-multiple-video
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

import type { BreadcrumbsFile, VideoLink } from '@/types/baker'

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
    error
  } = useQuery({
    queryKey: ['breadcrumbs', 'videoLinks', projectPath],
    queryFn: async () => {
      return await invoke<VideoLink[]>('baker_get_video_links', { projectPath })
    },
    enabled: enabled && !!projectPath
  })

  // Mutation: Add video link
  const addVideoLink = useMutation({
    mutationFn: async (videoLink: VideoLink) => {
      return await invoke<BreadcrumbsFile>('baker_associate_video_link', {
        projectPath,
        videoLink
      })
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
      return await invoke<BreadcrumbsFile>('baker_remove_video_link', {
        projectPath,
        videoIndex
      })
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
      return await invoke<BreadcrumbsFile>('baker_update_video_link', {
        projectPath,
        videoIndex,
        updatedLink
      })
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
      return await invoke<BreadcrumbsFile>('baker_reorder_video_links', {
        projectPath,
        fromIndex,
        toIndex
      })
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
