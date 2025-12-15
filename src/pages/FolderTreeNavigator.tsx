// FolderTreeNavigator.tsx
import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryError, createQueryOptions, shouldRetry } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { GetFoldersResponse, SproutFolder } from '@utils/types'
import React, { useState } from 'react'

import FolderTreeSprout from './FolderTreeSprout'

interface FolderTreeNavigatorProps {
  apiKey: string
}

const FolderTreeNavigator: React.FC<FolderTreeNavigatorProps> = ({ apiKey }) => {
  const [selectedFolder, setSelectedFolder] = useState<SproutFolder | null>(null)

  // Use React Query to fetch root folders
  const {
    data: rootFolders = [],
    isLoading,
    error
  } = useQuery({
    ...createQueryOptions(
      queryKeys.sprout.folders(apiKey, null), // null for root folders
      async () => {
        try {
          // Fetch folders with no parent (root folders).
          const result = await invoke<GetFoldersResponse>('get_folders', {
            apiKey,
            parent_id: null
          })
          return result.folders
        } catch (error) {
          throw createQueryError(
            `Failed to fetch root folders: ${error}`,
            'SPROUT_FOLDERS_FETCH'
          )
        }
      },
      'DYNAMIC',
      {
        enabled: !!apiKey, // Only run query if apiKey is provided
        staleTime: CACHE.QUICK, // 2 minutes - folder structure doesn't change often
        gcTime: CACHE.GC_STANDARD, // Keep cached for 5 minutes
        retry: (failureCount, error) => shouldRetry(error, failureCount, 'sprout')
      }
    )
  })

  if (isLoading) {
    return (
      <div>
        <h3>Select a Folder</h3>
        <p>Loading folders...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h3>Select a Folder</h3>
        <p>Error loading folders. Please check your API key and try again.</p>
      </div>
    )
  }

  return (
    <div>
      <h3>Select a Folder</h3>
      {/* Render each root folder using the recursive FolderTreeSprout component */}
      {rootFolders.length > 0 ? (
        rootFolders.map((folder) => (
          <FolderTreeSprout
            key={folder.id}
            folder={folder}
            apiKey={apiKey}
            onSelect={(folder) => setSelectedFolder(folder)}
          />
        ))
      ) : (
        <p>No folders found.</p>
      )}
      {selectedFolder && <p>Selected Folder: {selectedFolder.name}</p>}
    </div>
  )
}

export default FolderTreeNavigator
