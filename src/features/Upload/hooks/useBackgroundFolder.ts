import { useApiKeys } from '@shared/hooks'
import { queryKeys } from '@shared/lib'
import { useAppStore } from '@shared/store'
import { logger } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { listDirectory } from '../api'

/**
 * Why the background folder cannot be used, or `ready` when it can.
 *
 * Six situations rendered identically before issue #166. Separating them is the
 * whole point of this hook: "no folder set" and "the folder you set is gone" are
 * different problems with different fixes, and telling the user the wrong one
 * sent them to Settings to re-enter a path that was already correct.
 */
export type BackgroundFolderStatus =
  /** Settings have not loaded yet, so we do not know what is configured. */
  | 'unknown'
  /** Settings could not be read, so the configured folder is unknowable. */
  | 'settings-error'
  /** Settings loaded and hold no background folder. */
  | 'not-configured'
  /** A folder is configured and its listing is in flight. */
  | 'loading'
  /** The folder is absent, or present but unreadable. */
  | 'cannot-read'
  /** The folder listed fine but holds no images. */
  | 'empty'
  /** The folder listed fine and holds at least one image. */
  | 'ready'

interface BackgroundFolderData {
  files: string[]
  status: BackgroundFolderStatus
  /** User-facing explanation, or null when there is nothing to explain. */
  reason: string | null
  /** The folder actually being read: the session override if set, else the default. */
  folderInUse: string | null
  /** The folder saved in Settings. */
  defaultFolder: string | null
  /** Whether a session pick is currently overriding the saved default. */
  isSessionOverride: boolean
  isLoading: boolean
  loadFolder: (folderPath: string) => Promise<void>
  /** Drop the session override and go back to the saved default. */
  useDefaultFolder: () => void
  /** Kept for consumers that only care about the resolved folder. */
  currentFolder: string | null
}

const REASONS = {
  settingsError: 'Could not read your settings, so the background folder is unknown.',
  notConfigured: 'No default background folder configured. Set one in Settings.',
  empty: 'The background folder contains no image files.'
} as const

/** Worded to be true whether the folder is absent or merely unreadable. */
const cannotReadReason = (path: string) => `Cannot read background folder: ${path}`

export function useBackgroundFolder(): BackgroundFolderData {
  const defaultFolder = useAppStore((state) => state.defaultBackgroundFolder)
  const [sessionFolder, setSessionFolder] = useState<string | null>(null)

  // The store's folder is only ever hydrated as a side effect of loadApiKeys, so
  // a null value alone cannot distinguish "not configured" from "not loaded yet"
  // from "load failed". The settings query's status supplies that (#166 F1).
  const { isPending: settingsPending, isError: settingsError } = useApiKeys()

  const folderInUse = sessionFolder || defaultFolder
  const settingsKnown = !settingsPending && !settingsError

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.upload.backgroundFolder(folderInUse),
    queryFn: async () => {
      if (!folderInUse) return null
      return listDirectory(folderInUse)
    },
    enabled: settingsKnown && !!folderInUse,
    // A folder that is absent or denied will not become present within a retry
    // window, and the shared default would spend ~7s of backoff before the user
    // is told anything. Unexpected rejections surface at once too.
    retry: false
  })

  // In an effect, not the render body: any unrelated re-render would otherwise
  // log the same failure again and bury the first occurrence.
  const unreadableDetail = data?.status === 'unreadable' ? data.detail : null
  useEffect(() => {
    if (unreadableDetail !== null) {
      logger.error(`Background folder unreadable (${folderInUse}): ${unreadableDetail}`)
    }
  }, [unreadableDetail, folderInUse])

  const { status, reason } = resolveState({
    settingsPending,
    settingsError,
    folderInUse,
    isLoading,
    isError,
    result: data ?? null
  })

  const loadFolder = useCallback(async (folderPath: string) => {
    // The query key is derived from this, so changing it refetches. The old
    // refetch() call here was a no-op against the previous key (#166).
    setSessionFolder(folderPath)
  }, [])

  const useDefaultFolder = useCallback(() => {
    setSessionFolder(null)
  }, [])

  return {
    files: data?.status === 'ok' ? data.files : [],
    status,
    reason,
    folderInUse,
    defaultFolder,
    isSessionOverride: sessionFolder !== null,
    isLoading,
    loadFolder,
    useDefaultFolder,
    currentFolder: folderInUse
  }
}

/**
 * Priority order matters: a problem we already know about is reported before a
 * check that has not finished, and no state is claimed while its own check is
 * still in flight.
 */
function resolveState({
  settingsPending,
  settingsError,
  folderInUse,
  isLoading,
  isError,
  result
}: {
  settingsPending: boolean
  settingsError: boolean
  folderInUse: string | null
  isLoading: boolean
  isError: boolean
  result: Awaited<ReturnType<typeof listDirectory>> | null
}): { status: BackgroundFolderStatus; reason: string | null } {
  if (settingsError) return { status: 'settings-error', reason: REASONS.settingsError }
  if (settingsPending) return { status: 'unknown', reason: null }
  if (!folderInUse) return { status: 'not-configured', reason: REASONS.notConfigured }

  // An unexpected rejection is still a folder we cannot read.
  if (isError) return { status: 'cannot-read', reason: cannotReadReason(folderInUse) }
  if (isLoading || !result) return { status: 'loading', reason: null }

  if (result.status === 'missing' || result.status === 'unreadable') {
    // The detail from `unreadable` is logged above, never shown: it is Tauri
    // error text, not something a user can act on.
    return { status: 'cannot-read', reason: cannotReadReason(folderInUse) }
  }

  if (result.files.length === 0) return { status: 'empty', reason: REASONS.empty }
  return { status: 'ready', reason: null }
}
