import { CACHE } from '@constants/timing'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

import { logger } from '@/utils/logger'

interface AuthCheckResult {
  isAuthenticated: boolean
  username: string | null
}

async function checkAuthStatus(): Promise<AuthCheckResult> {
  const token = localStorage.getItem('access_token')
  const storedUsername = localStorage.getItem('username')

  if (!token || !storedUsername) {
    return {
      isAuthenticated: false,
      username: null
    }
  }

  try {
    const response = await invoke<string>('check_auth', { token })
    if (response.includes('authenticated')) {
      return {
        isAuthenticated: true,
        username: storedUsername
      }
    } else {
      localStorage.removeItem('access_token')
      localStorage.removeItem('username')
      return {
        isAuthenticated: false,
        username: null
      }
    }
  } catch (error) {
    logger.error('Auth check failed:', error)
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    return {
      isAuthenticated: false,
      username: null
    }
  }
}

export function useAuthCheck() {
  return useQuery({
    queryKey: ['authCheck'],
    queryFn: checkAuthStatus,
    staleTime: CACHE.STANDARD, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false
  })
}
