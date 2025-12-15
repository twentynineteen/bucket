import { CACHE } from '@constants/timing'
import { useQuery } from '@tanstack/react-query'
import { ApiKeys, loadApiKeys } from '@utils/storage'

export const useApiKeys = () => {
  return useQuery<ApiKeys>({
    queryKey: ['apiKeys'],
    queryFn: loadApiKeys,
    staleTime: CACHE.STANDARD, // 5 minutes
    gcTime: CACHE.GC_MEDIUM, // 10 minutes (renamed from cacheTime in v5)
    retry: 2,
    refetchOnWindowFocus: false
  })
}

export const useSproutVideoApiKey = () => {
  const { data: apiKeys, isLoading, error } = useApiKeys()

  return {
    apiKey: apiKeys?.sproutVideo || null,
    isLoading,
    error
  }
}

export const useTrelloApiKeys = () => {
  const { data: apiKeys, isLoading, error } = useApiKeys()

  return {
    apiKey: apiKeys?.trello || null,
    apiToken: apiKeys?.trelloToken || null,
    isLoading,
    error
  }
}
