/**
 * Quality Control page (issue #180, stages 1-2)
 *
 * Stage 1 established the page and its prerequisite reporting. Stage 2 adds the
 * watermark check: pick a render, run it, watch the phases, read the report.
 *
 * The report's failure thumbnails are held in memory and nothing is written to
 * disk unless the operator uses "Save evidence…" (D15). The tail and sting checks
 * arrive in stage 3, which is why the verdict here is about the watermark alone
 * and the report says out loud that the checked span was approximated.
 */

import { useApiKeys, useBreadcrumb } from '@shared/hooks'
import { Button } from '@shared/ui/button'
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'
import { logger } from '@shared/utils'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import { pickEvidenceFolder, pickVideoFile, saveQcEvidence } from '../api'
import { useQcAvailability } from '../hooks/useQcAvailability'
import { useWatermarkCheck } from '../hooks/useWatermarkCheck'
import { asQcError } from '../internal/qcError'
import { REFERENCE_POOLS, type ReferencePoolStatus } from '../internal/referencePool'
import {
  bytesToBase64,
  cornerLabel,
  evidencePrefix,
  formatTime,
  phaseLabel
} from '../internal/reportFormatting'
import type { QcError, QcProgressEvent, QcThumbnail, QcWatermarkReport } from '../types'

const QualityControlContent: React.FC = () => {
  useBreadcrumb([
    { label: 'Upload content', href: '/upload/sprout' },
    { label: 'Quality control' }
  ])

  const { available, reason, pending, pools, poolFiles } = useQcAvailability()
  const { data: settings } = useApiKeys()
  const { isRunning, progress, report, error, run, cancel, reset } = useWatermarkCheck()

  const [videoPath, setVideoPath] = React.useState<string | null>(null)

  const chooseVideo = async () => {
    const chosen = await pickVideoFile()
    if (!chosen) return
    setVideoPath(chosen)
    // A new file makes the previous report meaningless, and leaving it on screen
    // beside a different filename is how someone signs off the wrong render.
    reset()
  }

  const start = () => {
    if (!videoPath) return
    void run({
      videoPath,
      referenceFiles: poolFiles.watermarks,
      ffmpegDirectory: settings?.ffmpegDirectory ?? null,
      matchThreshold: settings?.qcMatchThreshold
    })
  }

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <h1 className="text-foreground text-2xl font-bold">Quality control</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Check that a render carries its watermark throughout, and closes with a dip to
            white into an approved logo sting.
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <PrerequisitesSection
            pending={pending}
            available={available}
            reason={reason}
            pools={pools}
          />

          <section aria-labelledby="qc-render" className="space-y-3">
            <h2 id="qc-render" className="text-foreground text-sm font-semibold">
              Render to check
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={chooseVideo} disabled={isRunning} variant="outline">
                Choose video…
              </Button>
              <Button onClick={start} disabled={!available || !videoPath || isRunning}>
                Run quality control
              </Button>
              {isRunning && (
                <Button onClick={() => void cancel()} variant="outline">
                  Cancel
                </Button>
              )}
            </div>

            {videoPath ? (
              <p className="text-muted-foreground text-xs break-all">{videoPath}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                No render chosen yet. ffmpeg decides what it can decode, so any format it
                supports is accepted.
              </p>
            )}

            {isRunning && <RunProgress progress={progress} />}
            {error && <RunFailure error={error} />}
          </section>

          {report && <WatermarkReportView report={report} videoPath={videoPath} />}
        </div>
      </div>
    </div>
  )
}

/** ffmpeg and both reference pools, and what to do when one is missing. */
const PrerequisitesSection: React.FC<{
  pending: boolean
  available: boolean
  reason: string | null
  pools: Record<
    'watermarks' | 'stings',
    { status: ReferencePoolStatus; reason: string | null }
  >
}> = ({ pending, available, reason, pools }) => (
  <section aria-labelledby="qc-prerequisites">
    <h2 id="qc-prerequisites" className="text-foreground mb-3 text-sm font-semibold">
      Prerequisites
    </h2>

    {pending ? (
      <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking ffmpeg and reference images…
      </p>
    ) : available ? (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
        ffmpeg and both reference pools are ready.
      </p>
    ) : (
      <div
        role="alert"
        className="border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-md border p-3 text-sm"
      >
        <AlertTriangle
          className="text-destructive mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <span className="text-foreground">{reason}</span>
      </div>
    )}

    {/* Both pools are listed regardless, so a second fault is visible without
        having to fix the first one to discover it. */}
    <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
      {REFERENCE_POOLS.map((pool) => (
        <div key={pool} className="border-border rounded-md border p-3">
          <dt className="text-foreground font-medium capitalize">{pool}</dt>
          <dd className="text-muted-foreground mt-0.5">
            {pools[pool].reason ?? poolReadyLabel(pools[pool].status)}
          </dd>
        </div>
      ))}
    </dl>
  </section>
)

/** Phase and percentage for the run in flight. */
const RunProgress: React.FC<{ progress: QcProgressEvent | null }> = ({ progress }) => (
  <div role="status" className="space-y-1">
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {progress ? `${phaseLabel(progress.phase)}: ${progress.detail}` : 'Starting…'}
    </p>
    <div
      role="progressbar"
      aria-valuenow={Math.round(progress?.percentage ?? 0)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-muted h-1.5 w-full max-w-md overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full transition-all"
        style={{ width: `${progress?.percentage ?? 0}%` }}
      />
    </div>
  </div>
)

/** Why a run did not produce a report. */
const RunFailure: React.FC<{ error: QcError }> = ({ error }) => (
  <div
    role="alert"
    className="border-destructive/40 bg-destructive/10 space-y-1 rounded-md border p-3 text-sm"
  >
    <p className="text-foreground flex items-start gap-2">
      <AlertTriangle
        className="text-destructive mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{error.message}</span>
    </p>
    {/* ffmpeg's own words, size-limited, because "could not decode" tells nobody
        which codec is missing (B11.3, B12.2). */}
    {error.kind === 'ffmpeg' && error.stderr.trim() !== '' && (
      <pre className="text-muted-foreground max-h-40 overflow-auto text-xs whitespace-pre-wrap">
        {error.stderr}
      </pre>
    )}
  </div>
)

/** The report for one completed run. */
const WatermarkReportView: React.FC<{
  report: QcWatermarkReport
  videoPath: string | null
}> = ({ report, videoPath }) => {
  const passed = report.outcome === 'pass'

  return (
    <section aria-labelledby="qc-report" className="space-y-4">
      <h2 id="qc-report" className="text-foreground text-sm font-semibold">
        Watermark report
      </h2>

      <div
        className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
          passed
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-destructive/40 bg-destructive/10'
        }`}
      >
        {passed ? (
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-500"
            aria-hidden="true"
          />
        ) : (
          <XCircle
            className="text-destructive mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
        )}
        <div className="text-foreground">
          <p className="font-medium">
            {passed
              ? `Watermark present throughout, ${cornerLabel(report.corner)}.`
              : 'Watermark check failed.'}
          </p>
          {/*
            The scores are shown whatever the verdict. Two real renders with equally
            visible watermarks score 0.983 and 0.389 through the same code, so a bare
            pass or fail turns a threshold argument into an unanswerable one. The
            closest reference is named even when nothing matched: that is how a
            wrong-resolution watermark is told apart from a missing one.
          */}
          <p className="text-muted-foreground mt-0.5 text-xs">
            {report.matchedSamples} of {report.coarseSamples} samples matched
            {report.matchedReference
              ? ` against ${report.matchedReference}`
              : report.bestReference
                ? `. Closest reference ${report.bestReference}`
                : ''}
            . Confidence {report.weakestConfidence.toFixed(4)} to{' '}
            {report.bestConfidence.toFixed(4)} against a threshold of{' '}
            {report.threshold.toFixed(3)}
            {report.thresholdIsDefault ? '' : ' (overridden)'}.
          </p>
        </div>
      </div>

      {report.gaps.length > 0 && (
        <div>
          <h3 className="text-foreground mb-1 text-xs font-semibold">
            Missing watermark
          </h3>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {report.gaps.map((gap) => (
              <li key={`${gap.startSeconds}-${gap.endSeconds}`}>
                {formatTime(gap.startSeconds)} to {formatTime(gap.endSeconds)} (
                {(gap.endSeconds - gap.startSeconds).toFixed(1)}s), best score{' '}
                {gap.bestConfidence.toFixed(4)}
                {gap.bestReference ? ` against ${gap.bestReference}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.cornerChanges.length > 0 && (
        <div>
          <h3 className="text-foreground mb-1 text-xs font-semibold">Corner changed</h3>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {report.cornerChanges.map((change) => (
              <li key={change.atSeconds}>
                {formatTime(change.atSeconds)}: expected {cornerLabel(change.expected)},
                found {cornerLabel(change.found)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.notes.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {report.notes.map((note, index) => (
            <li key={`${index}-${note.slice(0, 24)}`}>{note}</li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">
        Checked {formatTime(report.span.startSeconds)} to{' '}
        {formatTime(report.span.endSeconds)} of a{' '}
        {formatTime(report.video.durationSeconds)} render at {report.video.width}x
        {report.video.height}, against {report.referencesUsed} reference
        {report.referencesUsed === 1 ? '' : 's'}.
      </p>

      {report.thumbnails.length > 0 && (
        <EvidenceView thumbnails={report.thumbnails} videoPath={videoPath} />
      )}
    </section>
  )
}

/** Failure thumbnails, and the one action that puts them on disk. */
const EvidenceView: React.FC<{
  thumbnails: QcThumbnail[]
  videoPath: string | null
}> = ({ thumbnails, videoPath }) => {
  const [saving, setSaving] = React.useState(false)

  // Rebuilt only when the bytes change: every render would otherwise leak an
  // object URL per thumbnail for as long as the page is open.
  const sources = React.useMemo(
    () =>
      thumbnails.map(
        (thumbnail) =>
          `data:image/jpeg;base64,${bytesToBase64(Uint8Array.from(thumbnail.jpeg))}`
      ),
    [thumbnails]
  )

  const save = async () => {
    const folder = await pickEvidenceFolder()
    if (!folder) return

    setSaving(true)
    try {
      const written = await saveQcEvidence(folder, evidencePrefix(videoPath), thumbnails)
      toast.success(
        `Saved ${written.length} frame${written.length === 1 ? '' : 's'} to ${folder}`
      )
    } catch (raised) {
      const failure = asQcError(raised)
      logger.error('QC evidence could not be saved:', failure.message)
      toast.error(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-foreground text-xs font-semibold">Evidence</h3>
        <Button
          onClick={() => void save()}
          disabled={saving}
          variant="outline"
          className="h-7 px-2 text-xs"
        >
          Save evidence…
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Held in memory only. Nothing is written to disk until you save it.
      </p>
      <ul className="flex flex-wrap gap-3">
        {thumbnails.map((thumbnail, index) => (
          // Indexed, because two failures rounding to the same tenth of a second
          // would produce the same label and React would drop one of them.
          <li key={`${index}-${thumbnail.label}`} className="space-y-1">
            <img
              src={sources[index]}
              alt={`Frame at ${formatTime(thumbnail.atSeconds)} where the watermark check failed`}
              className="border-border max-w-48 rounded border"
            />
            <p className="text-muted-foreground text-xs">
              {formatTime(thumbnail.atSeconds)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Wording for a pool with no reason to report — only `ready`, `loading` and
 * `unknown` reach here, since every other status carries its own reason. Typed
 * to the status union so a new status cannot silently render as "Checking…".
 */
function poolReadyLabel(status: ReferencePoolStatus): string {
  return status === 'ready' ? 'Ready' : 'Checking…'
}

const QualityControlPage: React.FC = () => (
  <ErrorBoundary>
    <QualityControlContent />
  </ErrorBoundary>
)

export default QualityControlPage
