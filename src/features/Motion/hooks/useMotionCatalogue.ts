/**
 * useMotionCatalogue - TanStack React Query hook for the template catalogue
 * (issue #333)
 *
 * Merges built-in templates with the user library folder. The query is keyed
 * on the library folder path so changing the pref triggers a reload.
 */
import { queryKeys } from '@shared/lib'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listFolder, readText } from '../api'
import { loadBuiltins } from '../internal/builtins'
import { loadLibrary, mergeCatalogue } from '../internal/library'
import type { CatalogueEntry, CatalogueIssue } from '../types'

export function useMotionCatalogue(libraryFolder: string | null) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motion.catalogue(libraryFolder),
    queryFn: async (): Promise<{
      entries: CatalogueEntry[]
      issues: CatalogueIssue[]
    }> => {
      const { templates: builtinTemplates, issues: builtinIssues } = loadBuiltins()
      const builtinEntries: CatalogueEntry[] = builtinTemplates.map(t => ({
        template: t,
        source: 'builtin' as const
      }))

      const { templates: libraryTemplates, issues: loadIssues } = await loadLibrary(
        libraryFolder,
        listFolder,
        readText
      )

      const libraryItems = libraryTemplates.map(t => ({
        template: t,
        path: `${libraryFolder}/${t.id}.json`
      }))

      const { entries, issues: mergeIssues } = mergeCatalogue(
        builtinEntries,
        libraryItems
      )

      return {
        entries,
        issues: [...builtinIssues, ...loadIssues, ...mergeIssues]
      }
    },
    retry: false
  })

  const rescan = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.motion.catalogue(libraryFolder)
    })
  }

  return {
    entries: data?.entries ?? [],
    issues: data?.issues ?? [],
    isLoading,
    rescan
  }
}
