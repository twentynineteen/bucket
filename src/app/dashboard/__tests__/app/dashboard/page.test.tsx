import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import Page from '../../../page'

// Mock the sidebar components
vi.mock('@components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <div>SidebarTrigger</div>
}))

vi.mock('@components/app-sidebar', () => ({
  AppSidebar: () => <div>AppSidebar</div>
}))

// Mock the breadcrumb store before tests run
vi.mock('../../../../../store/useBreadcrumbStore.ts', () => ({
  useBreadcrumbStore: () => ({
    breadcrumbs: [
      { href: '/', label: 'Home' },
      { href: '/dashboard', label: 'Dashboard' }
    ]
  })
}))

describe('Page Component', () => {
  it('should render the Page component with Breadcrumb items', () => {
    render(<Page />)

    // Confirm sidebar content appears
    expect(screen.getByText(/AppSidebar/i)).toBeInTheDocument()

    // Confirm breadcrumb list items render
    const breadcrumbItems = screen.getAllByRole('listitem')
    expect(breadcrumbItems).toHaveLength(2)
  })
})
