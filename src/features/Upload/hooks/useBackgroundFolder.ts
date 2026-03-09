import { useAppStore } from '@shared/store'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { listDirectory } from '../api'

interface BackgroundFolderData {
  files: string[]
  currentFolder: string | null
  isLoading: boolean
  loadFolder: (folderPath: string) => Promise<void>
  defaultFolder: string | null
}

export function useBackgroundFolder(): BackgroundFolderData {
  const defaultFolder = useAppStore((state) => state.defaultBackgroundFolder)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)

  // Determine which folder to load (current folder takes precedence over default)
  const folderToLoad = currentFolder || defaultFolder

  const {
    data: files = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['backgroundFolder', folderToLoad],
    queryFn: async () => {
      if (!folderToLoad) return []

      // listDirectory already filters for image files and returns sorted paths
      return listDirectory(folderToLoad)
    },
    enabled: !!folderToLoad
  })

  const loadFolder = useCallback(
    async (folderPath: string) => {
      setCurrentFolder(folderPath)
      refetch()
    },
    [refetch]
  )

  return {
    files,
    currentFolder: folderToLoad,
    isLoading,
    loadFolder,
    defaultFolder
  }
}
