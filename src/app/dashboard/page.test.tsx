import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import Page from './page'

const logout = vi.fn()

// Only the I/O boundary is mocked. AppSidebar is replaced with a stand-in that
// exposes its logout slot as a real control, so the assertion is that Page wires
// useAuth().logout into it -- not that a mock rendered.
vi.mock('@shared/ui/sidebar/Sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <div>SidebarTrigger</div>
}))

vi.mock('@shared/ui/sidebar/SidebarProvider', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/layout/app-sidebar', () => ({
  AppSidebar: ({ onLogout }: { onLogout?: () => void }) => (
    <button onClick={onLogout}>Log out</button>
  )
}))

vi.mock('@features/Auth', () => ({
  useAuth: () => ({ logout })
}))

vi.mock('@shared/store/useBreadcrumbStore', () => ({
  useBreadcrumbStore: () => ({
    breadcrumbs: [
      { href: '/', label: 'Home' },
      { href: '/dashboard', label: 'Dashboard' }
    ]
  })
}))

describe('Page Component', () => {
  it('renders a breadcrumb item per entry in the store', () => {
    render(<Page />)

    const breadcrumbItems = screen.getAllByRole('listitem')
    expect(breadcrumbItems).toHaveLength(2)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  // Issue #199 removed the login flow. logout is the one auth behaviour with a
  // live consumer, so this guards the wiring that must survive.
  it('runs the logout from useAuth when the sidebar logout control is used', async () => {
    logout.mockClear()
    render(<Page />)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(logout).toHaveBeenCalledOnce()
  })
})
