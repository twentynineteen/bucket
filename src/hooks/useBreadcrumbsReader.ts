/**
 * useBreadcrumbsReader Hook
 *
 * Custom React hook for reading and displaying breadcrumbs.json files.
 */

import { invoke } from '@tauri-apps/api/core'
import { useCallback, useState } from 'react'

import type { BreadcrumbsFile } from '@/types/baker'

interface UseBreadcrumbsReaderResult {
  breadcrumbs: BreadcrumbsFile | null
  isLoading: boolean
  error: string | null
  readBreadcrumbs: (projectPath: string) => Promise<void>
  clearBreadcrumbs: () => void
}

export function useBreadcrumbsReader(): UseBreadcrumbsReaderResult {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbsFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readBreadcrumbs = useCallback(async (projectPath: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await invoke<BreadcrumbsFile | null>('baker_read_breadcrumbs', {
        projectPath
      })

      setBreadcrumbs(result)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to read breadcrumbs file'
      setError(errorMessage)
      setBreadcrumbs(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearBreadcrumbs = useCallback(() => {
    setBreadcrumbs(null)
    setError(null)
  }, [])

  return {
    breadcrumbs,
    isLoading,
    error,
    readBreadcrumbs,
    clearBreadcrumbs
  }
}
