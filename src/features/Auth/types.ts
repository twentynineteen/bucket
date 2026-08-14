export interface AuthContextType {
  /** Clears any credentials left in localStorage by an earlier build. */
  logout: () => void
}
