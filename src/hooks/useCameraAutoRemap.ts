import { CACHE } from '@constants/timing'
import { queryKeys } from '@lib/query-keys'
import { createQueryOptions } from '@lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

export interface FootageFile {
  file: {
    path: string
    name: string
  }
  camera: number
}

export function useCameraAutoRemap(
  files: FootageFile[],
  numCameras: number,
  setFiles: (updated: FootageFile[]) => void
) {
  // Create a unique query key based on files and camera count for memoization
  const filesHash = useMemo(
    () => JSON.stringify(files.map((f) => ({ path: f.file.path, camera: f.camera }))),
    [files]
  )

  // Use React Query to compute and cache the remapped files
  const { data: remappedFiles } = useQuery({
    ...createQueryOptions(
      queryKeys.camera.autoRemap(`${filesHash}-${numCameras}`),
      async () => {
        if (files.length === 0) return files

        const hasInvalidCameras = files.some(
          (file) => file.camera > numCameras || file.camera < 1
        )

        if (!hasInvalidCameras) return files

        // Return remapped files with invalid cameras set to 1
        return files.map((file) => ({
          ...file,
          camera: file.camera > numCameras || file.camera < 1 ? 1 : file.camera
        }))
      },
      'STATIC', // Use static profile for computed values
      {
        staleTime: Infinity, // Never stale - only updates when inputs change
        gcTime: CACHE.GC_STANDARD // Keep cached for 5 minutes
      }
    )
  })

  // Apply remapped files when they change
  useEffect(() => {
    if (remappedFiles && remappedFiles !== files) {
      const needsUpdate = remappedFiles.some(
        (file, index) => !files[index] || file.camera !== files[index].camera
      )

      if (needsUpdate) {
        setFiles(remappedFiles)
      }
    }
  }, [remappedFiles, files, setFiles])
}
