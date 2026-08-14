import React from 'react'

import { AuthContext } from './AuthContext'
import { clearStoredCredentials } from './api'

/**
 * Supplies the logout action consumed by the dashboard sidebar.
 *
 * The app has no authentication, so there is no session to establish or
 * verify here. `logout` clears the credential keys an earlier build could
 * have written to localStorage, and nothing else.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = React.useMemo(() => ({ logout: clearStoredCredentials }), [])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
