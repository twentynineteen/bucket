/**
 * useBreadcrumbsManager Hook
 *
 * Custom React hook for managing breadcrumbs.json file operations.
 * Handles batch updates, creation, and error management.
 */

import { useCallback, useState } from 'react'

import { bakerUpdateBreadcrumbs } from '../api'
import type { BatchUpdateResult, UseBreadcrumbsManagerResult } from '../types'

export function useBreadcrumbsManager(): UseBreadcrumbsManagerResult {
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdateResult, setLastUpdateResult] = useState<BatchUpdateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateBreadcrumbs = useCallback(
    async (
      projectPaths: string[],
      options: { createMissing: boolean; backupOriginals: boolean }
    ): Promise<BatchUpdateResult> => {
      if (isUpdating) {
        const error = new Error('Update operation already in progress')
        setError(error.message)
        throw error
      }

      if (projectPaths.length === 0) {
        const error = new Error('Project paths array cannot be empty')
        setError(error.message)
        throw error
      }

      setIsUpdating(true)
      setError(null)

      try {
        const result = await bakerUpdateBreadcrumbs(
          projectPaths,
          options.createMissing,
          options.backupOriginals
        )

        setLastUpdateResult(result)
        return result
      } catch (updateError) {
        const errorMessage =
          updateError instanceof Error ? updateError.message : String(updateError)
        setError(errorMessage)
        throw updateError
      } finally {
        setIsUpdating(false)
      }
    },
    [isUpdating]
  )

  const clearResults = useCallback(() => {
    setLastUpdateResult(null)
    setError(null)
  }, [])

  return {
    updateBreadcrumbs,
    isUpdating,
    lastUpdateResult,
    error,
    clearResults
  }
}
