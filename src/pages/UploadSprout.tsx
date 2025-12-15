import { Button } from '@components/ui/button'
import { Progress } from '@components/ui/progress'
import { useSproutVideoApiKey } from '@hooks/useApiKeys'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useFileUpload } from '@hooks/useFileUpload'
import { useImageRefresh } from '@hooks/useImageRefresh'
import { useUploadEvents } from '@hooks/useUploadEvents'
import EmbedCodeInput from '@utils/EmbedCodeInput'
import ExternalLink from '@utils/ExternalLink'
import FormattedDate from '@utils/FormattedDate'
import { Sprout } from 'lucide-react'
import React from 'react'

const UploadSprout = () => {
  // Custom hooks
  const { apiKey, isLoading: apiKeyLoading } = useSproutVideoApiKey()
  const { progress, uploading, message, setProgress, setMessage, setUploading } =
    useUploadEvents()
  const { selectedFile, response, selectFile, uploadFile } = useFileUpload()
  const { thumbnailLoaded, refreshTimestamp, setThumbnailLoaded } =
    useImageRefresh(response)

  // Page label - shadcn breadcrumb component
  useBreadcrumb([
    { label: 'Upload content', href: '/upload/sprout' },
    { label: 'Sprout video' }
  ])

  // Handle upload with API key
  const handleUpload = () => {
    // Reset progress and message before starting upload
    setProgress(0)
    setMessage(null)
    setUploading(true)
    uploadFile(apiKey)
  }

  return (
    <>
      <div className="mb-4 w-full border-b pb-4">
        <h2 className="flex flex-row items-center gap-4 px-4 text-2xl font-semibold">
          <Sprout />
          Upload to SproutVideo
        </h2>
        <div className="mx-4 px-4">
          <div className="mt-4 flex flex-col items-center space-y-4">
            {/* <div className="flex gap-4 mx-auto items-center">
            <h3>Select a Folder</h3>
            {rootFolders.map(folder => (
              <FolderTreeNavigator key={folder.id} apiKey={apiKey} />
            ))}
          </div> */}

            <div>
              <Button onClick={selectFile} className="mb-4 w-full">
                Select Video File
              </Button>
              {selectedFile && (
                <p className="text-muted-foreground text-sm">
                  Selected: {selectedFile.split('/').pop()}
                </p>
              )}

              {uploading && (
                <div className="mt-4">
                  <p className="text-muted-foreground mb-2 text-sm">
                    Uploading: {progress}%
                  </p>
                  <Progress value={progress} />
                </div>
              )}
              <Button
                onClick={handleUpload}
                className="mt-4 w-full"
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
        </div>
      </div>
      <div className="mx-4 mb-4 w-full px-4 py-4">
        {/* Display uploaded video */}
        {response ? (
          <div className="uploaded-clip flex flex-row items-center justify-evenly gap-8">
            <div className="border drop-shadow-xl">
              <ExternalLink url={`https://sproutvideo.com/videos/${response.id}`}>
                {/* Conditionally render placeholder until the image loads */}
                {!thumbnailLoaded && (
                  <div
                    style={{
                      width: '300px',
                      height: 'auto',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    Loading thumbnail...
                  </div>
                )}
                <img
                  // Append the refreshTimestamp as a query param to force re-fetching
                  src={`${response.assets.poster_frames[0]}?t=${refreshTimestamp}`}
                  alt="Video posterframe"
                  onLoad={() => setThumbnailLoaded(true)}
                  // Hide the image until it's loaded
                  style={{
                    display: thumbnailLoaded ? 'block' : 'none',
                    width: '350px'
                  }}
                />
              </ExternalLink>
            </div>
            <div>
              <p className="text-xl font-semibold">{response.title}</p>
              <FormattedDate dateString={response.created_at} />

              <p>{response.duration}</p>
              <EmbedCodeInput embedCode={response.embed_code} />
              <p>{response.embedded_url}</p>
            </div>
          </div>
        ) : (
          ''
        )}
      </div>
    </>
  )
}

export default UploadSprout
