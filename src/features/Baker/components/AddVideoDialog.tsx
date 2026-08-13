/**
 * AddVideoDialog - Dialog for adding new video links
 * DEBT-007: Refactored with grouped parameters (21 → 6 parameter groups)
 * Reduced from 21 individual parameters to 6 logical parameter groups
 */

import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Upload as UploadIcon
} from 'lucide-react'
import type { RefObject } from 'react'

import type {
  PosterframeTemplateId,
  SelectedSproutFolder,
  UploadMessage
} from '@features/Upload'
import { SproutFolderPicker } from '@features/Upload'

import { Alert, AlertDescription } from '@shared/ui/alert'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@shared/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'

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
  message: UploadMessage | null
  uploadSuccess: boolean
  onSelectFile: () => void
  onUploadAndAdd: () => void
  /** Sprout API key, for the folder picker. Null disables it (issue #155). */
  apiKey: string | null
  /** Destination folder on Sprout. Null uploads to the account root. */
  selectedFolder: SelectedSproutFolder | null
  onSelectedFolderChange: (folder: SelectedSproutFolder | null) => void
  /** Recently used folders, most recent first. */
  recentFolders: SelectedSproutFolder[]
}

export interface ErrorState {
  validationErrors: string[]
  addError: Error | null
}

/**
 * Branded poster frame options for the upload flow (Issue #140). Everything
 * here is owned by usePosterFrameForUpload; the dialog only renders it.
 */
export interface PosterFrameDialogState {
  /** False when the font or background folder isn't usable */
  available: boolean
  /** Why the option is unavailable, shown next to the disabled checkbox */
  unavailableReason: string | null
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  backgrounds: string[]
  selectedBackground: string | null
  onBackgroundChange: (path: string) => void
  /** Which branding template lays the thumbnail out (issue #189). */
  template: PosterframeTemplateId
  onTemplateChange: (template: PosterframeTemplateId) => void
  /** The previewed background deviates from 16:9, so text may sit oddly. */
  offAspect: boolean
  text: string
  onTextChange: (text: string) => void
  previewImageUrl: string | null
  saveCopy: boolean
  onSaveCopyChange: (saveCopy: boolean) => void
  status: 'idle' | 'working' | 'success' | 'error'
  error: string | null
  onRetry: () => void
}

// Refactored props interface - 6 grouped parameters instead of 21 individual ones
export interface AddVideoDialogProps {
  dialog: DialogState
  mode: ModeState
  form: FormState
  urlMode: UrlModeState
  uploadMode: UploadModeState
  errors: ErrorState
  posterFrame: PosterFrameDialogState
  /**
   * Ref for the preview canvas. Kept out of the posterFrame group because a
   * member expression used as `ref=` reads as a render-time ref access.
   */
  posterFrameCanvasRef: RefObject<HTMLCanvasElement | null>
}

export function AddVideoDialog({
  dialog,
  mode,
  form,
  urlMode,
  uploadMode,
  errors,
  posterFrame,
  posterFrameCanvasRef
}: AddVideoDialogProps) {
  // The poster frame step must finish before the dialog can be closed, so the
  // work can't be torn down halfway through (B5.2).
  const posterFrameWorking = posterFrame.enabled && posterFrame.status === 'working'
  const posterFrameSettled = !posterFrame.enabled || posterFrame.status !== 'working'
  // A background-only frame is never sent to Sprout, so a ticked option with no
  // text holds the upload back (#141 amendment, B7.1-B7.3).
  const posterFrameTextMissing =
    posterFrame.enabled && posterFrame.text.trim().length === 0

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
            <UploadContent
              uploadMode={uploadMode}
              urlMode={urlMode}
              form={form}
              posterFrame={posterFrame}
              posterFrameCanvasRef={posterFrameCanvasRef}
            />
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
            posterFrameSettled ? (
              <Button onClick={() => dialog.onOpenChange(false)} className="w-full">
                Finish
              </Button>
            ) : (
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait...
              </Button>
            )
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => dialog.onOpenChange(false)}
                disabled={posterFrameWorking}
              >
                Cancel
              </Button>
              <Button
                onClick={uploadMode.onUploadAndAdd}
                disabled={
                  !uploadMode.selectedFile ||
                  !urlMode.hasApiKey ||
                  uploadMode.uploading ||
                  posterFrameTextMissing
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

// Sub-component for the branded poster frame options (Issue #140)
function PosterFrameContent({
  posterFrame,
  canvasRef
}: {
  posterFrame: PosterFrameDialogState
  canvasRef: RefObject<HTMLCanvasElement | null>
}) {
  const selectedName = posterFrame.selectedBackground?.split('/').pop() ?? ''

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Checkbox
          id="create-poster-frame"
          checked={posterFrame.enabled}
          onCheckedChange={(checked) => posterFrame.onEnabledChange(checked === true)}
          disabled={!posterFrame.available}
        />
        <div className="flex-1">
          <Label htmlFor="create-poster-frame" className="cursor-pointer">
            Create branded poster frame
          </Label>
          {posterFrame.unavailableReason ? (
            <p className="text-warning mt-1 text-xs">{posterFrame.unavailableReason}</p>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              Sets a branded thumbnail on Sprout Video instead of an auto-generated still.
            </p>
          )}
        </div>
      </div>

      {posterFrame.enabled && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="poster-frame-template">Template</Label>
            <Select
              value={posterFrame.template}
              onValueChange={(value) =>
                posterFrame.onTemplateChange(value as PosterframeTemplateId)
              }
            >
              <SelectTrigger id="poster-frame-template" className="w-full">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="rebrand">Rebrand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poster-frame-background">Background</Label>
            <Select
              value={posterFrame.selectedBackground ?? ''}
              onValueChange={posterFrame.onBackgroundChange}
            >
              <SelectTrigger id="poster-frame-background" className="w-full">
                <SelectValue placeholder="Select a background">
                  {selectedName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {posterFrame.backgrounds.map((file) => (
                  <SelectItem key={file} value={file}>
                    {file.split('/').pop()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poster-frame-text">Poster frame text</Label>
            <Input
              id="poster-frame-text"
              value={posterFrame.text}
              onChange={(event) => posterFrame.onTextChange(event.target.value)}
              maxLength={200}
              disabled={posterFrame.status === 'working'}
            />
            {posterFrame.text.trim().length === 0 ? (
              <p className="text-warning text-xs">Poster frame text is required.</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Taken from the last part of the video title. Edit it to change the
                thumbnail only.
              </p>
            )}
          </div>

          {posterFrame.previewImageUrl && (
            <div className="border-border overflow-hidden rounded border">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Poster frame preview"
                className="aspect-video w-full"
              />
            </div>
          )}

          {/* A warning, not a block: the layout scales by height and still
              renders, but the design assumes 16:9 (issue #189 B4.2). */}
          {posterFrame.offAspect && (
            <p role="alert" className="text-warning text-xs">
              This background is not 16:9, so the title text may sit oddly on the final
              thumbnail.
            </p>
          )}

          <div className="flex items-start gap-2">
            <Checkbox
              id="poster-frame-save-copy"
              checked={posterFrame.saveCopy}
              onCheckedChange={(checked) =>
                posterFrame.onSaveCopyChange(checked === true)
              }
              disabled={posterFrame.status === 'working'}
            />
            <Label htmlFor="poster-frame-save-copy" className="cursor-pointer">
              Save a copy to the project&apos;s Graphics folder
            </Label>
          </div>

          {posterFrame.status === 'working' && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting poster frame...
            </p>
          )}

          {posterFrame.status === 'success' && (
            <p className="text-success flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Poster frame set on Sprout Video
            </p>
          )}

          {posterFrame.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{posterFrame.error}</p>
                <Button size="sm" variant="secondary" onClick={posterFrame.onRetry}>
                  <ImageIcon className="mr-2 h-3.5 w-3.5" />
                  Retry poster frame
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

// Sub-component for upload content
function UploadContent({
  uploadMode,
  urlMode,
  form,
  posterFrame,
  posterFrameCanvasRef
}: {
  uploadMode: UploadModeState
  urlMode: UrlModeState
  form: FormState
  posterFrame: PosterFrameDialogState
  posterFrameCanvasRef: RefObject<HTMLCanvasElement | null>
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

      {uploadMode.selectedFile && (
        <div className="space-y-2">
          <Label htmlFor="upload-video-title">Video Title</Label>
          <Input
            id="upload-video-title"
            placeholder="Video title on Sprout Video"
            value={form.formData.title}
            onChange={(e) => form.onFormFieldChange('title', e.target.value)}
            maxLength={200}
            disabled={uploadMode.uploading || uploadMode.uploadSuccess}
          />
          <p className="text-muted-foreground text-xs">
            Used as the video title on Sprout Video. Leave blank to use the filename.
          </p>
        </div>
      )}

      {uploadMode.selectedFile && (
        <div className="space-y-2">
          <Label>Sprout Folder</Label>
          <SproutFolderPicker
            apiKey={uploadMode.apiKey}
            value={uploadMode.selectedFolder}
            onChange={uploadMode.onSelectedFolderChange}
            recentFolders={uploadMode.recentFolders}
            disabled={uploadMode.uploading || uploadMode.uploadSuccess}
          />
          <p className="text-muted-foreground text-xs">
            Where the video is filed on Sprout. Defaults to the account root.
          </p>
        </div>
      )}

      {uploadMode.selectedFile && (
        <PosterFrameContent posterFrame={posterFrame} canvasRef={posterFrameCanvasRef} />
      )}

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
          variant={uploadMode.message.severity === 'error' ? 'destructive' : 'default'}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{uploadMode.message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
