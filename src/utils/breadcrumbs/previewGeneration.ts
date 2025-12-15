/**
 * Breadcrumbs Preview Generation
 *
 * Functions for generating breadcrumbs preview data.
 */

import type { BreadcrumbsFile, BreadcrumbsPreview } from '@/types/baker'

import { compareBreadcrumbs, compareBreadcrumbsMeaningful } from './comparison'
import { debugComparison } from './debug'
import { generateProjectChangeDetail } from './fieldCategorization'

/**
 * Generate a preview of what Baker will update
 */
export function generateBreadcrumbsPreview(
  current: BreadcrumbsFile | null,
  projectPath: string,
  projectData: {
    files: Array<{ camera: number; name: string; path: string }>
    cameraCount: number
  }
): BreadcrumbsPreview {
  const now = new Date().toISOString()

  // Generate what Baker would create/update
  const updated: BreadcrumbsFile = current
    ? {
        ...current,
        files: projectData.files,
        numberOfCameras: projectData.cameraCount,
        // Update createdBy format if it's an update
        createdBy: current.createdBy.endsWith(' - updated by Baker')
          ? current.createdBy
          : `${current.createdBy} - updated by Baker`,
        lastModified: now,
        scannedBy: 'Baker',
        // Add folder size if missing
        folderSizeBytes: current.folderSizeBytes || undefined
      }
    : {
        // New breadcrumbs file
        projectTitle: projectPath.split('/').pop() || 'Unknown Project',
        numberOfCameras: projectData.cameraCount,
        files: projectData.files,
        parentFolder: projectPath.split('/').slice(0, -1).join('/'),
        createdBy: 'Baker',
        creationDateTime: now,
        folderSizeBytes: undefined,
        lastModified: now,
        scannedBy: 'Baker'
      }

  // Generate full diff for preview display (includes maintenance fields)
  const fullDiff = compareBreadcrumbs(current, updated, true)

  // Generate meaningful diff for determining if changes actually matter
  const meaningfulDiff = compareBreadcrumbsMeaningful(current, updated)

  // Generate detailed change information
  const detailedChanges = generateProjectChangeDetail(projectPath, fullDiff)

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    debugComparison(current, updated)
  }

  return {
    current,
    updated,
    diff: fullDiff,
    meaningfulDiff,
    detailedChanges
  }
}
