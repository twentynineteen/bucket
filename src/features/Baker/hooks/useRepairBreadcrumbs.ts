/**
 * useRepairBreadcrumbs Hook
 *
 * Regenerates a project's unparseable breadcrumbs.json from the folder
 * contents (always backing the original up to breadcrumbs.json.bak first).
 */

import { useCallback, useState } from 'react'

import { bakerRepairBreadcrumbs } from '../api'
import type { BreadcrumbsFile } from '../types'

interface UseRepairBreadcrumbsResult {
  repairBreadcrumbs: (projectPath: string) => Promise<BreadcrumbsFile>
  isRepairing: boolean
}

export function useRepairBreadcrumbs(): UseRepairBreadcrumbsResult {
  const [isRepairing, setIsRepairing] = useState(false)

  const repairBreadcrumbs = useCallback(async (projectPath: string) => {
    setIsRepairing(true)
    try {
      return await bakerRepairBreadcrumbs(projectPath)
    } finally {
      setIsRepairing(false)
    }
  }, [])

  return { repairBreadcrumbs, isRepairing }
}
