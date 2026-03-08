/**
 * Breadcrumbs Debug Utilities
 *
 * Debug helpers for development - should not be used in production.
 */

import type { BreadcrumbsFile } from '@/types/baker'

import { createNamespacedLogger } from '../logger'
import { compareBreadcrumbs, compareBreadcrumbsMeaningful } from './comparison'

const log = createNamespacedLogger('BreadcrumbsDebug')

/**
 * Debug helper to log comparison results
 * Remove this in production - for debugging only
 */
export function debugComparison(
  current: BreadcrumbsFile | null,
  updated: BreadcrumbsFile
): void {
  log.group('Breadcrumbs Comparison Debug')

  const fullDiff = compareBreadcrumbs(current, updated, true)
  const meaningfulDiff = compareBreadcrumbsMeaningful(current, updated)

  log.log('Current:', current)
  log.log('Updated:', updated)
  log.log('Full Diff:', fullDiff)
  log.log('Meaningful Diff:', meaningfulDiff)

  log.log('Change Analysis:')
  fullDiff.changes.forEach((change) => {
    const isMeaningful = meaningfulDiff.changes.some(
      (mc) => mc.field === change.field && mc.type === change.type
    )
    log.log(
      `  ${change.field}: ${change.type} ${isMeaningful ? 'MEANINGFUL' : 'MAINTENANCE'}`
    )
    if (change.oldValue !== change.newValue) {
      log.log(`    Old: ${JSON.stringify(change.oldValue)}`)
      log.log(`    New: ${JSON.stringify(change.newValue)}`)
    }
  })

  log.groupEnd()
}
