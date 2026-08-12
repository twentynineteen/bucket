/**
 * useQcAvailability (issue #180, stage 1)
 *
 * Owns the three prerequisite checks QC needs before it can run — the ffmpeg
 * toolchain, the watermark pool and the sting pool — and reduces them to one
 * verdict the page can render.
 *
 * The composition itself lives in `internal/availability.ts` as a pure function,
 * so the priority rules are tested without React or Tauri in the way.
 */

import { useApiKeys } from '@shared/hooks'
import { queryKeys } from '@shared/lib'
import { logger } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { detectFfmpeg, listReferencePool } from '../api'
import { resolveQcAvailability, type QcAvailability } from '../internal/availability'
import {
  resolveReferencePoolState,
  type ReferencePool,
  type ReferencePoolState
} from '../internal/referencePool'

export interface UseQcAvailabilityResult extends QcAvailability {
  /** Per-pool state, so Settings can show both at once rather than only the first fault. */
  pools: Record<ReferencePool, ReferencePoolState>
  /** The configured reference folder, or null when unset. */
  referenceFolder: string | null
}

export function useQcAvailability(): UseQcAvailabilityResult {
  const {
    data: settings,
    isPending: settingsPending,
    isError: settingsError
  } = useApiKeys()

  const referenceFolder = settings?.qcReferenceFolder ?? null
  const ffmpegDirectory = settings?.ffmpegDirectory ?? null
  const settingsKnown = !settingsPending && !settingsError

  const { data: ffmpeg } = useQuery({
    queryKey: queryKeys.qc.ffmpeg(ffmpegDirectory),
    queryFn: () => detectFfmpeg(ffmpegDirectory),
    enabled: settingsKnown,
    // A binary that is not installed will not appear within a retry window, and
    // the shared default would spend ~7s of backoff before saying anything.
    retry: false
  })

  const watermarks = usePool(
    'watermarks',
    referenceFolder,
    settingsPending,
    settingsError
  )
  const stings = usePool('stings', referenceFolder, settingsPending, settingsError)

  const availability = resolveQcAvailability({
    ffmpeg: ffmpeg ?? null,
    watermarks,
    stings
  })

  return {
    ...availability,
    pools: { watermarks, stings },
    referenceFolder
  }
}

/** Resolves one pool's listing and state. */
function usePool(
  pool: ReferencePool,
  folder: string | null,
  settingsPending: boolean,
  settingsError: boolean
): ReferencePoolState {
  const settingsKnown = !settingsPending && !settingsError

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.qc.referencePool(folder, pool),
    queryFn: async () => {
      if (!folder) return null
      return listReferencePool(folder, pool)
    },
    enabled: settingsKnown && !!folder,
    retry: false
  })

  // In an effect, not the render body: an unrelated re-render would otherwise
  // log the same failure again and bury the first occurrence.
  const detail = data?.status === 'unreadable' ? data.detail : null
  useEffect(() => {
    if (detail !== null) {
      logger.error(`QC ${pool} pool unreadable (${folder}): ${detail}`)
    }
  }, [detail, folder, pool])

  return resolveReferencePoolState({
    pool,
    settingsPending,
    settingsError,
    folder,
    isLoading,
    isError,
    listing: data ?? null
  })
}
