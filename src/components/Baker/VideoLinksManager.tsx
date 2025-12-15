/**
 * VideoLinksManager - Container component for managing video links
 * Feature: 004-embed-multiple-video
 * Refactored: 2025-11-18 - Extracted state to useVideoLinksManager, dialog to AddVideoDialog
 */

import { useVideoLinksManager } from '@hooks/useVideoLinksManager'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { TrelloCardUpdateDialog } from './TrelloCardUpdateDialog'
import { VideoLinkCard } from './VideoLinkCard'
import { AddVideoDialog } from './VideoLinks/AddVideoDialog'

interface VideoLinksManagerProps {
  projectPath: string
}

export function VideoLinksManager({ projectPath }: VideoLinksManagerProps) {
  const {
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
    hasApiKey,
    canAddVideo,

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
  } = useVideoLinksManager({ projectPath })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load video links:{' '}
          {error instanceof Error ? error.message : String(error)}
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
            message: message,
            uploadSuccess: uploadSuccess,
            onSelectFile: selectFile,
            onUploadAndAdd: handleUploadAndAdd
          }}
          errors={{
            validationErrors: validationErrors,
            addError: addError
          }}
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
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              canMoveUp={index > 0}
              canMoveDown={index < videoLinks.length - 1}
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

      {/* Trello Card Update Dialog */}
      <TrelloCardUpdateDialog
        open={isTrelloDialogOpen}
        onOpenChange={setIsTrelloDialogOpen}
        trelloCards={trelloCards}
        onUpdate={handleTrelloCardUpdate}
        onAddTrelloCard={handleAddTrelloCard}
      />
    </div>
  )
}
