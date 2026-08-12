/**
 * Quality Control page (issue #180, stage 1)
 *
 * Stage 1 establishes the page and its prerequisite reporting: ffmpeg discovery
 * and the two reference pools. The checks themselves arrive in stages 2 and 3,
 * so the run action is present but not yet wired to an analysis.
 *
 * The point of this stage is that a user who cannot run QC is told exactly which
 * of the three prerequisites to fix, rather than being shown a dead button.
 */

import { useBreadcrumb } from '@shared/hooks'
import { Button } from '@shared/ui/button'
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import React from 'react'

import { useQcAvailability } from '../hooks/useQcAvailability'
import { REFERENCE_POOLS, type ReferencePoolStatus } from '../internal/referencePool'

const QualityControlContent: React.FC = () => {
  useBreadcrumb([
    { label: 'Upload content', href: '/upload/sprout' },
    { label: 'Quality control' }
  ])

  const { available, reason, pending, pools } = useQcAvailability()

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
          <section aria-labelledby="qc-prerequisites">
            <h2
              id="qc-prerequisites"
              className="text-foreground mb-3 text-sm font-semibold"
            >
              Prerequisites
            </h2>

            {pending ? (
              <p
                role="status"
                className="text-muted-foreground flex items-center gap-2 text-sm"
              >
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

            {/* Both pools are listed regardless, so a second fault is visible
                without having to fix the first one to discover it. */}
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

          <Button disabled={!available}>Run quality control</Button>
        </div>
      </div>
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
