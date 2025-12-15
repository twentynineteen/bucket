import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryOptions } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

interface AutoFileSelectionProps {
  files: string[]
  selectedFilePath: string | null
  selectFile: (filePath: string) => void
  criteria?: Record<string, unknown>
}

interface AutoFileSelectionReturn {
  suggestedFile: string | null
  isAnalyzing: boolean
  applySuggestion: () => void
}

export function useAutoFileSelection({
  files,
  selectedFilePath,
  selectFile,
  criteria = {}
}: AutoFileSelectionProps): AutoFileSelectionReturn {
  const queryKey = queryKeys.files.autoSelection(criteria)

  const { data: suggestedFile, isLoading: isAnalyzing } = useQuery(
    createQueryOptions(
      queryKey,
      async (): Promise<string | null> => {
        if (files.length === 0) return null

        // If no file is selected and we have files, suggest the first one
        if (!selectedFilePath && files.length > 0) {
          // Auto-selection logic based on criteria
          if (criteria.preferVideo) {
            const videoFiles = files.filter((file) => /\.(mp4|mov|avi|mkv)$/i.test(file))
            if (videoFiles.length > 0) {
              selectFile(videoFiles[0])
              return videoFiles[0]
            }
          }

          if (criteria.preferImage) {
            const imageFiles = files.filter((file) =>
              /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
            )
            if (imageFiles.length > 0) {
              selectFile(imageFiles[0])
              return imageFiles[0]
            }
          }

          // Default to first file and auto-select it
          selectFile(files[0])
          return files[0]
        }

        return selectedFilePath
      },
      'DYNAMIC',
      {
        enabled: files.length > 0,
        staleTime: CACHE.SHORT, // Re-analyze after 30 seconds if files change
        refetchOnWindowFocus: false
      }
    )
  )

  const applySuggestion = useCallback(() => {
    if (suggestedFile) {
      selectFile(suggestedFile)
    }
  }, [suggestedFile, selectFile])

  return {
    suggestedFile,
    isAnalyzing,
    applySuggestion
  }
}
