/** React context provider for authentication state and token management */
export { AuthProvider } from './AuthProvider'
/** Hook for accessing auth context -- login, logout, token, and user state */
export { useAuth } from './hooks/useAuth'
/** Hook for verifying authentication status on mount -- redirects if unauthenticated */
export { useAuthCheck } from './hooks/useAuthCheck'
/** Login page component with email/password form and error handling */
export { default as Login } from './components/Login'
/** Registration page component for new user account creation */
export { default as Register } from './components/Register'
/** Auth context shape -- user, token, login/logout/register methods */
export type { AuthContextType } from './types'
