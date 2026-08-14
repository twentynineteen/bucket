/**
 * I/O boundary for the Auth feature.
 *
 * The app performs no authentication. There is no login flow, and the backend
 * no longer exposes a token check (issue #199). All that remains is clearing
 * the credential keys an earlier build could leave behind in localStorage.
 */
export function clearStoredCredentials(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('username')
}
