/**
 * useRefreshBreadcrumbSizes Hook
 *
 * Custom React hook for the size-only breadcrumbs update: recalculates each
 * project's folder size on disk and rewrites ONLY the folderSizeBytes and
 * lastModified fields of its breadcrumbs.json. All other fields are preserved.
 */

import { useCallback, useState } from 'react'

import { bakerUpdateBreadcrumbsSizes } from '../api'
import type { BatchUpdateResult } from '../types'

export interface UseRefreshBreadcrumbSizesResult {
  refreshSizes: (projectPaths: string[]) => Promise<BatchUpdateResult>
  isRefreshing: boolean
  lastRefreshResult: BatchUpdateResult | null
  error: string | null
  clearResults: () => void
}

export function useRefreshBreadcrumbSizes(): UseRefreshBreadcrumbSizesResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshResult, setLastRefreshResult] = useState<BatchUpdateResult | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const refreshSizes = useCallback(
    async (projectPaths: string[]): Promise<BatchUpdateResult> => {
      if (isRefreshing) {
        const error = new Error('Size refresh already in progress')
        setError(error.message)
        throw error
      }

      if (projectPaths.length === 0) {
        const error = new Error('Project paths array cannot be empty')
        setError(error.message)
        throw error
      }

      setIsRefreshing(true)
      setError(null)

      try {
        const result = await bakerUpdateBreadcrumbsSizes(projectPaths)
        setLastRefreshResult(result)
        return result
      } catch (refreshError) {
        const errorMessage =
          refreshError instanceof Error ? refreshError.message : String(refreshError)
        setError(errorMessage)
        throw refreshError
      } finally {
        setIsRefreshing(false)
      }
    },
    [isRefreshing]
  )

  const clearResults = useCallback(() => {
    setLastRefreshResult(null)
    setError(null)
  }, [])

  return {
    refreshSizes,
    isRefreshing,
    lastRefreshResult,
    error,
    clearResults
  }
}
