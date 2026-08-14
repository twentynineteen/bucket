/**
 * Upload to SproutVideo Page
 *
 * Allows users to upload video files directly to their SproutVideo account.
 * Follows the standard page template pattern used by BuildProject and Baker pages.
 */

import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Progress } from '@shared/ui/progress'
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'
import { useSproutVideoApiKey } from '@shared/hooks'
import { useBreadcrumb } from '@shared/hooks'
import { fileNameToTitle } from '@shared/utils'
import { useFileUpload } from '../hooks/useFileUpload'
import { useKavanaghForUpload } from '../hooks/useKavanaghForUpload'
import { KavanaghBlockDialog, KavanaghGateControls } from './KavanaghUploadGate'
import { useSproutFolderSelection } from '../hooks/useSproutFolderSelection'
import { SproutFolderPicker } from './SproutFolderPicker'
import { useImageRefresh } from '../hooks/useImageRefresh'
import { useUploadEvents } from '../hooks/useUploadEvents'
import EmbedCodeInput from '@shared/ui/EmbedCodeInput'
import ExternalLink from '@shared/ui/ExternalLink'
import FormattedDate from '@shared/ui/FormattedDate'
import { AlertTriangle, RefreshCw, Sprout } from 'lucide-react'
import React, { useMemo, useState } from 'react'

/**
 * What the upload button says, given everything that can be happening to it.
 *
 * A function rather than nested ternaries in the tree: the page is already at
 * the complexity the repo lints for, and this is the part of it that reads
 * worst inline.
 */
function uploadButtonLabel(state: {
  checking: boolean
  uploading: boolean
  apiKeyLoading: boolean
}): string {
  if (state.checking) return 'Checking with Kavanagh...'
  if (state.uploading) return 'Uploading...'
  if (state.apiKeyLoading) return 'Loading...'
  return 'Upload Video'
}

const UploadSproutContent: React.FC = () => {
  // Custom hooks
  const { apiKey, isLoading: apiKeyLoading } = useSproutVideoApiKey()
  const { progress, uploading, message, setProgress, setMessage, setUploading } =
    useUploadEvents()
  const { selectedFile, response, selectFile, uploadFile } = useFileUpload()
  // Destination folder, resolved once: session last-used -> default -> root.
  const {
    selectedFolder,
    selectFolder,
    recentFolders,
    commitFolder,
    defaultFolderReason
  } = useSproutFolderSelection()
  const { thumbnailLoaded, refreshTimestamp, setThumbnailLoaded } =
    useImageRefresh(response)
  const [title, setTitle] = useState('')
  const kavanagh = useKavanaghForUpload()

  // Page label - shadcn breadcrumb component (memoized to prevent infinite re-renders)
  const breadcrumbItems = useMemo(
    () => [
      { label: 'Upload content', href: '/upload/sprout' },
      { label: 'Sprout video' }
    ],
    []
  )
  useBreadcrumb(breadcrumbItems)

  // Prefill the title from the chosen filename; the user can edit it freely
  const handleSelectFile = async () => {
    const file = await selectFile()
    if (file) {
      setTitle(fileNameToTitle(file))
      // A previous render's verdict must not linger beside a different file.
      kavanagh.reset()
    }
  }

  // The upload itself, once anything gating it has let it through.
  const performUpload = async () => {
    // Reset progress and message before starting upload
    setProgress(0)
    setMessage(null)
    setUploading(true)
    // The destination is passed explicitly rather than set on useFileUpload
    // first -- setting state then uploading would send the previous value.
    await uploadFile(apiKey, title, selectedFolder)
    // Only remember a folder an upload actually used.
    commitFolder(selectedFolder)
  }

  // Handle upload with API key
  const handleUpload = async () => {
    // Checked before anything reaches Sprout, not after (B9.3). A failure holds
    // the upload here and opens the override dialog; a warning does not (D14).
    if (selectedFile && !(await kavanagh.gate(selectedFile))) return
    await performUpload()
  }

  // Proceeding past a failure is a deliberate act, so it runs the upload the
  // block interrupted rather than asking the operator to press Upload again.
  const handleOverride = async () => {
    kavanagh.override()
    await performUpload()
  }

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Sprout className="text-primary h-6 w-6" />
            <div>
              <h1 className="text-foreground text-2xl font-bold">
                Upload to SproutVideo
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Upload video files directly to your SproutVideo account
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Step 1: Select Video */}
          <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border flex items-center gap-2 border-b p-4">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                1
              </div>
              <h2 className="text-foreground text-sm font-semibold">Select Video</h2>
            </div>
            <div className="p-4">
              <Button onClick={handleSelectFile} className="w-full">
                Select Video File
              </Button>
              {selectedFile && (
                <p className="text-muted-foreground mt-3 text-sm">
                  Selected:{' '}
                  <span className="text-foreground font-medium">
                    {selectedFile.split('/').pop()}
                  </span>
                </p>
              )}
              {selectedFile && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="sprout-video-title">Video Title</Label>
                  <Input
                    id="sprout-video-title"
                    placeholder="Video title on Sprout Video"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                  <p className="text-muted-foreground text-xs">
                    Used as the video title on Sprout Video. Leave blank to use the
                    filename.
                  </p>

                  <div className="space-y-2 pt-2">
                    <Label>Sprout Folder</Label>
                    <SproutFolderPicker
                      apiKey={apiKey}
                      value={selectedFolder}
                      onChange={selectFolder}
                      recentFolders={recentFolders}
                      disabled={uploading}
                    />
                    {/*
                      A saved default that cannot be vouched for says so here,
                      beside the control that fixes it (#169). Silent otherwise:
                      the picker's own label always states the real destination.
                    */}
                    {defaultFolderReason ? (
                      <p className="text-destructive flex items-start gap-1.5 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{defaultFolderReason}</span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Where the video is filed on Sprout. Defaults to the account root.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Upload */}
          <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border flex items-center gap-2 border-b p-4">
              <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                2
              </div>
              <h2 className="text-foreground text-sm font-semibold">Upload Video</h2>
            </div>
            <div className="p-4">
              {uploading && (
                <div className="mb-4">
                  <p className="text-muted-foreground mb-2 text-sm">
                    Uploading: {progress}%
                  </p>
                  <Progress value={progress} />
                </div>
              )}
              <KavanaghGateControls kavanagh={kavanagh} uploading={uploading} />

              <Button
                onClick={handleUpload}
                className="w-full"
                disabled={
                  !selectedFile ||
                  !apiKey ||
                  uploading ||
                  apiKeyLoading ||
                  kavanagh.checking
                }
              >
                {uploadButtonLabel({
                  checking: kavanagh.checking,
                  uploading,
                  apiKeyLoading
                })}
              </Button>

              {message && (
                <div
                  className={`mt-4 rounded-md border p-3 ${
                    message.severity === 'error'
                      ? 'border-red-200 bg-red-100 text-red-800'
                      : 'border-green-200 bg-green-100 text-green-800'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Video Details (shown after upload) */}
          {response && (
            <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
              <div className="border-border flex items-center gap-2 border-b p-4">
                <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  3
                </div>
                <h2 className="text-foreground text-sm font-semibold">Video Details</h2>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  {/* Thumbnail */}
                  <div className="border-border overflow-hidden rounded-lg border shadow-md">
                    <ExternalLink url={`https://sproutvideo.com/videos/${response.id}`}>
                      {/* Conditionally render placeholder until the image loads */}
                      {!thumbnailLoaded && (
                        <div
                          className="bg-muted flex items-center justify-center"
                          style={{
                            width: '300px',
                            height: '169px'
                          }}
                        >
                          <span className="text-muted-foreground text-sm">
                            Loading thumbnail...
                          </span>
                        </div>
                      )}
                      <img
                        src={`${response.assets.poster_frames[0]}?t=${refreshTimestamp}`}
                        alt="Video posterframe"
                        onLoad={() => setThumbnailLoaded(true)}
                        style={{
                          display: thumbnailLoaded ? 'block' : 'none',
                          width: '300px'
                        }}
                      />
                    </ExternalLink>
                  </div>

                  {/* Video Info */}
                  <div className="flex-1 space-y-3">
                    <p className="text-foreground text-xl font-semibold">
                      {response.title}
                    </p>
                    <div className="text-muted-foreground text-sm">
                      <FormattedDate dateString={response.created_at} />
                    </div>
                    <p className="text-muted-foreground text-sm">{response.duration}</p>
                    <EmbedCodeInput embedCode={response.embed_code} />
                    <p className="text-muted-foreground text-sm">
                      {response.embedded_url}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <KavanaghBlockDialog kavanagh={kavanagh} onOverride={() => void handleOverride()} />
    </div>
  )
}

const UploadSprout: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">Upload Error</h2>
            <div className="text-muted-foreground mb-6">
              <p>
                An error occurred while loading the upload page. This could be due to:
              </p>
              <ul className="mt-2 space-y-1 text-left">
                <li>- API key configuration issues</li>
                <li>- Network connectivity problems</li>
                <li>- File system access restrictions</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="text-muted-foreground mt-2">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={() => (window.location.href = '/upload/sprout')}
                variant="outline"
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <UploadSproutContent />
    </ErrorBoundary>
  )
}

export default UploadSprout
