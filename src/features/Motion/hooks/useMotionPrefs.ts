/**
 * useMotionPrefs - TanStack React Query hook for Motion prefs (issue #333)
 *
 * Reads and writes motion_prefs.json through the Motion api.ts boundary.
 * Prefs are cached under queryKeys.motion.prefs() and invalidated on save.
 */
import { queryKeys } from '@shared/lib'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readMotionPrefsText, writeMotionPrefsText } from '../api'
import { parsePrefs, serialisePrefs, type MotionPrefs } from '../internal/prefs'

export function useMotionPrefs() {
  const queryClient = useQueryClient()

  const {
    data: prefs,
    isLoading,
    isError
  } = useQuery({
    queryKey: queryKeys.motion.prefs(),
    queryFn: async () => {
      const text = await readMotionPrefsText()
      return parsePrefs(text)
    },
    retry: false
  })

  const saveMutation = useMutation({
    mutationFn: async (updated: MotionPrefs) => {
      await writeMotionPrefsText(serialisePrefs(updated))
      return updated
    },
    onSuccess: saved => {
      queryClient.setQueryData(queryKeys.motion.prefs(), saved)
    }
  })

  /** Update one or more pref fields and save immediately. */
  const updatePrefs = async (patch: Partial<MotionPrefs>) => {
    const current = prefs ?? parsePrefs(null)
    const updated = { ...current, ...patch }
    await saveMutation.mutateAsync(updated)
  }

  return {
    prefs: prefs ?? parsePrefs(null),
    isLoading,
    isError,
    updatePrefs,
    isSaving: saveMutation.isPending
  }
}
