import { useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { logger } from '@shared/utils'

import { AuthContext } from './AuthContext'
import { addToken, clearStoredCredentials, setStoredCredentials } from './api'
import { useAuthCheck } from './hooks/useAuthCheck'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  const { data: authData } = useAuthCheck()

  const isAuthenticated = authData?.isAuthenticated ?? false
  const username = authData?.username ?? null

  const login = async (token: string, username: string) => {
    try {
      await addToken(token)
      setStoredCredentials(token, username)
      queryClient.invalidateQueries({ queryKey: ['authCheck'] })
    } catch (error) {
      logger.error('Login failed:', error)
    }
  }

  const logout = () => {
    clearStoredCredentials()
    queryClient.invalidateQueries({ queryKey: ['authCheck'] })
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
