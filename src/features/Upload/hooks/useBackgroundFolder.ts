import { useApiKeys } from '@shared/hooks'
import { queryKeys } from '@shared/lib'
import { useAppStore } from '@shared/store'
import { logger } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { listDirectory } from '../api'
import {
  POSTERFRAME_TEMPLATES,
  type PosterframeTemplateId
} from '../internal/posterframeTemplates'

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

/**
 * Reasons name the active template (issue #189 B3.6): with two folders in
 * Settings, "the background folder" no longer identifies which one is wrong.
 */
const settingsErrorReason =
  'Could not read your settings, so the background folder is unknown.'
const notConfiguredReason = (label: string) =>
  `No ${label} background folder configured. Set one in Settings.`
const emptyReason = (label: string) =>
  `The ${label} background folder contains no image files.`

/** Worded to be true whether the folder is absent or merely unreadable. */
const cannotReadReason = (label: string, path: string) =>
  `Cannot read ${label} background folder: ${path}`

export function useBackgroundFolder(
  templateId: PosterframeTemplateId
): BackgroundFolderData {
  const defaultFolder = useAppStore((state) =>
    templateId === 'rebrand'
      ? state.rebrandBackgroundFolder
      : state.defaultBackgroundFolder
  )
  // A session pick belongs to the template it was made under: carrying it
  // across a switch would pair one brand's backgrounds with the other's text
  // layout (issue #189 B3.3). Tagging the override with its template and
  // clearing on mismatch during render is React's adjust-state-on-prop-change
  // pattern - an effect here would commit a frame with the stale pairing.
  const [override, setOverride] = useState<{
    templateId: PosterframeTemplateId
    folder: string
  } | null>(null)
  if (override && override.templateId !== templateId) {
    setOverride(null)
  }
  const sessionFolder =
    override && override.templateId === templateId ? override.folder : null

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
    templateLabel: POSTERFRAME_TEMPLATES[templateId].label,
    settingsPending,
    settingsError,
    folderInUse,
    isLoading,
    isError,
    result: data ?? null
  })

  const loadFolder = useCallback(
    async (folderPath: string) => {
      // The query key is derived from this, so changing it refetches. The old
      // refetch() call here was a no-op against the previous key (#166).
      setOverride({ templateId, folder: folderPath })
    },
    [templateId]
  )

  const useDefaultFolder = useCallback(() => {
    setOverride(null)
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
  templateLabel,
  settingsPending,
  settingsError,
  folderInUse,
  isLoading,
  isError,
  result
}: {
  templateLabel: string
  settingsPending: boolean
  settingsError: boolean
  folderInUse: string | null
  isLoading: boolean
  isError: boolean
  result: Awaited<ReturnType<typeof listDirectory>> | null
}): { status: BackgroundFolderStatus; reason: string | null } {
  if (settingsError) return { status: 'settings-error', reason: settingsErrorReason }
  if (settingsPending) return { status: 'unknown', reason: null }
  if (!folderInUse)
    return { status: 'not-configured', reason: notConfiguredReason(templateLabel) }

  // An unexpected rejection is still a folder we cannot read.
  if (isError)
    return {
      status: 'cannot-read',
      reason: cannotReadReason(templateLabel, folderInUse)
    }
  if (isLoading || !result) return { status: 'loading', reason: null }

  if (result.status === 'missing' || result.status === 'unreadable') {
    // The detail from `unreadable` is logged above, never shown: it is Tauri
    // error text, not something a user can act on.
    return {
      status: 'cannot-read',
      reason: cannotReadReason(templateLabel, folderInUse)
    }
  }

  if (result.files.length === 0)
    return { status: 'empty', reason: emptyReason(templateLabel) }
  return { status: 'ready', reason: null }
}
