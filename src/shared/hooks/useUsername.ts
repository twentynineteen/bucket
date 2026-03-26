import { useQuery } from '@tanstack/react-query'
import { core } from '@tauri-apps/api'

/**
 * Custom hook that fetches the current user's username using TanStack React Query.
 * Provides caching, error handling, and loading states out of the box.
 */
export function useUsername() {
  return useQuery({
    queryKey: ['username'],
    queryFn: async () => {
      const name = await core.invoke<string>('get_username')
      return name
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    retry: 2 // Retry failed requests twice
  })
}
