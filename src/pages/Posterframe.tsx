/**
 * Posterframe Page Component
 *
 * Create custom thumbnails with branded backgrounds and video titles.
 */

import ErrorBoundary from '@components/ErrorBoundary'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@components/ui/select'
import { useAutoFileSelection } from '@hooks/useAutoFileSelection'
import { useBackgroundFolder } from '@hooks/useBackgroundFolder'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useFileSelection } from '@hooks/useFileSelection'
import { usePosterframeAutoRedraw } from '@hooks/usePosterframeAutoRedraw'
import { usePosterframeCanvas } from '@hooks/usePosterframeCanvas'
import { useZoomPan } from '@hooks/useZoomPan'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import {
  AlertTriangle,
  FolderOpen,
  Image,
  Maximize2,
  RefreshCw,
  Save,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'

import { logger } from '@/utils/logger'

const PosterframeContent: React.FC = () => {
  const [videoTitle, setVideoTitle] = useState('')
  const [savePath, setSavePath] = useState<string | null>(null)

  const { files: backgroundFiles, loadFolder } = useBackgroundFolder()
  const { selectedFilePath, selectedFileBlob, selectFile } = useFileSelection()
  const { canvasRef, draw } = usePosterframeCanvas()
  const { zoomLevel, pan, setZoomLevel, setPan } = useZoomPan('posterframe-canvas')

  useBreadcrumb([
    { label: 'Upload content', href: '/upload/posterframe' },
    { label: 'Posterframe' }
  ])

  // Auto-redraw canvas when image or title changes
  usePosterframeAutoRedraw({
    draw,
    imageUrl: selectedFileBlob,
    title: videoTitle
  })

  // Auto-select first file when background files load
  useAutoFileSelection({
    files: backgroundFiles,
    selectedFilePath,
    selectFile,
    criteria: { preferImage: true } // Prefer images for posterframe
  })

  const chooseSavePath = async () => {
    const folder = await open({ directory: true, multiple: false })
    if (typeof folder === 'string') {
      setSavePath(folder)
    }
  }

  const generateThumbnail = async () => {
    if (!canvasRef.current || !savePath || !videoTitle.trim()) {
      toast.error(
        'Please ensure you have selected a background, entered a title, and chosen a save path'
      )
      return
    }

    const canvas = canvasRef.current
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to generate thumbnail')
        return
      }

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const fileName = `posterframe-${videoTitle.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`
      const fullPath = `${savePath}/${fileName}`

      try {
        await writeFile(fullPath, uint8Array)
        toast.success(`Thumbnail saved at: ${fullPath}`)
        invoke('open_folder', { path: savePath })
      } catch (err) {
        logger.error('Save failed:', err)
        toast.error('Error saving file. Please check permissions and try again.')
      }
    }, 'image/jpeg')
  }

  // Canvas zoom and drag logic
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const startCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const startDragging = (e: React.MouseEvent) => {
    if (zoomLevel === 1) return
    setIsDragging(true)
    startCoords.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleDragging = (e: React.MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - startCoords.current.x
    const newY = e.clientY - startCoords.current.y
    setPan({ x: newX, y: newY })
  }

  const stopDragging = () => {
    setIsDragging(false)
  }

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <h1 className="text-foreground text-2xl font-bold">Posterframe</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Create custom thumbnails with branded backgrounds and video titles
          </p>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Two-column layout */}
          <div className="flex gap-4">
            {/* Left Column - Controls (1/3) */}
            <div className="w-1/3 space-y-4">
              {/* Background Selection Card */}
              <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-foreground text-sm font-semibold">
                    Background Selection
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Choose a background image for your posterframe
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() =>
                      open({ directory: true }).then(
                        (path) => typeof path === 'string' && loadFolder(path)
                      )
                    }
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Select Background Folder
                  </Button>

                  {backgroundFiles.length > 0 && (
                    <Select
                      value={selectedFilePath || ''}
                      onValueChange={(path) => selectFile(path)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a background file" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {backgroundFiles.map((file) => (
                          <SelectItem key={file} value={file}>
                            {file.split('/').pop()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Title Configuration Card */}
              <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-foreground text-sm font-semibold">Video Title</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Enter the title text to display on the thumbnail
                  </p>
                </div>

                <Input
                  type="text"
                  placeholder="Enter video title..."
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>

              {/* Export Settings Card */}
              <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-foreground text-sm font-semibold">
                    Export Settings
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Choose destination for the final thumbnail
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={chooseSavePath}
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Choose Save Path
                  </Button>

                  {savePath && (
                    <p className="text-muted-foreground text-xs">
                      Save to: <span className="font-medium">{savePath}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Preview (2/3) */}
            <div className="w-2/3">
              <div className="flex gap-4">
                {/* Canvas Preview with Generate Button */}
                <div className="flex-1 space-y-4">
                  <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
                    <div className="mb-3">
                      <h2 className="text-foreground text-sm font-semibold">
                        Live Preview
                      </h2>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Preview your posterframe with zoom and pan controls
                      </p>
                    </div>

                    {selectedFileBlob ? (
                      <div
                        className="border-border relative overflow-hidden rounded border shadow-sm"
                        style={{
                          width: '100%',
                          maxWidth: '640px',
                          aspectRatio: '16/9',
                          cursor: isDragging
                            ? 'grabbing'
                            : zoomLevel !== 1
                              ? 'grab'
                              : 'default'
                        }}
                        onMouseDown={startDragging}
                        onMouseMove={handleDragging}
                        onMouseUp={stopDragging}
                        onMouseLeave={stopDragging}
                        ref={containerRef}
                      >
                        <div
                          style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                            transformOrigin: 'top left',
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                        >
                          <canvas
                            ref={canvasRef}
                            style={{
                              width: '100%',
                              height: '100%'
                            }}
                            className="w-full rounded"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="border-border bg-muted/20 flex aspect-video w-full max-w-[640px] items-center justify-center rounded border">
                        <p className="text-muted-foreground text-sm italic">
                          Select a background to preview the thumbnail
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Generate Thumbnail Button */}
                  <button
                    onClick={generateThumbnail}
                    disabled={!selectedFileBlob || !savePath || !videoTitle.trim()}
                    className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 text-sm font-medium focus:ring-4 focus:ring-purple-200 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="bg-card text-foreground relative flex w-full items-center justify-center gap-1.5 rounded-md px-5 py-2.5 transition-all duration-75 ease-in group-hover:bg-transparent group-hover:text-white">
                      <Image className="h-3.5 w-3.5" />
                      Generate Thumbnail
                    </span>
                  </button>
                </div>

                {/* Vertical Zoom Controls */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setZoomLevel(1)}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    title="Reset Zoom"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <div className="bg-muted text-muted-foreground mt-2 rounded px-2 py-1 text-center text-xs font-medium">
                    {Math.round(zoomLevel * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Posterframe: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">
              Posterframe Error
            </h2>
            <div className="text-muted-foreground mb-6">
              <p>
                An error occurred while loading the Posterframe page. This could be due
                to:
              </p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• File system access issues</li>
                <li>• Invalid image or canvas rendering</li>
                <li>• Browser compatibility problems</li>
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
                onClick={() => (window.location.href = '/upload/posterframe')}
                variant="outline"
                className="flex-1"
              >
                Back to Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <PosterframeContent />
    </ErrorBoundary>
  )
}

export default Posterframe
