import { open } from '@tauri-apps/plugin-dialog'
import React from 'react'

import { logger } from '@/utils/logger'

type Props = {
  onSelect: (folderPath: string) => void
  selectedFolder: string
}

// The FolderTree component is used by the BuildTree component
// to select a folder path to move footage and build folders

const FolderTree: React.FC<Props> = ({ onSelect, selectedFolder }) => {
  // Use selectedFolder directly from props instead of syncing to local state
  // This eliminates the need for useEffect and makes the component simpler

  const openFolderPicker = async () => {
    try {
      const result = await open({
        directory: true // This specifies that the picker should be for selecting directories.
      })

      if (result) {
        const newSelectedFolder = result as string // Ensure that `result` is a string path.
        // Notify the parent component of the new folder path.
        onSelect(newSelectedFolder)
      }
    } catch (error) {
      logger.error('Error selecting folder:', error)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg py-2">
      <button
        onClick={openFolderPicker}
        className="text-primary-foreground bg-primary hover:bg-primary/90 focus:ring-ring inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-colors duration-200 hover:shadow focus:ring-4 focus:outline-none"
      >
        Select Destination
      </button>
      {selectedFolder ? (
        <div className="bg-card border-border min-w-0 flex-1 overflow-hidden rounded-lg border px-3 py-2">
          <p
            className="text-foreground truncate text-sm font-medium"
            title={selectedFolder}
          >
            {selectedFolder}
          </p>
        </div>
      ) : (
        <div className="bg-muted/20 border-border min-w-0 flex-1 rounded-lg border border-dashed px-3 py-2">
          <p className="text-muted-foreground text-sm italic">No destination selected</p>
        </div>
      )}
    </div>
  )
}

export default FolderTree
