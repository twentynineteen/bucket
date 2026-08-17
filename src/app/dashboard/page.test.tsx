import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import Page from './page'

// The sidebar is stood in for because it reaches for Tauri; the breadcrumb
// header, which is what Page itself renders, is left real.
vi.mock('@shared/ui/sidebar/Sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <div>SidebarTrigger</div>
}))

vi.mock('@shared/ui/sidebar/SidebarProvider', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/layout/app-sidebar', () => ({
  AppSidebar: () => null
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
})
