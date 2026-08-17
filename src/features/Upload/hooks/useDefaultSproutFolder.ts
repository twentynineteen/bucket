/**
 * useDefaultSproutFolder (issue #169)
 *
 * Resolves the stored default upload folder into something that can be shown:
 * the folder as the index currently knows it, or the account root plus a reason.
 *
 * Extracted from `useSproutFolderSelection` so the Settings panel can reach the
 * same answer through the `@features/Upload` barrel. Settings rendered its own
 * `{ id, name, path: name }` out of storage, which is the very defect #169 fixed
 * one layer down, and a second classifier beside `internal/defaultFolder.ts`
 * would only let the two drift apart.
 *
 * It reads the **saved folder index** and nothing live, so it costs zero Sprout
 * requests: the account gets 200 requests/minute shared with uploads, and #155 R1
 * settled that folders are never fetched speculatively. Callers pass the stored
 * values in rather than having them read here, because Settings already holds
 * them as props and re-reading would let the two copies disagree.
 */
import { useMemo } from 'react'

import type { ResolvedDefaultFolder } from '../internal/defaultFolder'
import { resolveDefaultFolder } from '../internal/defaultFolder'
import { useSavedFolderIndex } from './useSavedFolderIndex'

export interface UseDefaultSproutFolderInput {
  /** Sprout API key. The index for one account cannot judge another's folders. */
  apiKey: string | null
  /** `sproutDefaultFolderId` as stored, or undefined when none is configured. */
  storedId: string | undefined
  /** The label stored with the id -- the folder's path at the time it was picked. */
  storedName: string | undefined
  /** The settings read has not finished, so nothing is known yet. */
  settingsPending?: boolean
  /** The settings read failed, so the stored id is unknowable, not absent. */
  settingsError?: boolean
}

export function useDefaultSproutFolder({
  apiKey,
  storedId,
  storedName,
  settingsPending = false,
  settingsError = false
}: UseDefaultSproutFolderInput): ResolvedDefaultFolder {
  const { index, isPending: indexPending } = useSavedFolderIndex(apiKey)

  return useMemo(
    () =>
      resolveDefaultFolder({
        settingsPending,
        settingsError,
        storedId,
        storedName,
        index,
        indexPending
      }),
    [settingsPending, settingsError, storedId, storedName, index, indexPending]
  )
}
