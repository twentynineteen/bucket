import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { AuthProvider } from './AuthProvider'
import { useAuth } from './hooks/useAuth'

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // src/App.tsx wraps the whole router in AuthProvider, so a provider that
  // cannot render standalone takes the app down with it. No QueryClientProvider
  // here on purpose: the provider must not depend on React Query or on the
  // Tauri backend.
  it('renders its children without any surrounding providers', () => {
    render(
      <AuthProvider>
        <p>app content</p>
      </AuthProvider>
    )

    expect(screen.getByText('app content')).toBeInTheDocument()
  })

  // The behaviour behind the sidebar's "Log out" control.
  it('logout removes the stored credentials', () => {
    localStorage.setItem('access_token', 'residual-token')
    localStorage.setItem('username', 'residual-user')

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    act(() => {
      result.current.logout()
    })

    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('username')).toBeNull()
  })
})
