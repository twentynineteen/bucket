/**
 * Scan Results Component
 *
 * Compact inline scan summary. Displays live progress with an elapsed timer
 * during a scan, and afterwards one sentence: how many projects were found, how
 * many need attention, their total size, and what the scan covered.
 *
 * Every figure carries its own words. The previous strip showed breadcrumbs
 * state as three bare numbers told apart only by colour.
 */

import { formatFileSize } from '@shared/utils'
import { RefreshCw } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { needsAttention } from '../internal/projectStatus'
import type { ScanResult } from '../types'

interface ScanResultsProps {
  scanResult: ScanResult | null
  isScanning: boolean
  scanStartTime: number | null
  /** Called when the user clicks the "need attention" count. */
  onShowAttention?: () => void
}

function formatElapsed(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }
  return `${seconds}s`
}

const plural = (count: number, word: string) => `${word}${count !== 1 ? 's' : ''}`

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

const Dot: React.FC = () => (
  <span className="text-muted-foreground/60" aria-hidden="true">
    ·
  </span>
)

/**
 * "6 need attention". With a handler it is a link that filters the project
 * list down to exactly those projects.
 */
const AttentionCount: React.FC<{ count: number; onShow?: () => void }> = ({
  count,
  onShow
}) => {
  const text = `${count} ${count === 1 ? 'needs' : 'need'} attention`
  if (!onShow) {
    return <span className="text-warning font-medium whitespace-nowrap">{text}</span>
  }
  return (
    <button
      type="button"
      onClick={onShow}
      title="Show only the projects that need attention"
      className="text-warning font-medium whitespace-nowrap underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {text}
    </button>
  )
}

export const ScanResults: React.FC<ScanResultsProps> = ({
  scanResult,
  isScanning,
  scanStartTime,
  onShowAttention
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

  // Summary after the scan completes
  const projectCount = scanResult.projects.length
  const attentionCount = scanResult.projects.filter(needsAttention).length

  const elapsedSeconds = scanResult.endTime
    ? Math.round(
        (new Date(scanResult.endTime).getTime() -
          new Date(scanResult.startTime).getTime()) /
          1000
      )
    : null

  return (
    <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="whitespace-nowrap">
        <span className="text-foreground font-semibold">{projectCount}</span>{' '}
        {plural(projectCount, 'project')}
      </span>
      <Dot />
      {attentionCount > 0 ? (
        <AttentionCount count={attentionCount} onShow={onShowAttention} />
      ) : (
        <span className="text-success font-medium whitespace-nowrap">All up to date</span>
      )}
      <Dot />
      <span className="whitespace-nowrap">
        <span className="text-foreground font-semibold">
          {formatFileSize(scanResult.totalFolderSize)}
        </span>{' '}
        in total
      </span>
      <Dot />
      <span className="whitespace-nowrap">
        {scanResult.totalFolders.toLocaleString()}{' '}
        {plural(scanResult.totalFolders, 'folder')} scanned
        {elapsedSeconds !== null && ` in ${formatElapsed(elapsedSeconds)}`}
      </span>
      {scanResult.errors.length > 0 && (
        <>
          <Dot />
          <span className="text-destructive font-medium whitespace-nowrap">
            {scanResult.errors.length} scan {plural(scanResult.errors.length, 'error')}
          </span>
        </>
      )}
    </div>
  )
}
