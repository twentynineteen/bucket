/**
 * Quality Control Settings Section (issue #180)
 *
 * Configures the two things QC needs from the user: the reference folder holding
 * the watermark and sting pools, and an optional ffmpeg location for machines
 * where the binaries are not in a standard place.
 *
 * The live detection result is surfaced here as well as on the QC page, because
 * Settings is where someone comes to fix it.
 */
import { useQcAvailability } from '@features/QualityControl'
import { QC_THRESHOLDS, validateMatchConfidence } from '@shared/constants'
import { createQueryError, queryKeys } from '@shared/lib'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { logger } from '@shared/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { ApiKeys } from '../api'
import { directoryExists, openFolderPicker, saveSettingsApiKeys } from '../api'

interface QualityControlSectionProps {
  apiKeys: ApiKeys
  /**
   * The settings file could not be read, so `apiKeys` is the empty fallback.
   * Saving is blocked while this holds: every section writes
   * `{...apiKeys, ...newKeys}`, so one save would overwrite a file that is
   * merely unparseable and destroy the credentials still in it (#166 B8.4).
   */
  settingsUnavailable?: boolean
}

const QualityControlSection: React.FC<QualityControlSectionProps> = ({
  apiKeys,
  settingsUnavailable = false
}) => {
  const queryClient = useQueryClient()

  // Staged locally rather than in the app store: nothing outside QC reads these,
  // and the saved file is the only source the QC hooks consult.
  const [referenceFolder, setReferenceFolder] = React.useState<string | null>(
    apiKeys.qcReferenceFolder ?? null
  )
  const [ffmpegDirectory, setFfmpegDirectory] = React.useState<string | null>(
    apiKeys.ffmpegDirectory ?? null
  )
  // Held as the raw string so an invalid entry can be shown back to the operator
  // as they typed it, rather than as whatever a number coercion made of it.
  const [matchThreshold, setMatchThreshold] = React.useState<string>(
    apiKeys.qcMatchThreshold !== undefined ? String(apiKeys.qcMatchThreshold) : ''
  )
  const thresholdProblem = validateMatchConfidence(matchThreshold)

  const { reason, available, pending } = useQcAvailability()

  // Checks the path on display rather than only the saved one, so what the user
  // is looking at is what gets verified.
  const { data: folderPresent } = useQuery({
    queryKey: queryKeys.qc.referenceFolderPresent(referenceFolder),
    queryFn: async () => {
      if (!referenceFolder) return true
      return directoryExists(referenceFolder)
    },
    enabled: !!referenceFolder,
    retry: false
  })

  const saveMutation = useMutation({
    mutationFn: async (newKeys: Partial<ApiKeys>) => {
      try {
        await saveSettingsApiKeys({ ...apiKeys, ...newKeys })
        return { ...apiKeys, ...newKeys }
      } catch (error) {
        throw createQueryError(`Failed to save API keys: ${error}`, 'SETTINGS_SAVE')
      }
    },
    onSuccess: (updatedKeys) => {
      queryClient.setQueryData(queryKeys.settings.apiKeys(), updatedKeys)
    }
  })

  /** Saves one field, reporting a failure rather than showing a false success. */
  const save = async (newKeys: Partial<ApiKeys>, label: string) => {
    try {
      await saveMutation.mutateAsync(newKeys)
    } catch (error) {
      logger.error(`Failed to save ${label}:`, error)
      toast.error(`Could not save your ${label}. Please try again.`)
    }
  }

  const chooseReferenceFolder = async () => {
    const folder = await openFolderPicker()
    if (folder) setReferenceFolder(folder)
  }

  const chooseFfmpegFolder = async () => {
    const folder = await openFolderPicker()
    if (folder) setFfmpegDirectory(folder)
  }

  return (
    <section
      id="quality-control"
      className="border-border scroll-mt-16 space-y-4 rounded-lg border p-6"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">Quality control</h3>
        <p className="text-muted-foreground text-sm">
          Reference images and ffmpeg location for video QC checks
        </p>
      </div>

      {/* Live prerequisite state, so this page can be used to fix it. */}
      {!pending && (
        <div className="text-sm">
          {available ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
              Video QC is ready to run.
            </p>
          ) : (
            <p role="alert" className="text-destructive flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{reason}</span>
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">QC reference folder</label>
        <p className="text-muted-foreground mb-2 text-xs">
          Must contain <code>Watermarks</code> and <code>Stings</code> subfolders. Nested
          subfolders are searched too, so resolution variants can live inside.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={chooseReferenceFolder} className="rounded border px-3 py-1">
            Choose reference folder
          </Button>
          <Button
            onClick={() =>
              save(
                { qcReferenceFolder: referenceFolder ?? undefined },
                'reference folder'
              )
            }
            disabled={settingsUnavailable}
            className="rounded border px-3 py-1"
          >
            Save reference folder
          </Button>
        </div>
        {referenceFolder && (
          <p className="text-muted-foreground mt-1 text-sm">{referenceFolder}</p>
        )}
        {referenceFolder && folderPresent === false && (
          <p className="text-destructive mt-1 flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {/*
              Worded to be true whether the folder is absent or present but
              unreadable: a TCC denial makes the probe fail without the folder
              having moved, so asserting absence would misattribute it (#166).
            */}
            <span>
              Bucket cannot read this folder. It may have moved, or be on a drive that is
              not connected.
            </span>
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          ffmpeg location <span className="text-muted-foreground">(optional)</span>
        </label>
        <p className="text-muted-foreground mb-2 text-xs">
          Leave empty to search <code>/opt/homebrew/bin</code>,{' '}
          <code>/usr/local/bin</code> and <code>/usr/bin</code>. Set this only if your
          ffmpeg and ffprobe live somewhere else.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={chooseFfmpegFolder} className="rounded border px-3 py-1">
            Choose ffmpeg folder
          </Button>
          <Button
            onClick={() =>
              save({ ffmpegDirectory: ffmpegDirectory ?? undefined }, 'ffmpeg folder')
            }
            disabled={settingsUnavailable}
            className="rounded border px-3 py-1"
          >
            Save ffmpeg folder
          </Button>
        </div>
        {ffmpegDirectory && (
          <p className="text-muted-foreground mt-1 text-sm">{ffmpegDirectory}</p>
        )}
      </div>

      {/*
        Advanced, and behind a disclosure, because a mis-set threshold produces
        confidently wrong verdicts rather than an obvious error. It exists so a
        badly calibrated default can be worked around without waiting for a
        release (D18), not as something to tune casually.
      */}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Advanced</summary>

        <div className="mt-3">
          <label htmlFor="qc-match-threshold" className="mb-2 block text-sm font-medium">
            Watermark match confidence
          </label>
          <p className="text-muted-foreground mb-2 text-xs">
            Leave empty to use the calibrated default of {QC_THRESHOLDS.matchConfidence}.
            A genuine match measures about 0.98 and a corner with no watermark about 0.01,
            so the default sits in a wide empty band. Any run using an override says so in
            its report.
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="qc-match-threshold"
              type="text"
              inputMode="decimal"
              value={matchThreshold}
              onChange={(event) => setMatchThreshold(event.target.value)}
              placeholder={String(QC_THRESHOLDS.matchConfidence)}
              aria-invalid={thresholdProblem !== null}
              aria-describedby={thresholdProblem ? 'qc-match-threshold-error' : undefined}
              className="max-w-32"
            />
            <Button
              onClick={() =>
                save(
                  {
                    qcMatchThreshold:
                      matchThreshold.trim() === '' ? undefined : Number(matchThreshold)
                  },
                  'match confidence'
                )
              }
              // Saving a rejected value is what "rejected rather than silently
              // clamped" has to mean in the UI as well as in the arithmetic (B13.3).
              disabled={settingsUnavailable || thresholdProblem !== null}
              className="rounded border px-3 py-1"
            >
              Save threshold
            </Button>
          </div>
          {thresholdProblem && (
            <p
              id="qc-match-threshold-error"
              role="alert"
              className="text-destructive mt-1 flex items-start gap-1.5 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{thresholdProblem}</span>
            </p>
          )}
        </div>
      </details>
    </section>
  )
}

export default QualityControlSection
