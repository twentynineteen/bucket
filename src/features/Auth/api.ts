import { invoke } from '@tauri-apps/api/core'

export async function addToken(token: string): Promise<void> {
  await invoke('add_token', { token })
}

export async function checkAuth(token: string): Promise<string> {
  return invoke<string>('check_auth', { token })
}

export function getStoredToken(): string | null {
  return localStorage.getItem('access_token')
}

export function getStoredUsername(): string | null {
  return localStorage.getItem('username')
}

export function setStoredCredentials(token: string, username: string): void {
  localStorage.setItem('access_token', token)
  localStorage.setItem('username', username)
}

export function clearStoredCredentials(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('username')
}
