import FolderTree from '@components/FolderTree'
import React from 'react'

interface FolderSelectorProps {
  selectedFolder: string
  onSelect: (folder: string) => void
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ selectedFolder, onSelect }) => {
  return (
    <div className="folder-tree mx-auto mt-6">
      <FolderTree onSelect={onSelect} selectedFolder={selectedFolder} />
    </div>
  )
}

export default FolderSelector
