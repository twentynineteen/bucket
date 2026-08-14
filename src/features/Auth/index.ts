/** React context provider supplying the app's logout action */
export { AuthProvider } from './AuthProvider'
/** Hook for accessing the auth context -- exposes logout */
export { useAuth } from './hooks/useAuth'
/** Auth context shape -- the logout action */
export type { AuthContextType } from './types'
