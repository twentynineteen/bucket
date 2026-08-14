/**
 * useVerifiedPaths - batched existence probe for stored breadcrumbs paths
 *
 * Paths read out of breadcrumbs.json were rendered as current state behind a
 * bare string-truthiness gate (issue #168), the same defective pre-check fixed
 * in #166. This resolves them for real, in one batched call, so a surface can
 * distinguish a path that still resolves from one that does not.
 *
 * Three states, never two: `true`, `false`, and `undefined` while the probe has
 * not answered. Callers must render nothing at all for `undefined` rather than
 * treating it as absent - asserting a cause mid-check is what #166 B5.6 exists
 * to prevent.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryKeys } from '@shared/lib'
import { pathsExist } from '../api'

export interface VerifiedPaths {
  /** `undefined` until the probe answers, then whether the path was found. */
  isPresent: (path: string) => boolean | undefined
  /** How many probed paths were not found. `undefined` until the probe answers. */
  missingCount: number | undefined
  /** How many paths were probed. */
  probedCount: number
}

export function useVerifiedPaths(paths: string[]): VerifiedPaths {
  const unique = useMemo(
    () => [...new Set(paths.filter((path) => !!path))],
    // Derived from the list's contents, not its identity. Callers build the
    // array inline from breadcrumbs on every render, so depending on identity
    // would rebuild the query key - and refetch - on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paths.join('\n')]
  )

  const { data } = useQuery({
    queryKey: queryKeys.baker.pathsPresent(unique),
    queryFn: async () => {
      const answers = await pathsExist(unique)
      return new Map(unique.map((path, index) => [path, answers[index] ?? false]))
    },
    enabled: unique.length > 0,
    // A path that does not resolve will not start resolving inside a retry
    // window, and an unmounted drive is the common case rather than a blip.
    // Retrying would only delay the answer, as it did in #166.
    retry: false
  })

  return useMemo(
    () => ({
      isPresent: (path: string) => data?.get(path),
      missingCount: data
        ? [...data.values()].filter((present) => !present).length
        : undefined,
      probedCount: unique.length
    }),
    [data, unique]
  )
}
