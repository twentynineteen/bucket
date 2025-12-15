// components/BuildProject/ProjectFileList.tsx

import { FILE_LIST_ANIMATION } from '@constants/animations'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Film, Trash2, Video } from 'lucide-react'
import React from 'react'

// Threshold for enabling virtual scrolling (performance optimization for large lists)
const VIRTUAL_SCROLLING_THRESHOLD = 50

interface FootageFile {
  file: {
    name: string
    path: string
  }
  camera: number
}

interface ProjectFileListProps {
  files: FootageFile[]
  numCameras: number
  onUpdateCamera: (index: number, camera: number) => void
  onDeleteFile: (index: number) => void
}

interface FileListItemProps {
  item: FootageFile
  index: number
  numCameras: number
  onUpdateCamera: (index: number, camera: number) => void
  onDeleteFile: (index: number) => void
}

/**
 * Memoized list item component to prevent unnecessary re-renders.
 * Only re-renders when its specific item data or callbacks change.
 */
const FileListItem = React.memo<FileListItemProps>(
  ({ item, index, numCameras, onUpdateCamera, onDeleteFile }) => {
    return (
      <div
        key={`${item.file.path}-${index}`}
        className="group bg-card border-border relative w-full max-w-full rounded-lg border p-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
        style={{
          animation: `${FILE_LIST_ANIMATION.name} ${FILE_LIST_ANIMATION.duration}ms ${FILE_LIST_ANIMATION.easing} ${index * FILE_LIST_ANIMATION.staggerDelay}ms both`
        }}
      >
        {/* File Icon and Info */}
        <div className="flex w-full max-w-full min-w-0 items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            <div className="bg-primary/10 rounded-md p-2">
              <Video className="text-primary h-5 w-5" />
            </div>
          </div>

          <div
            className="min-w-0 flex-1 overflow-hidden"
            style={{ maxWidth: '100%', width: 0 }}
          >
            {/* File Name */}
            <h4
              className="text-foreground mb-1 truncate text-sm font-semibold"
              title={item.file.name}
            >
              {item.file.name}
            </h4>
            {/* File Path */}
            <p
              className="text-muted-foreground truncate text-xs italic"
              title={item.file.path}
            >
              {item.file.path}
            </p>
          </div>

          {/* Camera Selector & Delete Button */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Camera Badge/Selector */}
            <select
              aria-label={`Select camera for ${item.file.name}`}
              className="border-input bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-ring cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors focus:ring-2 focus:outline-none"
              value={item.camera}
              onChange={(e) => onUpdateCamera(index, Number(e.target.value))}
            >
              {Array.from({ length: numCameras }, (_, i) => i + 1).map((cam) => (
                <option key={cam} value={cam}>
                  Camera {cam}
                </option>
              ))}
            </select>

            {/* Delete Button */}
            <button
              onClick={() => onDeleteFile(index)}
              aria-label={`Delete ${item.file.name}`}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-2 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
)

FileListItem.displayName = 'FileListItem'

const ProjectFileList: React.FC<ProjectFileListProps> = ({
  files,
  numCameras,
  onUpdateCamera,
  onDeleteFile
}) => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  // Determine if we should use virtual scrolling based on list size
  const useVirtualScroll = files.length >= VIRTUAL_SCROLLING_THRESHOLD

  // Initialize virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each item in pixels
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
    enabled: useVirtualScroll,
    // Provide initial measurements for test environment
    initialRect: { width: 800, height: 600 }
  })

  // Empty state
  if (files.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-6">
        <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6">
          <div className="bg-muted mb-3 rounded-full p-3">
            <Film className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="text-foreground mb-1 text-sm font-semibold">
            No files selected yet
          </h3>
          <p className="text-muted-foreground text-center text-xs">
            Click &quot;Select Files&quot; to add footage to your project
          </p>
        </div>
      </div>
    )
  }

  // Render with virtual scrolling for large lists (50+ items)
  if (useVirtualScroll) {
    const items = virtualizer.getVirtualItems()

    return (
      <div
        ref={parentRef}
        className="w-full max-w-full overflow-auto"
        style={{ height: '600px' }}
        data-virtual-container
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {items.map((virtualItem) => {
            const item = files[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                  marginBottom: '8px'
                }}
              >
                <FileListItem
                  item={item}
                  index={virtualItem.index}
                  numCameras={numCameras}
                  onUpdateCamera={onUpdateCamera}
                  onDeleteFile={onDeleteFile}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render normally for small lists (< 50 items) with animations
  return (
    <div className="w-full max-w-full space-y-2">
      {files.map((item, idx) => (
        <FileListItem
          key={`${item.file.path}-${idx}`}
          item={item}
          index={idx}
          numCameras={numCameras}
          onUpdateCamera={onUpdateCamera}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </div>
  )
}

export default ProjectFileList
