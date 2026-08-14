/**
 * useSproutFolderSelection (issues #155 Phase 5, #169)
 *
 * Resolves the upload destination in ONE place, so the precedence rule is
 * stated once rather than reimplemented per entry point:
 *
 *   session last-used  →  Settings default  →  Root
 *
 * Session state lives in `appStore` (in-memory, no persistence -- lost on
 * restart, which is correct: the durable answer is the Settings default).
 * The default lives in `api_keys.json` alongside `trelloBoardId`, which is where
 * this app actually keeps settings.
 *
 * The Settings default is a folder id in a Sprout account this app does not
 * control, so it is **validated, not trusted** (#169). It used to be turned
 * straight back into `{ id, name, path: name }`, which rendered a folder deleted
 * or renamed on Sprout as the confident destination for an upload. Validation
 * resolves against the saved folder index -- a disk read, zero Sprout requests,
 * see `internal/defaultFolder.ts` for why nothing live is consulted.
 */
import { useApiKeys } from '@shared/hooks'
import { useAppStore } from '@shared/store'
import { useCallback, useState } from 'react'

import type { DefaultFolderStatus } from '../internal/defaultFolder'
import type { SelectedSproutFolder } from '../types'
import { useDefaultSproutFolder } from './useDefaultSproutFolder'

interface UseSproutFolderSelectionReturn {
  /** The folder to upload into, or null for the account root. */
  selectedFolder: SelectedSproutFolder | null
  /** Choose a folder. Passing null selects the account root. */
  selectFolder: (folder: SelectedSproutFolder | null) => void
  /** Recently used folders this session, most recent first. */
  recentFolders: SelectedSproutFolder[]
  /** Records a successful upload's folder as most-recently-used. */
  commitFolder: (folder: SelectedSproutFolder | null) => void
  /** What is known about the stored default folder (#169). */
  defaultFolderStatus: DefaultFolderStatus
  /**
   * Why the stored default cannot be used, or null when there is nothing to
   * say. Describes the saved default only -- never where this upload will land,
   * which the picker's own label states.
   */
  defaultFolderReason: string | null
}

export function useSproutFolderSelection(): UseSproutFolderSelectionReturn {
  // `error` used to be dropped here, so a settings file that could not be read
  // was indistinguishable from one holding no default at all (#169).
  const {
    data: apiKeys,
    isPending: settingsPending,
    isError: settingsError
  } = useApiKeys()
  const recentFolders = useAppStore((state) => state.recentSproutFolders)
  const rememberSproutFolder = useAppStore((state) => state.rememberSproutFolder)

  // `undefined` means "not chosen this session yet", which is distinct from an
  // explicit null (the user deliberately picking Root). Collapsing the two
  // would make Root unselectable whenever a default exists.
  const [chosen, setChosen] = useState<SelectedSproutFolder | null | undefined>(undefined)

  // Shared with the Settings panel, which shows the same default and must not
  // classify it differently (#169 follow-up).
  const resolvedDefault = useDefaultSproutFolder({
    apiKey: apiKeys?.sproutVideo ?? null,
    storedId: apiKeys?.sproutDefaultFolderId,
    storedName: apiKeys?.sproutDefaultFolderName,
    settingsPending: Boolean(settingsPending),
    settingsError: Boolean(settingsError)
  })

  const selectedFolder =
    chosen !== undefined ? chosen : (recentFolders[0] ?? resolvedDefault.folder)

  const commitFolder = useCallback(
    (folder: SelectedSproutFolder | null) => {
      rememberSproutFolder(folder)
    },
    [rememberSproutFolder]
  )

  return {
    selectedFolder,
    selectFolder: setChosen,
    recentFolders,
    commitFolder,
    defaultFolderStatus: resolvedDefault.status,
    defaultFolderReason: resolvedDefault.reason
  }
}
