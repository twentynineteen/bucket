import { CACHE } from '@shared/constants/timing'
import { useQuery } from '@tanstack/react-query'

import { logger } from '@shared/utils/logger'

import {
  checkAuth,
  clearStoredCredentials,
  getStoredToken,
  getStoredUsername
} from '../api'
import type { AuthCheckResult } from '../types'

async function checkAuthStatus(): Promise<AuthCheckResult> {
  const token = getStoredToken()
  const storedUsername = getStoredUsername()

  if (!token || !storedUsername) {
    return {
      isAuthenticated: false,
      username: null
    }
  }

  try {
    const response = await checkAuth(token)
    if (response.includes('authenticated')) {
      return {
        isAuthenticated: true,
        username: storedUsername
      }
    } else {
      clearStoredCredentials()
      return {
        isAuthenticated: false,
        username: null
      }
    }
  } catch (error) {
    logger.error('Auth check failed:', error)
    clearStoredCredentials()
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
