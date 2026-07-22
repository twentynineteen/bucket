/**
 * useVideoLinksManager Hook
 * Purpose: Manages state and handlers for VideoLinksManager component
 * Extracted to reduce component complexity (DEBT-002)
 */

import {
  fileNameToTitle,
  formatDurationSuffix,
  logger,
  validateVideoLink
} from '@shared/utils'
import { useState } from 'react'

import type { BreadcrumbsFile, VideoLink } from '@features/Baker'

import { useSproutVideoApiKey, useTrelloApiKeys } from '@shared/hooks'
import {
  generateBreadcrumbsBlock,
  updateTrelloCardWithBreadcrumbs
} from '@features/Baker'
import { useBreadcrumbsTrelloCards } from './useBreadcrumbsTrelloCards'
import { useBreadcrumbsVideoLinks } from '@features/Baker'
import {
  useFileUpload,
  useSproutVideoApi,
  useSproutVideoProcessor,
  useUploadEvents
} from '@features/Upload'

import { bakerReadBreadcrumbs, fetchTrelloCardById, updateTrelloCard } from '../api'

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
  const {
    selectedFile,
    uploading,
    response,
    localDuration,
    selectFile,
    uploadFile,
    resetUploadState
  } = useFileUpload()
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

  // AlertDialog state for video link removal confirmation
  const [pendingRemoveVideoIndex, setPendingRemoveVideoIndex] = useState<number | null>(
    null
  )

  const requestRemoveVideo = (index: number) => {
    setPendingRemoveVideoIndex(index)
  }

  const confirmRemoveVideo = () => {
    if (pendingRemoveVideoIndex !== null) {
      removeVideoLink(pendingRemoveVideoIndex)
      setPendingRemoveVideoIndex(null)
    }
  }

  const cancelRemoveVideo = () => {
    setPendingRemoveVideoIndex(null)
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

  // Prefill the title from the chosen filename; the user can edit it before upload
  const handleSelectUploadFile = async () => {
    const file = await selectFile()
    if (file) {
      setFormData((prev) => ({ ...prev, title: fileNameToTitle(file) }))
    }
  }

  const handleUploadAndAdd = async () => {
    if (!selectedFile || !apiKey) return

    try {
      await uploadFile(apiKey, formData.title)
    } catch (error) {
      logger.error('Upload failed:', error)
    }
  }

  // Title of the video as uploaded to Sprout (only meaningful after an upload)
  const uploadedVideoTitle = response
    ? response.title?.trim() || formData.title.trim()
    : ''

  // Best duration known right now: Sprout's if processed, else the local file probe
  const knownDuration =
    response && response.duration > 0 ? response.duration : localDuration

  const proposedCardName = uploadedVideoTitle
    ? knownDuration && knownDuration > 0
      ? `${uploadedVideoTitle} (${formatDurationSuffix(knownDuration)})`
      : uploadedVideoTitle
    : null

  // Only offer a rename when at least one linked card would actually change
  const renameProposal =
    proposedCardName && trelloCards?.some((card) => card.title !== proposedCardName)
      ? proposedCardName
      : null

  /**
   * Resolves the final card name for a rename: prefers Sprout's processed
   * duration (re-fetched once if the upload response predated processing),
   * falls back to the local file probe, and omits the suffix if neither is
   * available.
   */
  const resolveRenameCardName = async (): Promise<string | null> => {
    if (!uploadedVideoTitle) return null

    let duration = response && response.duration > 0 ? response.duration : null

    if (!duration && response?.id && apiKey) {
      try {
        const details = await fetchVideoDetailsAsync({
          videoUrl: `https://sproutvideo.com/videos/${response.id}`,
          apiKey
        })
        if (details.duration > 0) {
          duration = details.duration
        }
      } catch (error) {
        logger.warn('Could not re-fetch Sprout video duration:', error)
      }
    }

    if (!duration && localDuration && localDuration > 0) {
      duration = localDuration
    }

    return duration
      ? `${uploadedVideoTitle} (${formatDurationSuffix(duration)})`
      : uploadedVideoTitle
  }

  const handleTrelloCardUpdate = async (
    selectedCardIndexes: number[],
    options?: { renameToVideoTitle?: boolean }
  ) => {
    if (!trelloApiKey || !trelloToken) {
      throw new Error('Trello API credentials not configured')
    }

    const breadcrumbsData = (await bakerReadBreadcrumbs(projectPath)) as BreadcrumbsFile

    const breadcrumbsBlock = generateBreadcrumbsBlock(breadcrumbsData)

    const newCardName = options?.renameToVideoTitle ? await resolveRenameCardName() : null

    const updatePromises = selectedCardIndexes.map(async (index) => {
      const card = trelloCards[index]
      const fullCard = await fetchTrelloCardById(card.cardId, trelloApiKey, trelloToken)

      await updateTrelloCardWithBreadcrumbs(
        fullCard,
        breadcrumbsBlock,
        trelloApiKey,
        trelloToken,
        { autoReplace: true, silentErrors: false }
      )

      // Rename only after the card update itself succeeded
      if (newCardName && card.title !== newCardName) {
        await updateTrelloCard(
          card.cardId,
          { name: newCardName },
          trelloApiKey,
          trelloToken
        )
      }
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

    // Trello card rename proposal (null when no rename applies)
    renameProposal,

    // Loading states
    isUpdating,
    isFetchingVideo,

    // Computed
    hasApiKey: !!apiKey,
    canAddVideo: videoLinks.length < 20 && !isUpdating,

    // Handlers
    handleFetchVideoDetails,
    handleAddVideo,
    handleMoveUp,
    handleMoveDown,
    handleUploadAndAdd,
    handleTrelloCardUpdate,
    handleAddTrelloCard,
    handleDialogOpenChange,
    handleTabChange,
    selectFile: handleSelectUploadFile,

    // AlertDialog state for video removal
    pendingRemoveVideoIndex,
    requestRemoveVideo,
    confirmRemoveVideo,
    cancelRemoveVideo
  }
}
