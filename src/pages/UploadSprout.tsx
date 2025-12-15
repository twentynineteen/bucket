/**
 * Upload to SproutVideo Page
 *
 * Allows users to upload video files directly to their SproutVideo account.
 * Follows the standard page template pattern used by BuildProject and Baker pages.
 */

import { Button } from '@components/ui/button'
import { Progress } from '@components/ui/progress'
import ErrorBoundary from '@components/ErrorBoundary'
import { useSproutVideoApiKey } from '@hooks/useApiKeys'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useFileUpload } from '@hooks/useFileUpload'
import { useImageRefresh } from '@hooks/useImageRefresh'
import { useUploadEvents } from '@hooks/useUploadEvents'
import EmbedCodeInput from '@utils/EmbedCodeInput'
import ExternalLink from '@utils/ExternalLink'
import FormattedDate from '@utils/FormattedDate'
import { AlertTriangle, RefreshCw, Sprout } from 'lucide-react'
import React, { useMemo } from 'react'

const UploadSproutContent: React.FC = () => {
  // Custom hooks
  const { apiKey, isLoading: apiKeyLoading } = useSproutVideoApiKey()
  const { progress, uploading, message, setProgress, setMessage, setUploading } =
    useUploadEvents()
  const { selectedFile, response, selectFile, uploadFile } = useFileUpload()
  const { thumbnailLoaded, refreshTimestamp, setThumbnailLoaded } =
    useImageRefresh(response)

  // Page label - shadcn breadcrumb component (memoized to prevent infinite re-renders)
  const breadcrumbItems = useMemo(
    () => [
      { label: 'Upload content', href: '/upload/sprout' },
      { label: 'Sprout video' }
    ],
    []
  )
  useBreadcrumb(breadcrumbItems)

  // Handle upload with API key
  const handleUpload = () => {
    // Reset progress and message before starting upload
    setProgress(0)
    setMessage(null)
    setUploading(true)
    uploadFile(apiKey)
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
              <Button onClick={selectFile} className="w-full">
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
              <Button
                onClick={handleUpload}
                className="w-full"
                disabled={!selectedFile || !apiKey || uploading || apiKeyLoading}
              >
                {uploading
                  ? 'Uploading...'
                  : apiKeyLoading
                    ? 'Loading...'
                    : 'Upload Video'}
              </Button>

              {message && (
                <div
                  className={`mt-4 rounded-md border p-3 ${
                    message.toLowerCase().includes('success')
                      ? 'border-green-200 bg-green-100 text-green-800'
                      : 'border-red-200 bg-red-100 text-red-800'
                  }`}
                >
                  {message}
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
                <li>• API key configuration issues</li>
                <li>• Network connectivity problems</li>
                <li>• File system access restrictions</li>
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
