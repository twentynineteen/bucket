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
import { useCardPosterFrame } from './useCardPosterFrame'
import { useBreadcrumbsVideoLinks } from '@features/Baker'
import {
  useFileUpload,
  usePosterFrameForUpload,
  useSproutFolderSelection,
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
    refetch: refetchVideoLinks,
    addVideoLink,
    removeVideoLink,
    reorderVideoLinks,
    updateVideoLinkAsync,
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
    cancelUpload,
    resetUploadState
  } = useFileUpload()

  // Destination folder, resolved once: session last-used -> default -> root.
  const { selectedFolder, selectFolder, recentFolders, commitFolder } =
    useSproutFolderSelection()
  const { progress, bytesSent, totalBytes, stallWarning, message, setMessage } =
    useUploadEvents()

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTrelloDialogOpen, setIsTrelloDialogOpen] = useState(false)
  const [addMode, setAddMode] = useState<'url' | 'upload'>('url')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Branded poster frame options for the upload tab (Issue #140)
  const posterFrame = usePosterFrameForUpload({
    projectPath,
    videoTitle: formData.title
  })

  // Poster frame for an already-linked video, driven from the card action
  // (Issue #141)
  const cardPosterFrame = useCardPosterFrame({
    projectPath,
    videoLinks,
    apiKey,
    updateVideoLinkAsync
  })

  /**
   * Finishes an upload: when a branded poster frame was requested, it is set
   * on Sprout first so the stored thumbnail can point at it (B6.1). The link
   * is added either way — a failed poster frame must never cost the upload
   * (B5.7).
   */
  const finishUpload = async (videoLink: VideoLink) => {
    let linkToAdd = videoLink

    if (posterFrame.enabled && videoLink.sproutVideoId && apiKey) {
      const result = await posterFrame.run(videoLink.sproutVideoId, apiKey)
      if (result.ok && result.posterFrameUrl) {
        linkToAdd = { ...videoLink, thumbnailUrl: result.posterFrameUrl }
      }
    }

    addVideoLink(linkToAdd)
    if (trelloCards && trelloCards.length > 0 && trelloApiKey && trelloToken) {
      setIsTrelloDialogOpen(true)
    }
  }

  // React Query-based upload processor
  const videoProcessor = useSproutVideoProcessor({
    response,
    selectedFile,
    uploading,
    enabled: addMode === 'upload',
    onVideoReady: (videoLink) => {
      void finishUpload(videoLink)
    },
    onError: (error) => {
      setValidationErrors([error])
    }
  })

  // Derive upload success from state
  // !!response, not response: the bare `&&` yielded `null` when there was no
  // response, and AddVideoDialog's uploadSuccess prop is a boolean (#210).
  const uploadSuccess = !!response && !uploading && addMode === 'upload'

  // Nothing may be closed or reset while the poster frame request is running
  const posterFrameWorking = posterFrame.enabled && posterFrame.status === 'working'

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

    // Clear any previous attempt's message before the new one starts, so a
    // stale error cannot sit under a live progress bar.
    setMessage(null)

    try {
      // Pass the destination explicitly -- it is resolved by
      // useSproutFolderSelection, not held in useFileUpload's own state.
      await uploadFile(apiKey, formData.title, selectedFolder)
      // Only remember a folder an upload actually used.
      commitFolder(selectedFolder)
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
    // Closing mid-poster-frame would tear down the in-flight request
    if (!open && posterFrameWorking) return

    // Dismissal cancels (#225 UP-24). The alternative - a dialog announcing that
    // the upload continues in the background - needs a background progress
    // surface the app does not have, so the user would be told a multi-gigabyte
    // transfer is still running with nowhere to watch it and nothing to stop it.
    // That is the orphaning defect with better wording. Every dismissal route
    // funnels through here, so Escape and an overlay click behave like the button.
    if (!open && uploading) {
      void cancelUpload()
    }

    setIsDialogOpen(open)

    if (!open) {
      setFormData(initialFormData)
      setValidationErrors([])
      setFetchError(null)
      setAddMode('url')
      resetUploadState()
      // The message lives in the React Query cache, which resetUploadState
      // does not own -- clear it here or a previous run's text reappears.
      setMessage(null)
      videoProcessor.reset()
      posterFrame.reset()
    }
  }

  const handleTabChange = (value: string) => {
    setAddMode(value as 'url' | 'upload')
    setValidationErrors([])
    setFetchError(null)

    if (value === 'url') {
      resetUploadState()
      setMessage(null)
      videoProcessor.reset()
      posterFrame.reset()
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
    refetchVideoLinks,
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
    /** Bytes transferred and the file total, so a slow upload is not a frozen one */
    bytesSent,
    totalBytes,
    /** Non-terminal "this looks stalled" text, or null (#225) */
    stallWarning,
    message,
    uploadSuccess,

    // Dialog state
    isDialogOpen,
    isTrelloDialogOpen,
    setIsTrelloDialogOpen,
    addMode,

    // Trello card rename proposal (null when no rename applies)
    renameProposal,

    // Branded poster frame state and handlers (Issue #140)
    posterFrame,

    // Poster frame for an already-linked video, from the card action (Issue #141)
    cardPosterFrame: cardPosterFrame.posterFrame,
    posterFrameTarget: cardPosterFrame.target,
    posterFrameTargetIndex: cardPosterFrame.targetIndex,
    cardPosterFrameUnavailableReason: cardPosterFrame.unavailableReason,
    thumbnailCacheKeys: cardPosterFrame.thumbnailCacheKeys,
    posterFrameDisabledReason: cardPosterFrame.disabledReason,
    requestSetPosterFrame: cardPosterFrame.request,
    confirmSetPosterFrame: cardPosterFrame.confirm,
    retrySetPosterFrame: cardPosterFrame.retry,
    handlePosterFrameDialogOpenChange: cardPosterFrame.handleOpenChange,

    // Loading states
    isUpdating,
    isFetchingVideo,

    // Sprout destination folder for the upload tab (issue #155)
    selectedFolder,
    selectFolder,
    recentFolders,

    // Computed
    hasApiKey: !!apiKey,
    /** The Sprout key itself, for the folder picker (issue #155) */
    sproutApiKey: apiKey,
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
