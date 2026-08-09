/**
 * useSproutFolderSelection (issue #155, Phase 5)
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
 */
import { useApiKeys } from '@shared/hooks'
import { useAppStore } from '@shared/store'
import { useCallback, useMemo, useState } from 'react'

import type { SelectedSproutFolder } from '../types'

interface UseSproutFolderSelectionReturn {
  /** The folder to upload into, or null for the account root. */
  selectedFolder: SelectedSproutFolder | null
  /** Choose a folder. Passing null selects the account root. */
  selectFolder: (folder: SelectedSproutFolder | null) => void
  /** Recently used folders this session, most recent first. */
  recentFolders: SelectedSproutFolder[]
  /** Records a successful upload's folder as most-recently-used. */
  commitFolder: (folder: SelectedSproutFolder | null) => void
}

export function useSproutFolderSelection(): UseSproutFolderSelectionReturn {
  const { data: apiKeys } = useApiKeys()
  const recentFolders = useAppStore((state) => state.recentSproutFolders)
  const rememberSproutFolder = useAppStore((state) => state.rememberSproutFolder)

  // `undefined` means "not chosen this session yet", which is distinct from an
  // explicit null (the user deliberately picking Root). Collapsing the two
  // would make Root unselectable whenever a default exists.
  const [chosen, setChosen] = useState<SelectedSproutFolder | null | undefined>(undefined)

  const settingsDefault = useMemo<SelectedSproutFolder | null>(() => {
    const id = apiKeys?.sproutDefaultFolderId
    if (!id) return null
    const name = apiKeys?.sproutDefaultFolderName ?? 'Default folder'
    return { id, name, path: name }
  }, [apiKeys?.sproutDefaultFolderId, apiKeys?.sproutDefaultFolderName])

  const selectedFolder =
    chosen !== undefined ? chosen : (recentFolders[0] ?? settingsDefault)

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
    commitFolder
  }
}
