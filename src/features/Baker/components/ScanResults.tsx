/**
 * Scan Results Component
 *
 * Compact inline scan stats strip shown in the scan toolbar. Displays live
 * progress with an elapsed timer during a scan and a results summary after.
 */

import { RefreshCw } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { ScanResult } from '../types'
import { formatFileSize } from '@shared/utils'

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

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children
}) => (
  <div className="flex items-center gap-1.5 whitespace-nowrap">
    <span className="text-muted-foreground">{label}</span>
    {children}
  </div>
)

const Divider: React.FC = () => <div className="bg-border h-3 w-px flex-shrink-0" />

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

  // Live progress during scan
  if (isScanning) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <RefreshCw className="text-primary h-3.5 w-3.5 flex-shrink-0 animate-spin" />
        <Stat label="Scanning…">
          <span className="text-foreground font-semibold">{scanResult.totalFolders}</span>
          <span className="text-muted-foreground">folders</span>
        </Stat>
        <Divider />
        <Stat label="Projects:">
          <span className="text-foreground font-semibold">
            {scanResult.validProjects}
          </span>
        </Stat>
        <Divider />
        <Stat label="Elapsed:">
          <span className="text-foreground font-semibold">{formatElapsed(elapsed)}</span>
        </Stat>
      </div>
    )
  }

  // Stats after scan completes
  const validBreadcrumbs = scanResult.projects.filter(
    (p) => p.hasBreadcrumbs && !p.invalidBreadcrumbs
  ).length
  const invalidBreadcrumbs = scanResult.projects.filter(
    (p) => p.invalidBreadcrumbs
  ).length
  const missingBreadcrumbs = scanResult.projects.filter(
    (p) => !p.hasBreadcrumbs && !p.invalidBreadcrumbs
  ).length

  const elapsedSeconds = scanResult.endTime
    ? Math.round(
        (new Date(scanResult.endTime).getTime() -
          new Date(scanResult.startTime).getTime()) /
          1000
      )
    : null

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <Stat label="Scanned:">
        <span className="text-foreground font-semibold">{scanResult.totalFolders}</span>
      </Stat>
      {elapsedSeconds !== null && (
        <>
          <Divider />
          <Stat label="in">
            <span className="text-foreground font-semibold">
              {formatElapsed(elapsedSeconds)}
            </span>
          </Stat>
        </>
      )}
      <Divider />
      <Stat label="Projects:">
        <span className="text-success font-semibold">{scanResult.validProjects}</span>
      </Stat>
      <Divider />
      <Stat label="Breadcrumbs:">
        <span className="text-success font-semibold">{validBreadcrumbs}</span>
        {invalidBreadcrumbs > 0 && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-destructive font-semibold">{invalidBreadcrumbs}</span>
          </>
        )}
        {missingBreadcrumbs > 0 && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-warning font-semibold">{missingBreadcrumbs}</span>
          </>
        )}
      </Stat>
      <Divider />
      <Stat label="Size:">
        <span className="text-foreground font-semibold">
          {formatFileSize(scanResult.totalFolderSize)}
        </span>
      </Stat>
      {scanResult.errors.length > 0 && (
        <>
          <Divider />
          <Stat label="Errors:">
            <span className="text-destructive font-semibold">
              {scanResult.errors.length}
            </span>
          </Stat>
        </>
      )}
    </div>
  )
}
