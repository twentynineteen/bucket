/**
 * useVerifiedPaths - batched existence probe for paths recorded in a Trello card
 *
 * A card's breadcrumbs block was authored on whichever machine baked the
 * project, so rendering its paths behind a bare truthiness gate presented
 * someone else's filesystem as this machine's current state (issue #168).
 *
 * Deliberately duplicated from `Baker/hooks/useVerifiedPaths.ts` rather than
 * imported across the feature boundary: each feature reaches the filesystem
 * through its own `api.ts`, and the two probe different path sets under
 * different query keys.
 *
 * Three states, never two: `true`, `false`, and `undefined` while the probe has
 * not answered. Callers must render nothing at all for `undefined`.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryKeys } from '@shared/lib'
import { pathsExist } from '../api'

export interface VerifiedPaths {
  /** `undefined` until the probe answers, then whether the path was found. */
  isPresent: (path: string) => boolean | undefined
}

export function useVerifiedPaths(paths: string[]): VerifiedPaths {
  const unique = useMemo(
    () => [...new Set(paths.filter((path) => !!path))],
    // Derived from the list's contents, not its identity: the caller builds the
    // array inline from the parsed card on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths.join('\n')]
  )

  const { data } = useQuery({
    queryKey: queryKeys.trello.pathsPresent(unique),
    queryFn: async () => {
      const answers = await pathsExist(unique)
      return new Map(unique.map((path, index) => [path, answers[index] ?? false]))
    },
    enabled: unique.length > 0,
    // A path recorded on another machine will not start resolving inside a
    // retry window. Retrying would only delay the answer, as it did in #166.
    retry: false
  })

  return useMemo(() => ({ isPresent: (path: string) => data?.get(path) }), [data])
}
