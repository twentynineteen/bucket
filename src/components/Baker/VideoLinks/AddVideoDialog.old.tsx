/**
 * AddVideoDialog - Dialog for adding new video links
 * Extracted from VideoLinksManager to reduce complexity (DEBT-002)
 */

import { AlertCircle, Loader2, Plus, Upload as UploadIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FormData {
  url: string
  title: string
  thumbnailUrl: string
  sproutVideoId: string
}

interface AddVideoDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canAddVideo: boolean
  addMode: 'url' | 'upload'
  onTabChange: (value: string) => void
  // Form data
  formData: FormData
  onFormFieldChange: (field: keyof FormData, value: string) => void
  // URL mode
  onFetchDetails: () => void
  onAddVideo: () => void
  isFetchingVideo: boolean
  hasApiKey: boolean
  fetchError: string | null
  // Upload mode
  selectedFile: string | null
  uploading: boolean
  progress: number
  message: string | null
  uploadSuccess: boolean
  onSelectFile: () => void
  onUploadAndAdd: () => void
  // Errors
  validationErrors: string[]
  addError: Error | null
}

export function AddVideoDialog({
  isOpen,
  onOpenChange,
  canAddVideo,
  addMode,
  onTabChange,
  formData,
  onFormFieldChange,
  onFetchDetails,
  onAddVideo,
  isFetchingVideo,
  hasApiKey,
  fetchError,
  selectedFile,
  uploading,
  progress,
  message,
  uploadSuccess,
  onSelectFile,
  onUploadAndAdd,
  validationErrors,
  addError
}: AddVideoDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!canAddVideo}>
          <Plus className="mr-2 h-4 w-4" />
          Add Video
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Video Link</DialogTitle>
          <DialogDescription>
            Add a link to a video uploaded on Sprout Video
          </DialogDescription>
        </DialogHeader>

        <Tabs value={addMode} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">Enter URL</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
          </TabsList>

          {/* URL Entry Tab */}
          <TabsContent value="url" className="space-y-4 py-4">
            <UrlEntryContent
              formData={formData}
              onFormFieldChange={onFormFieldChange}
              onFetchDetails={onFetchDetails}
              isFetchingVideo={isFetchingVideo}
              hasApiKey={hasApiKey}
              fetchError={fetchError}
              validationErrors={validationErrors}
              addError={addError}
            />
          </TabsContent>

          {/* Upload File Tab */}
          <TabsContent value="upload" className="space-y-4 py-4">
            <UploadContent
              selectedFile={selectedFile}
              uploading={uploading}
              progress={progress}
              message={message}
              hasApiKey={hasApiKey}
              onSelectFile={onSelectFile}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {addMode === 'url' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onAddVideo}>Add Video</Button>
            </>
          ) : uploadSuccess ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Finish
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={onUploadAndAdd}
                disabled={!selectedFile || !hasApiKey || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading... {progress}%
                  </>
                ) : (
                  'Upload and Add'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Sub-component for URL entry content
function UrlEntryContent({
  formData,
  onFormFieldChange,
  onFetchDetails,
  isFetchingVideo,
  hasApiKey,
  fetchError,
  validationErrors,
  addError
}: {
  formData: FormData
  onFormFieldChange: (field: keyof FormData, value: string) => void
  onFetchDetails: () => void
  isFetchingVideo: boolean
  hasApiKey: boolean
  fetchError: string | null
  validationErrors: string[]
  addError: Error | null
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="video-url">Video URL *</Label>
        <div className="flex gap-2">
          <Input
            id="video-url"
            placeholder="https://sproutvideo.com/videos/..."
            value={formData.url}
            onChange={(e) => onFormFieldChange('url', e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onFetchDetails}
            disabled={!formData.url || !hasApiKey || isFetchingVideo}
          >
            {isFetchingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Fetch Details'
            )}
          </Button>
        </div>
        {!hasApiKey && formData.url && (
          <p className="text-xs text-amber-600">
            Sprout Video API key not configured. Go to Settings to add it.
          </p>
        )}
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="video-title">Title *</Label>
        <Input
          id="video-title"
          placeholder="Video title"
          value={formData.title}
          onChange={(e) => onFormFieldChange('title', e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sprout-id">Sprout Video ID</Label>
        <Input
          id="sprout-id"
          placeholder="abc123xyz"
          value={formData.sproutVideoId}
          onChange={(e) => onFormFieldChange('sproutVideoId', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
        <Input
          id="thumbnail-url"
          placeholder="https://..."
          value={formData.thumbnailUrl}
          onChange={(e) => onFormFieldChange('thumbnailUrl', e.target.value)}
        />
      </div>

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {addError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {addError instanceof Error ? addError.message : String(addError)}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

// Sub-component for upload content
function UploadContent({
  selectedFile,
  uploading,
  progress,
  message,
  hasApiKey,
  onSelectFile
}: {
  selectedFile: string | null
  uploading: boolean
  progress: number
  message: string | null
  hasApiKey: boolean
  onSelectFile: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Video File *</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSelectFile}
            disabled={uploading}
            className="flex-1"
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Select Video File
          </Button>
        </div>
        {selectedFile && (
          <p className="text-sm text-gray-600">
            Selected: <span className="font-medium">{selectedFile.split('/').pop()}</span>
          </p>
        )}
      </div>

      {!hasApiKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sprout Video API key not configured. Go to Settings to add it.
          </AlertDescription>
        </Alert>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading: {progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {message && !uploading && (
        <Alert
          variant={
            typeof message === 'string' && message.includes('failed')
              ? 'destructive'
              : 'default'
          }
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{String(message)}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
