/**
 * Scan Results Component
 *
 * Displays scan progress and results summary for Baker.
 */

import { formatFileSize } from '@utils/breadcrumbsComparison'
import { RefreshCw } from 'lucide-react'
import React from 'react'

import type { ScanResult } from '@/types/baker'

interface ScanResultsProps {
  scanResult: ScanResult | null
  isScanning: boolean
}

export const ScanResults: React.FC<ScanResultsProps> = ({ scanResult, isScanning }) => {
  if (!scanResult) return null

  // Show progress during scan
  if (isScanning) {
    return (
      <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
            2
          </div>
          <h2 className="text-foreground text-sm font-semibold">Scan Results</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Scanning in progress...</p>
            <p className="text-muted-foreground text-sm">
              {scanResult.totalFolders} folders scanned • {scanResult.validProjects}{' '}
              projects found
            </p>
          </div>
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
      </div>
    )
  }

  // Calculate stats
  const validBreadcrumbs = scanResult.projects.filter(
    (p) => p.hasBreadcrumbs && !p.invalidBreadcrumbs
  ).length
  const invalidBreadcrumbs = scanResult.projects.filter(
    (p) => p.invalidBreadcrumbs
  ).length
  const missingBreadcrumbs = scanResult.projects.filter(
    (p) => !p.hasBreadcrumbs && !p.invalidBreadcrumbs
  ).length

  // Show results summary after scan
  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
            2
          </div>
          <h2 className="text-foreground text-sm font-semibold">Scan Results</h2>
        </div>

        {/* Compact stats inline */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Scanned:</span>
            <span className="text-foreground font-semibold">
              {scanResult.totalFolders}
            </span>
          </div>
          <div className="bg-border h-3 w-px" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Projects:</span>
            <span className="text-success font-semibold">{scanResult.validProjects}</span>
          </div>
          <div className="bg-border h-3 w-px" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Breadcrumbs:</span>
            <span className="text-success font-semibold">{validBreadcrumbs}</span>
            {invalidBreadcrumbs > 0 && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive font-semibold">
                  {invalidBreadcrumbs}
                </span>
              </>
            )}
            {missingBreadcrumbs > 0 && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-warning font-semibold">{missingBreadcrumbs}</span>
              </>
            )}
          </div>
          <div className="bg-border h-3 w-px" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Size:</span>
            <span className="text-foreground font-semibold">
              {formatFileSize(scanResult.totalFolderSize)}
            </span>
          </div>
          {scanResult.errors.length > 0 && (
            <>
              <div className="bg-border h-3 w-px" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Errors:</span>
                <span className="text-destructive font-semibold">
                  {scanResult.errors.length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
