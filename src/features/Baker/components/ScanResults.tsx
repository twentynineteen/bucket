/**
 * Scan Results Component
 *
 * Displays scan progress and results summary for Baker.
 */

import { formatFileSize } from '@shared/utils'
import { RefreshCw } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { ScanResult } from '../types'

interface ScanResultsProps {
  scanResult: ScanResult | null
  isScanning: boolean
  scanStartTime: number | null
}

function formatElapsed(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }
  return `${seconds}s`
}

export const ScanResults: React.FC<ScanResultsProps> = ({
  scanResult,
  isScanning,
  scanStartTime
}) => {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!scanStartTime) {
      return
    }

    const computeElapsed = () => Math.floor((Date.now() - scanStartTime) / 1000)

    const interval = setInterval(() => {
      setElapsed(computeElapsed())
    }, 1000)

    return () => {
      clearInterval(interval)
      setElapsed(0)
    }
  }, [scanStartTime])

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
            <span className="text-muted-foreground text-sm">
              Elapsed: {formatElapsed(elapsed)}
            </span>
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

  // Compute elapsed from backend timestamps
  const elapsedSeconds = scanResult.endTime
    ? Math.round(
        (new Date(scanResult.endTime).getTime() -
          new Date(scanResult.startTime).getTime()) /
          1000
      )
    : null

  // Show results summary after scan
  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
            2
          </div>
          <h2 className="text-foreground text-sm font-semibold">
            {scanResult.validProjects === 0 ? 'No Projects Found' : 'Scan Results'}
          </h2>
        </div>

        {/* Compact stats inline */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Scanned:</span>
            <span className="text-foreground font-semibold">
              {scanResult.totalFolders}
            </span>
          </div>
          {elapsedSeconds !== null && (
            <>
              <div className="bg-border h-3 w-px" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">in</span>
                <span className="text-foreground font-semibold">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            </>
          )}
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
