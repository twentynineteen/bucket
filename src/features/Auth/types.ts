export interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  login: (token: string, username: string) => void
  logout: () => void
}

export interface AuthCheckResult {
  isAuthenticated: boolean
  username: string | null
}
