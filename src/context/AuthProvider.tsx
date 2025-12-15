import { useAuthCheck } from '@hooks/useAuthCheck'
import { useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import React from 'react'

import { logger } from '@/utils/logger'

import { AuthContext } from './AuthContext'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  const { data: authData } = useAuthCheck()

  const isAuthenticated = authData?.isAuthenticated ?? false
  const username = authData?.username ?? null

  const login = async (token: string, username: string) => {
    try {
      await invoke('add_token', { token }) // Add token to backend
      localStorage.setItem('access_token', token)
      localStorage.setItem('username', username)
      queryClient.invalidateQueries({ queryKey: ['authCheck'] })
    } catch (error) {
      logger.error('Login failed:', error)
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    queryClient.invalidateQueries({ queryKey: ['authCheck'] })
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
