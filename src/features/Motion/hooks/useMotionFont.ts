/**
 * useMotionFont - TanStack React Query hook for Cabrito font loading
 * (issue #333)
 *
 * Checks whether Cabrito.otf is installed (same path as Posterframe), reads
 * the bytes, and registers a FontFace with family "Cabrito Semi".
 */
import { queryKeys } from '@shared/lib'
import { useQuery } from '@tanstack/react-query'
import { motionFontAvailable, readMotionFont } from '../api'

interface FontState {
  status: 'loading' | 'ready' | 'missing'
  bytes?: Uint8Array
}

export function useMotionFont(): FontState {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motion.font(),
    queryFn: async (): Promise<FontState> => {
      const available = await motionFontAvailable()
      if (!available) {
        return { status: 'missing' }
      }

      const bytes = await readMotionFont()

      // Register a FontFace if the API exists
      if (typeof globalThis.FontFace !== 'undefined' && document.fonts) {
        try {
          const face = new FontFace('Cabrito Semi', bytes.buffer as ArrayBuffer)
          await face.load()
          document.fonts.add(face)
        } catch {
          // Font registration failed but bytes are still available
        }
      }

      return { status: 'ready', bytes }
    },
    retry: false,
    staleTime: Infinity
  })

  if (isLoading) return { status: 'loading' }
  return data ?? { status: 'loading' }
}
