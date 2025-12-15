/**
 * useVideoLinksManager Hook
 * Purpose: Manages state and handlers for VideoLinksManager component
 * Extracted to reduce component complexity (DEBT-002)
 */

import { invoke } from '@tauri-apps/api/core'
import { validateVideoLink } from '@utils/validation'
import { useState } from 'react'

import type { BreadcrumbsFile, VideoLink } from '@/types/baker'
import { logger } from '@/utils/logger'

import { useSproutVideoApiKey, useTrelloApiKeys } from './useApiKeys'
import {
  generateBreadcrumbsBlock,
  updateTrelloCardWithBreadcrumbs
} from './useAppendBreadcrumbs'
import { useBreadcrumbsTrelloCards } from './useBreadcrumbsTrelloCards'
import { useBreadcrumbsVideoLinks } from './useBreadcrumbsVideoLinks'
import { useFileUpload } from './useFileUpload'
import { useSproutVideoApi } from './useSproutVideoApi'
import { useSproutVideoProcessor } from './useSproutVideoProcessor'
import { useUploadEvents } from './useUploadEvents'

interface UseVideoLinksManagerProps {
  projectPath: string
}

interface FormData {
  url: string
  title: string
  thumbnailUrl: string
  sproutVideoId: string
}

const initialFormData: FormData = {
  url: '',
  title: '',
  thumbnailUrl: '',
  sproutVideoId: ''
}

export function useVideoLinksManager({ projectPath }: UseVideoLinksManagerProps) {
  // Core data hooks
  const {
    videoLinks,
    isLoading,
    error,
    addVideoLink,
    removeVideoLink,
    reorderVideoLinks,
    isUpdating,
    addError
  } = useBreadcrumbsVideoLinks({ projectPath })

  const { trelloCards } = useBreadcrumbsTrelloCards({ projectPath })
  const { apiKey } = useSproutVideoApiKey()
  const { apiKey: trelloApiKey, apiToken: trelloToken } = useTrelloApiKeys()
  const { fetchVideoDetailsAsync, isFetching: isFetchingVideo } = useSproutVideoApi()
  const { selectedFile, uploading, response, selectFile, uploadFile, resetUploadState } =
    useFileUpload()
  const { progress, message } = useUploadEvents()

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTrelloDialogOpen, setIsTrelloDialogOpen] = useState(false)
  const [addMode, setAddMode] = useState<'url' | 'upload'>('url')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // React Query-based upload processor
  const videoProcessor = useSproutVideoProcessor({
    response,
    selectedFile,
    uploading,
    enabled: addMode === 'upload',
    onVideoReady: (videoLink) => {
      addVideoLink(videoLink)
      if (trelloCards && trelloCards.length > 0 && trelloApiKey && trelloToken) {
        setIsTrelloDialogOpen(true)
      }
    },
    onError: (error) => {
      setValidationErrors([error])
    }
  })

  // Derive upload success from state
  const uploadSuccess = response && !uploading && addMode === 'upload'

  // Handlers
  const handleFetchVideoDetails = async () => {
    if (!formData.url || !apiKey) return

    setFetchError(null)
    setValidationErrors([])

    try {
      const details = await fetchVideoDetailsAsync({
        videoUrl: formData.url,
        apiKey
      })

      setFormData({
        ...formData,
        title: details.title,
        thumbnailUrl: details.assets.poster_frames[0] || '',
        sproutVideoId: details.id
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch video details'
      setFetchError(errorMessage)
    }
  }

  const handleAddVideo = () => {
    const newLink: VideoLink = {
      url: formData.url.trim(),
      title: formData.title.trim(),
      thumbnailUrl: formData.thumbnailUrl.trim() || undefined,
      sproutVideoId: formData.sproutVideoId.trim() || undefined
    }

    const errors = validateVideoLink(newLink)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    if (videoLinks.length >= 20) {
      setValidationErrors(['Maximum of 20 videos per project reached'])
      return
    }

    addVideoLink(newLink)
    setFormData(initialFormData)
    setValidationErrors([])
    setIsDialogOpen(false)
  }

  const handleRemove = (index: number) => {
    if (confirm('Are you sure you want to remove this video link?')) {
      removeVideoLink(index)
    }
  }

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderVideoLinks({ fromIndex: index, toIndex: index - 1 })
    }
  }

  const handleMoveDown = (index: number) => {
    if (index < videoLinks.length - 1) {
      reorderVideoLinks({ fromIndex: index, toIndex: index + 1 })
    }
  }

  const handleUploadAndAdd = async () => {
    if (!selectedFile || !apiKey) return

    try {
      await uploadFile(apiKey)
    } catch (error) {
      logger.error('Upload failed:', error)
    }
  }

  const handleTrelloCardUpdate = async (selectedCardIndexes: number[]) => {
    if (!trelloApiKey || !trelloToken) {
      throw new Error('Trello API credentials not configured')
    }

    const breadcrumbsData = await invoke<BreadcrumbsFile>('baker_read_breadcrumbs', {
      projectPath
    })

    const breadcrumbsBlock = generateBreadcrumbsBlock(breadcrumbsData)

    const updatePromises = selectedCardIndexes.map(async (index) => {
      const card = trelloCards[index]
      const response = await fetch(
        `https://api.trello.com/1/cards/${card.cardId}?key=${trelloApiKey}&token=${trelloToken}`
      )
      const fullCard = await response.json()

      await updateTrelloCardWithBreadcrumbs(
        fullCard,
        breadcrumbsBlock,
        trelloApiKey,
        trelloToken,
        { autoReplace: true, silentErrors: false }
      )
    })

    await Promise.all(updatePromises)
  }

  const handleAddTrelloCard = () => {
    // TODO: Add Trello Card functionality to be implemented
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)

    if (!open) {
      setFormData(initialFormData)
      setValidationErrors([])
      setFetchError(null)
      setAddMode('url')
      resetUploadState()
      videoProcessor.reset()
    }
  }

  const handleTabChange = (value: string) => {
    setAddMode(value as 'url' | 'upload')
    setValidationErrors([])
    setFetchError(null)

    if (value === 'url') {
      resetUploadState()
      videoProcessor.reset()
    }
  }

  const updateFormField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (field === 'url') {
      setFetchError(null)
    }
  }

  return {
    // Data
    videoLinks,
    isLoading,
    error,
    addError,
    trelloCards,

    // Form state
    formData,
    updateFormField,
    validationErrors,
    fetchError,

    // Upload state
    selectedFile,
    uploading,
    progress,
    message,
    uploadSuccess,

    // Dialog state
    isDialogOpen,
    isTrelloDialogOpen,
    setIsTrelloDialogOpen,
    addMode,

    // Loading states
    isUpdating,
    isFetchingVideo,

    // Computed
    hasApiKey: !!apiKey,
    canAddVideo: videoLinks.length < 20 && !isUpdating,

    // Handlers
    handleFetchVideoDetails,
    handleAddVideo,
    handleRemove,
    handleMoveUp,
    handleMoveDown,
    handleUploadAndAdd,
    handleTrelloCardUpdate,
    handleAddTrelloCard,
    handleDialogOpenChange,
    handleTabChange,
    selectFile
  }
}
