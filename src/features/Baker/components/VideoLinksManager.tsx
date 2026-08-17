/**
 * VideoLinksManager - Container component for managing video links
 * Feature: 004-embed-multiple-video
 * Refactored: 2025-11-18 - Extracted state to useVideoLinksManager, dialog to AddVideoDialog
 */

import { useVideoLinksManager } from '@features/Trello'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'

import { TrelloCardUpdateDialog } from '@features/Trello'
import { describeVideoLinksError } from '../internal/videoLinksError'
import { VideoLinkCard } from './VideoLinkCard'
import { AddVideoDialog } from './AddVideoDialog'
import { SetPosterFrameDialog } from './SetPosterFrameDialog'

interface VideoLinksManagerProps {
  projectPath: string
}

export function VideoLinksManager({ projectPath }: VideoLinksManagerProps) {
  const {
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
    bytesSent,
    totalBytes,
    stallWarning,
    message,
    uploadSuccess,

    // Dialog state
    isDialogOpen,
    isTrelloDialogOpen,
    setIsTrelloDialogOpen,
    addMode,

    // Trello card rename proposal
    renameProposal,

    // Branded poster frame (Issue #140)
    posterFrame,

    // Poster frame for an already-linked video (Issue #141)
    cardPosterFrame,
    posterFrameTarget,
    posterFrameTargetIndex,
    cardPosterFrameUnavailableReason,
    thumbnailCacheKeys,
    posterFrameDisabledReason,
    requestSetPosterFrame,
    confirmSetPosterFrame,
    retrySetPosterFrame,
    handlePosterFrameDialogOpenChange,

    // Loading states
    isUpdating,
    isFetchingVideo,

    // Computed
    hasApiKey,
    sproutApiKey,
    selectedFolder,
    selectFolder,
    recentFolders,
    canAddVideo,

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
    selectFile,

    // AlertDialog state
    pendingRemoveVideoIndex,
    requestRemoveVideo,
    confirmRemoveVideo,
    cancelRemoveVideo
  } = useVideoLinksManager({ projectPath })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Error state. What failed here is reading this project's local breadcrumbs
  // file, not anything on Sprout Video, so lead with a headline naming the real
  // cause and a remedy the user can act on. The backend's own words stay
  // reachable in the disclosure below, and are logged by the query (issue #226).
  if (error) {
    const failure = describeVideoLinksError(error)

    return (
      <Alert variant="destructive" data-test="video-links-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{failure.title}</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p>{failure.description}</p>

          <details className="bg-muted/50 border-border rounded-md border p-3 text-left text-xs">
            <summary className="text-foreground cursor-pointer font-medium">
              Technical Details
            </summary>
            <p className="text-muted-foreground mt-2 break-words">{failure.detail}</p>
          </details>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetchVideoLinks()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Video Links</h3>
          <p className="text-muted-foreground text-sm">
            {videoLinks.length} {videoLinks.length === 1 ? 'video' : 'videos'} • Sprout
            Video uploads
          </p>
        </div>

        <AddVideoDialog
          dialog={{
            isOpen: isDialogOpen,
            onOpenChange: handleDialogOpenChange,
            canAddVideo: canAddVideo
          }}
          mode={{
            addMode: addMode,
            onTabChange: handleTabChange
          }}
          form={{
            formData: formData,
            onFormFieldChange: updateFormField
          }}
          urlMode={{
            onFetchDetails: handleFetchVideoDetails,
            onAddVideo: handleAddVideo,
            isFetchingVideo: isFetchingVideo,
            hasApiKey: hasApiKey,
            fetchError: fetchError
          }}
          uploadMode={{
            selectedFile: selectedFile,
            uploading: uploading,
            progress: progress,
            bytesSent: bytesSent,
            totalBytes: totalBytes,
            stallWarning: stallWarning,
            message: message,
            uploadSuccess: uploadSuccess,
            onSelectFile: selectFile,
            onUploadAndAdd: handleUploadAndAdd,
            apiKey: sproutApiKey,
            selectedFolder: selectedFolder,
            onSelectedFolderChange: selectFolder,
            recentFolders: recentFolders
          }}
          errors={{
            validationErrors: validationErrors,
            addError: addError
          }}
          posterFrame={{
            available: posterFrame.available,
            unavailableReason: posterFrame.unavailableReason,
            enabled: posterFrame.enabled,
            onEnabledChange: posterFrame.setEnabled,
            backgrounds: posterFrame.backgrounds,
            selectedBackground: posterFrame.selectedBackground,
            onBackgroundChange: posterFrame.setSelectedBackground,
            template: posterFrame.template,
            onTemplateChange: posterFrame.setTemplate,
            offAspect: posterFrame.offAspect,
            text: posterFrame.text,
            onTextChange: posterFrame.setText,
            previewImageUrl: posterFrame.previewImageUrl,
            saveCopy: posterFrame.saveCopy,
            onSaveCopyChange: posterFrame.setSaveCopy,
            status: posterFrame.status,
            error: posterFrame.error,
            onRetry: () => void posterFrame.retry()
          }}
          posterFrameCanvasRef={posterFrame.canvasRef}
        />
      </div>

      {/* Video List */}
      {videoLinks.length === 0 ? (
        <div className="border-border bg-muted rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">No video links added yet</p>
          <p className="text-muted-foreground/50 mt-1 text-xs">
            Add videos uploaded to Sprout Video to associate them with this project
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videoLinks.map((link, index) => (
            <VideoLinkCard
              key={`${link.url}-${index}`}
              videoLink={link}
              onRemove={() => requestRemoveVideo(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              canMoveUp={index > 0}
              canMoveDown={index < videoLinks.length - 1}
              onSetPosterFrame={() => requestSetPosterFrame(index)}
              posterFrameDisabledReason={posterFrameDisabledReason(link)}
              thumbnailCacheKey={thumbnailCacheKeys[link.url] ?? null}
            />
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {isUpdating && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          <span className="text-muted-foreground ml-2 text-sm">Updating...</span>
        </div>
      )}

      {/* Set poster frame on an already-linked video (Issue #141) */}
      <SetPosterFrameDialog
        open={posterFrameTargetIndex !== null}
        onOpenChange={handlePosterFrameDialogOpenChange}
        videoTitle={posterFrameTarget?.title ?? ''}
        posterFrame={{
          unavailableReason: cardPosterFrameUnavailableReason,
          backgrounds: cardPosterFrame.backgrounds,
          selectedBackground: cardPosterFrame.selectedBackground,
          onBackgroundChange: cardPosterFrame.setSelectedBackground,
          template: cardPosterFrame.template,
          onTemplateChange: cardPosterFrame.setTemplate,
          offAspect: cardPosterFrame.offAspect,
          text: cardPosterFrame.text,
          onTextChange: cardPosterFrame.setText,
          previewImageUrl: cardPosterFrame.previewImageUrl,
          saveCopy: cardPosterFrame.saveCopy,
          onSaveCopyChange: cardPosterFrame.setSaveCopy,
          status: cardPosterFrame.status,
          error: cardPosterFrame.error
        }}
        canvasRef={cardPosterFrame.canvasRef}
        onConfirm={() => void confirmSetPosterFrame()}
        onRetry={retrySetPosterFrame}
      />

      {/* Trello Card Update Dialog */}
      <TrelloCardUpdateDialog
        open={isTrelloDialogOpen}
        onOpenChange={setIsTrelloDialogOpen}
        trelloCards={trelloCards}
        onUpdate={handleTrelloCardUpdate}
        onAddTrelloCard={handleAddTrelloCard}
        proposedCardName={renameProposal}
      />

      {/* Remove video link confirmation dialog */}
      <AlertDialog
        open={pendingRemoveVideoIndex !== null}
        onOpenChange={(open) => !open && cancelRemoveVideo()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Video Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this video link?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveVideo}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
