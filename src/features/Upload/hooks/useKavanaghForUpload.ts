/**
 * useKavanaghForUpload (issue #180, stage 4, B9)
 *
 * Runs a Kavanagh check before a Sprout upload, and decides whether the upload
 * may go ahead.
 *
 * Opt-in per video, off until someone turns it on, remembered in localStorage -
 * the same shape as the poster frame preference next door, because not every
 * video needs checking and a check costs a full decode pass (D13).
 *
 * The gating policy is D14, and the asymmetry in it is deliberate:
 *
 * - a **failure** blocks, and can only be got past with a deliberate confirm;
 * - a **warning** never blocks and needs no confirm.
 *
 * An unrecognised sting is the warning case, and it means the references folder
 * needs a new variant rather than that the render is broken. Blocking on it
 * would teach people to click through the override by reflex, which would cost
 * more than it saved the first time a real failure appeared.
 */

import { useKavanaghAvailability, useKavanaghCheck } from '@features/Kavanagh'
import type { KavanaghCheckReport, KavanaghError } from '@features/Kavanagh'
import { useApiKeys } from '@shared/hooks'
import { logger } from '@shared/utils'
import React from 'react'

const PREFS_KEY = 'kavanagh-upload-preferences'

interface KavanaghUploadPreferences {
  enabled: boolean
}

/** Off until someone asks for it (B9.1). */
const DEFAULT_PREFERENCES: KavanaghUploadPreferences = { enabled: false }

function loadPreferences(): KavanaghUploadPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (!stored) return DEFAULT_PREFERENCES

    const parsed = JSON.parse(stored) as Partial<KavanaghUploadPreferences>
    // Explicitly `=== true`: a stored `"yes"`, or a shape from some future
    // version, must not turn the check on by being truthy.
    return { enabled: parsed.enabled === true }
  } catch (error) {
    logger.warn('Failed to load Kavanagh upload preferences:', error)
    return DEFAULT_PREFERENCES
  }
}

function savePreferences(preferences: KavanaghUploadPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
  } catch (error) {
    // A preference that cannot be remembered is not worth failing an upload for.
    logger.warn('Failed to save Kavanagh upload preferences:', error)
  }
}

/** Why an upload is being held back. */
export interface KavanaghBlock {
  /** The report behind the block, or null when the run never produced one. */
  report: KavanaghCheckReport | null
  /** Set when the run could not judge the video at all (B7.4). */
  error: KavanaghError | null
}

export interface UseKavanaghForUploadResult {
  /** Whether uploads are checked first. Remembered across reloads (B9.8). */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  /** True while a check runs ahead of an upload. */
  checking: boolean
  /** The last run's report, whatever its verdict. */
  report: KavanaghCheckReport | null
  /** Set while a failure is holding an upload back; null otherwise. */
  block: KavanaghBlock | null
  /** Whether the check can run at all - ffmpeg and both reference pools. */
  available: boolean
  /** Why it cannot, when it cannot. */
  unavailableReason: string | null
  /**
   * Runs the check if it is switched on, and answers whether the upload may
   * proceed now.
   *
   * `true` when the check is off, when it passed, and when it warned. `false`
   * only when something is holding the upload back, in which case `block` says
   * what.
   */
  gate: (videoPath: string) => Promise<boolean>
  /** Proceeds past a block, deliberately (B9.4). */
  override: () => void
  /** Abandons the upload the block interrupted (B9.5). */
  dismiss: () => void
  /** Clears the last report, for when a different render is chosen. */
  reset: () => void
}

export function useKavanaghForUpload(): UseKavanaghForUploadResult {
  const [enabled, setEnabledState] = React.useState(() => loadPreferences().enabled)
  const [block, setBlock] = React.useState<KavanaghBlock | null>(null)

  const { data: settings } = useApiKeys()
  const { available, reason, poolFiles } = useKavanaghAvailability()
  const { isRunning, report, run, reset: resetRun } = useKavanaghCheck()

  const setEnabled = React.useCallback((next: boolean) => {
    setEnabledState(next)
    savePreferences({ enabled: next })
  }, [])

  const gate = React.useCallback(
    async (videoPath: string): Promise<boolean> => {
      // Nothing is spawned when the check is off (B9.7). This is the first line
      // rather than a condition further down for exactly that reason.
      if (!enabled) return true

      setBlock(null)

      // Switched on but unable to run: held back rather than waved through. The
      // operator asked for a check, and uploading unchecked without saying so
      // would be the one outcome nobody chose.
      if (!available) {
        setBlock({
          report: null,
          error: {
            kind: 'unavailable',
            message: reason ?? 'Kavanagh cannot run, so this render was not checked.'
          }
        })
        return false
      }

      const result = await run({
        videoPath,
        referenceFiles: poolFiles.watermarks,
        stingReferenceFiles: poolFiles.stings,
        ffmpegDirectory: settings?.ffmpegDirectory ?? null,
        matchThreshold: settings?.kavanaghMatchThreshold
      })

      // A run that could not judge the video is not a judged-bad render, but it
      // is still not a checked one, so it blocks with the same override rather
      // than passing silently (B7.4 applied to D14).
      if (!result) {
        setBlock({
          report: null,
          error: {
            kind: 'io',
            message:
              'This render could not be checked, so nothing is known about it. Upload anyway only if you are sure.'
          }
        })
        return false
      }

      // Warnings do not block and need no confirm (B9.6, D14).
      if (result.verdict === 'fail') {
        setBlock({ report: result, error: null })
        return false
      }

      return true
    },
    [
      enabled,
      available,
      reason,
      run,
      poolFiles.watermarks,
      poolFiles.stings,
      settings?.ffmpegDirectory,
      settings?.kavanaghMatchThreshold
    ]
  )

  const override = React.useCallback(() => setBlock(null), [])
  const dismiss = React.useCallback(() => setBlock(null), [])

  const reset = React.useCallback(() => {
    setBlock(null)
    resetRun()
  }, [resetRun])

  return {
    enabled,
    setEnabled,
    checking: isRunning,
    report,
    block,
    available,
    unavailableReason: reason,
    gate,
    override,
    dismiss,
    reset
  }
}
