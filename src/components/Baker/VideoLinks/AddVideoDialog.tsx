/**
 * AddVideoDialog - Dialog for adding new video links
 * DEBT-007: Refactored with grouped parameters (21 → 6 parameter groups)
 * Reduced from 21 individual parameters to 6 logical parameter groups
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

// Type definitions for grouped parameters
export interface DialogState {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  canAddVideo: boolean
}

export interface ModeState {
  addMode: 'url' | 'upload'
  onTabChange: (value: string) => void
}

export interface FormData {
  url: string
  title: string
  thumbnailUrl: string
  sproutVideoId: string
}

export interface FormState {
  formData: FormData
  onFormFieldChange: (field: keyof FormData, value: string) => void
}

export interface UrlModeState {
  onFetchDetails: () => void
  onAddVideo: () => void
  isFetchingVideo: boolean
  hasApiKey: boolean
  fetchError: string | null
}

export interface UploadModeState {
  selectedFile: string | null
  uploading: boolean
  progress: number
  message: string | null
  uploadSuccess: boolean
  onSelectFile: () => void
  onUploadAndAdd: () => void
}

export interface ErrorState {
  validationErrors: string[]
  addError: Error | null
}

// Refactored props interface - 6 grouped parameters instead of 21 individual ones
export interface AddVideoDialogProps {
  dialog: DialogState
  mode: ModeState
  form: FormState
  urlMode: UrlModeState
  uploadMode: UploadModeState
  errors: ErrorState
}

export function AddVideoDialog({
  dialog,
  mode,
  form,
  urlMode,
  uploadMode,
  errors
}: AddVideoDialogProps) {
  return (
    <Dialog open={dialog.isOpen} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!dialog.canAddVideo}>
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

        <Tabs value={mode.addMode} onValueChange={mode.onTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">Enter URL</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
          </TabsList>

          {/* URL Entry Tab */}
          <TabsContent value="url" className="space-y-4 py-4">
            <UrlEntryContent form={form} urlMode={urlMode} errors={errors} />
          </TabsContent>

          {/* Upload File Tab */}
          <TabsContent value="upload" className="space-y-4 py-4">
            <UploadContent uploadMode={uploadMode} urlMode={urlMode} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {mode.addMode === 'url' ? (
            <>
              <Button variant="outline" onClick={() => dialog.onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={urlMode.onAddVideo}>Add Video</Button>
            </>
          ) : uploadMode.uploadSuccess ? (
            <Button onClick={() => dialog.onOpenChange(false)} className="w-full">
              Finish
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => dialog.onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={uploadMode.onUploadAndAdd}
                disabled={
                  !uploadMode.selectedFile || !urlMode.hasApiKey || uploadMode.uploading
                }
              >
                {uploadMode.uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading... {uploadMode.progress}%
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
  form,
  urlMode,
  errors
}: {
  form: FormState
  urlMode: UrlModeState
  errors: ErrorState
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="video-url">Video URL *</Label>
        <div className="flex gap-2">
          <Input
            id="video-url"
            placeholder="https://sproutvideo.com/videos/..."
            value={form.formData.url}
            onChange={(e) => form.onFormFieldChange('url', e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={urlMode.onFetchDetails}
            disabled={!form.formData.url || !urlMode.hasApiKey || urlMode.isFetchingVideo}
          >
            {urlMode.isFetchingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Fetch Details'
            )}
          </Button>
        </div>
        {!urlMode.hasApiKey && form.formData.url && (
          <p className="text-warning text-xs">
            Sprout Video API key not configured. Go to Settings to add it.
          </p>
        )}
      </div>

      {urlMode.fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{urlMode.fetchError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="video-title">Title *</Label>
        <Input
          id="video-title"
          placeholder="Video title"
          value={form.formData.title}
          onChange={(e) => form.onFormFieldChange('title', e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sprout-id">Sprout Video ID</Label>
        <Input
          id="sprout-id"
          placeholder="abc123xyz"
          value={form.formData.sproutVideoId}
          onChange={(e) => form.onFormFieldChange('sproutVideoId', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
        <Input
          id="thumbnail-url"
          placeholder="https://..."
          value={form.formData.thumbnailUrl}
          onChange={(e) => form.onFormFieldChange('thumbnailUrl', e.target.value)}
        />
      </div>

      {errors.validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {errors.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {errors.addError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.addError instanceof Error
              ? errors.addError.message
              : String(errors.addError)}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

// Sub-component for upload content
function UploadContent({
  uploadMode,
  urlMode
}: {
  uploadMode: UploadModeState
  urlMode: UrlModeState
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Video File *</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={uploadMode.onSelectFile}
            disabled={uploadMode.uploading}
            className="flex-1"
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Select Video File
          </Button>
        </div>
        {uploadMode.selectedFile && (
          <p className="text-muted-foreground text-sm">
            Selected:{' '}
            <span className="font-medium">
              {uploadMode.selectedFile.split('/').pop()}
            </span>
          </p>
        )}
      </div>

      {!urlMode.hasApiKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sprout Video API key not configured. Go to Settings to add it.
          </AlertDescription>
        </Alert>
      )}

      {uploadMode.uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Uploading: {uploadMode.progress}%
            </span>
          </div>
          <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${uploadMode.progress}%` }}
              role="progressbar"
              aria-valuenow={uploadMode.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {uploadMode.message && !uploadMode.uploading && (
        <Alert
          variant={
            typeof uploadMode.message === 'string' &&
            uploadMode.message.includes('failed')
              ? 'destructive'
              : 'default'
          }
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{String(uploadMode.message)}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
