import { useAppStore } from '@store/useAppStore'
import { useQuery } from '@tanstack/react-query'
import { readDir } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

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

      const dirFiles = await readDir(folderToLoad)
      return dirFiles
        .filter((f) => f.name?.endsWith('.jpg'))
        .map((f) => `${folderToLoad}/${f.name}`)
        .sort((a, b) => a.localeCompare(b))
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
