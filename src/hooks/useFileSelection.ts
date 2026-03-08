// Target: @features/Upload
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

interface FileSelectionData {
  selectedFilePath: string | null
  selectedFileBlob: string | null
  isLoading: boolean
  selectFile: (filePath: string) => void
  clearSelection: () => void
}

// Separate hook for managing blob URLs with proper cleanup
function useBlobUrl(filePath: string | null) {
  return useQuery({
    queryKey: ['fileBlob', filePath],
    queryFn: async (): Promise<string | null> => {
      if (!filePath) return null

      const file = await readFile(filePath)
      const blob = new Blob([new Uint8Array(file)], { type: 'image/jpeg' })
      return URL.createObjectURL(blob)
    },
    enabled: !!filePath,
    gcTime: 0,
    staleTime: 0
  })
}

export function useFileSelection(): FileSelectionData {
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: selectedFileBlob, isLoading } = useBlobUrl(selectedFilePath)

  const selectFile = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
  }, [])

  const clearSelection = useCallback(() => {
    // Clean up current blob URL before clearing
    if (selectedFileBlob) {
      URL.revokeObjectURL(selectedFileBlob)
    }
    // Clear the query cache for this path
    queryClient.removeQueries({ queryKey: ['fileBlob', selectedFilePath] })
    setSelectedFilePath(null)
  }, [selectedFileBlob, selectedFilePath, queryClient])

  return {
    selectedFilePath,
    selectedFileBlob: selectedFileBlob ?? null,
    isLoading,
    selectFile,
    clearSelection
  }
}
