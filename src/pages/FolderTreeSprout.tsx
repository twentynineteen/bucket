// FolderTreeSprout.tsx
import { invoke } from '@tauri-apps/api/core'
import { GetFoldersResponse, SproutFolder } from '@utils/types'
import React, { useState } from 'react'

import { logger } from '@/utils/logger'

interface FolderTreeSproutProps {
  folder: SproutFolder
  apiKey: string
  onSelect?: (folder: SproutFolder) => void
}

const FolderTreeSprout: React.FC<FolderTreeSproutProps> = ({
  folder,
  apiKey,
  onSelect
}) => {
  // State to track whether the folder is expanded and its children.
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<SproutFolder[] | null>(null)

  // Toggle the folder expansion. On first expansion, fetch subfolders.
  const toggleExpand = async () => {
    // If not expanded and children have not been loaded, fetch subfolders.
    if (!expanded && !children) {
      try {
        // Call the Tauri command "get_folders" with the current folder's ID as parent_id.
        const result = await invoke<GetFoldersResponse>('get_folders', {
          apiKey,
          parent_id: folder.id
        })
        setChildren(result.folders)
      } catch (error) {
        logger.error('Error fetching subfolders:', error)
      }
    }
    setExpanded(!expanded)
    // Optionally notify the parent component of a folder selection.
    if (onSelect) {
      onSelect(folder)
    }
  }

  return (
    <div style={{ marginLeft: '20px' }}>
      {/* Render folder name as clickable element */}
      <div onClick={toggleExpand} style={{ cursor: 'pointer' }}>
        {folder.name}
      </div>
      {/* If expanded and subfolders have been loaded, recursively render them */}
      {expanded && children && (
        <div style={{ paddingLeft: '20px' }}>
          {children.map((child) => (
            <FolderTreeSprout
              key={child.id}
              folder={child}
              apiKey={apiKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default FolderTreeSprout
