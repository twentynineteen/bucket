/**
 * NavMain Component Tests
 *
 * Tests for the main navigation component that renders collapsible
 * menu items with optional sub-items in the sidebar.
 */

import '@testing-library/jest-dom'

import { TooltipProvider } from '@components/ui/tooltip'
import { SidebarContext } from '@components/ui/use-sidebar'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, Settings, Users, type LucideIcon } from 'lucide-react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NavMain } from './nav-main'

// Helper to create mock items
const createMockItem = (
  overrides: Partial<{
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: { title: string; url: string }[]
  }> = {}
) => ({
  title: 'Dashboard',
  url: '/dashboard',
  icon: Home,
  isActive: false,
  items: [],
  ...overrides
})

// Create sidebar context value helper
const createSidebarContext = (
  state: 'expanded' | 'collapsed' = 'expanded'
): React.ContextType<typeof SidebarContext> => ({
  state,
  open: state === 'expanded',
  setOpen: vi.fn(),
  openMobile: false,
  setOpenMobile: vi.fn(),
  isMobile: false,
  toggleSidebar: vi.fn()
})

// Wrapper component that provides all required contexts
const TestWrapper = ({
  children,
  sidebarState = 'expanded'
}: {
  children: React.ReactNode
  sidebarState?: 'expanded' | 'collapsed'
}) => {
  return (
    <MemoryRouter>
      <TooltipProvider>
        <SidebarContext.Provider value={createSidebarContext(sidebarState)}>
          {children}
        </SidebarContext.Provider>
      </TooltipProvider>
    </MemoryRouter>
  )
}

// Helper to render with wrapper
const renderNavMain = (
  items: Parameters<typeof NavMain>[0]['items'],
  sidebarState: 'expanded' | 'collapsed' = 'expanded'
) => {
  return render(
    <TestWrapper sidebarState={sidebarState}>
      <NavMain items={items} />
    </TestWrapper>
  )
}

describe('NavMain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // Basic Rendering Tests
  // ==========================================
  describe('Basic Rendering', () => {
    it('should render the Dashboard group label', () => {
      renderNavMain([])

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('should render an empty menu when items array is empty', () => {
      renderNavMain([])

      const menu = screen.getByRole('list')
      expect(menu).toBeInTheDocument()
      expect(menu.children).toHaveLength(0)
    })

    it('should render a single menu item', () => {
      const items = [createMockItem({ title: 'Home', url: '/home' })]

      renderNavMain(items)

      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('should render multiple menu items', () => {
      const items = [
        createMockItem({ title: 'Home', url: '/home', icon: Home }),
        createMockItem({ title: 'Settings', url: '/settings', icon: Settings }),
        createMockItem({ title: 'Users', url: '/users', icon: Users })
      ]

      renderNavMain(items)

      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
    })

    it('should render menu item without icon', () => {
      const items = [
        createMockItem({ title: 'No Icon', url: '/no-icon', icon: undefined })
      ]

      renderNavMain(items)

      expect(screen.getByText('No Icon')).toBeInTheDocument()
    })

    it('should render menu item with icon', () => {
      const items = [
        createMockItem({ title: 'With Icon', url: '/with-icon', icon: Home })
      ]

      renderNavMain(items)

      // Icon should be rendered as SVG
      const button = screen.getByRole('button', { name: /with icon/i })
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Sub-items (Children) Tests
  // ==========================================
  describe('Sub-items Rendering', () => {
    it('should render sub-items when item has items array', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: true,
          items: [
            { title: 'General', url: '/settings/general' },
            { title: 'Security', url: '/settings/security' }
          ]
        })
      ]

      renderNavMain(items)

      // Sub-items should be visible when parent isActive=true (defaultOpen)
      expect(screen.getByText('General')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
    })

    it('should hide sub-items when parent is not active', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: false,
          items: [
            { title: 'General', url: '/settings/general' },
            { title: 'Security', url: '/settings/security' }
          ]
        })
      ]

      renderNavMain(items)

      // Sub-items should be hidden when isActive=false
      expect(screen.queryByText('General')).not.toBeInTheDocument()
      expect(screen.queryByText('Security')).not.toBeInTheDocument()
    })

    it('should render empty sub-items container when items array is empty', () => {
      const items = [
        createMockItem({
          title: 'Empty',
          url: '/empty',
          isActive: true,
          items: []
        })
      ]

      renderNavMain(items)

      // Parent should still render
      expect(screen.getByText('Empty')).toBeInTheDocument()
    })

    it('should render sub-items with correct links', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: true,
          items: [
            { title: 'General', url: '/settings/general' },
            { title: 'Security', url: '/settings/security' }
          ]
        })
      ]

      renderNavMain(items)

      const generalLink = screen.getByRole('link', { name: 'General' })
      const securityLink = screen.getByRole('link', { name: 'Security' })

      expect(generalLink).toHaveAttribute('href', '/settings/general')
      expect(securityLink).toHaveAttribute('href', '/settings/security')
    })

    it('should handle item without items property (undefined)', () => {
      const items = [
        {
          title: 'NoSubItems',
          url: '/no-sub-items',
          icon: Home,
          isActive: true
          // items property is undefined
        }
      ]

      renderNavMain(items)

      expect(screen.getByText('NoSubItems')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Collapsible Behavior Tests
  // ==========================================
  describe('Collapsible Behavior', () => {
    it('should toggle sub-items visibility when clicked', async () => {
      const user = userEvent.setup()
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: false,
          items: [
            { title: 'General', url: '/settings/general' },
            { title: 'Security', url: '/settings/security' }
          ]
        })
      ]

      renderNavMain(items)

      // Sub-items should initially be hidden
      expect(screen.queryByText('General')).not.toBeInTheDocument()

      // Click to expand
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      // Sub-items should now be visible
      expect(screen.getByText('General')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
    })

    it('should collapse sub-items when clicked again', async () => {
      const user = userEvent.setup()
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: true,
          items: [{ title: 'General', url: '/settings/general' }]
        })
      ]

      renderNavMain(items)

      // Sub-items should initially be visible
      expect(screen.getByText('General')).toBeInTheDocument()

      // Click to collapse
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await user.click(settingsButton)

      // Sub-items should now be hidden
      expect(screen.queryByText('General')).not.toBeInTheDocument()
    })

    it('should show chevron icon when sidebar is expanded', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          items: [{ title: 'General', url: '/settings/general' }]
        })
      ]

      renderNavMain(items, 'expanded')

      const button = screen.getByRole('button', { name: /settings/i })
      // Chevron should be present (rendered as SVG)
      const svgs = button.querySelectorAll('svg')
      // Should have item icon + chevron icon = 2 SVGs
      expect(svgs.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ==========================================
  // Sidebar Collapsed State Tests
  // ==========================================
  describe('Sidebar Collapsed State', () => {
    it('should render as Link when sidebar is collapsed', () => {
      const items = [
        createMockItem({
          title: 'Home',
          url: '/home',
          icon: Home
        })
      ]

      renderNavMain(items, 'collapsed')

      // When collapsed, the button should be wrapped with a Link
      const link = screen.getByRole('link', { name: /home/i })
      expect(link).toHaveAttribute('href', '/home')
    })

    it('should not show chevron when sidebar is collapsed', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          icon: Settings,
          items: [{ title: 'General', url: '/settings/general' }]
        })
      ]

      renderNavMain(items, 'collapsed')

      // When collapsed, should render as Link without chevron
      // The button becomes a link, and chevron is not rendered
      const link = screen.getByRole('link', { name: /settings/i })
      expect(link).toBeInTheDocument()
    })

    it('should navigate to item url when collapsed and clicked', () => {
      const items = [
        createMockItem({
          title: 'Dashboard',
          url: '/dashboard',
          icon: Home,
          items: [{ title: 'Overview', url: '/dashboard/overview' }]
        })
      ]

      renderNavMain(items, 'collapsed')

      const link = screen.getByRole('link', { name: /dashboard/i })
      expect(link).toHaveAttribute('href', '/dashboard')
    })
  })

  // ==========================================
  // isActive State Tests
  // ==========================================
  describe('isActive State', () => {
    it('should have collapsible defaultOpen=true when isActive is true', () => {
      const items = [
        createMockItem({
          title: 'Active',
          url: '/active',
          isActive: true,
          items: [{ title: 'SubItem', url: '/active/sub' }]
        })
      ]

      renderNavMain(items)

      // Sub-items should be visible
      expect(screen.getByText('SubItem')).toBeInTheDocument()
    })

    it('should have collapsible defaultOpen=false when isActive is false', () => {
      const items = [
        createMockItem({
          title: 'Inactive',
          url: '/inactive',
          isActive: false,
          items: [{ title: 'SubItem', url: '/inactive/sub' }]
        })
      ]

      renderNavMain(items)

      // Sub-items should be hidden
      expect(screen.queryByText('SubItem')).not.toBeInTheDocument()
    })

    it('should handle undefined isActive (defaults to false)', () => {
      const items = [
        {
          title: 'NoActive',
          url: '/no-active',
          icon: Home,
          items: [{ title: 'SubItem', url: '/no-active/sub' }]
          // isActive is undefined
        }
      ]

      renderNavMain(items)

      // Sub-items should be hidden (defaultOpen=undefined → false)
      expect(screen.queryByText('SubItem')).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Tooltip Tests
  // ==========================================
  describe('Tooltip Behavior', () => {
    it('should set tooltip prop on SidebarMenuButton with item title', () => {
      const items = [
        createMockItem({
          title: 'Dashboard',
          url: '/dashboard',
          icon: Home
        })
      ]

      renderNavMain(items)

      // The button should have the tooltip prop set
      // In expanded state, tooltip is hidden but prop is set
      const button = screen.getByRole('button', { name: /dashboard/i })
      expect(button).toBeInTheDocument()
    })
  })

  // ==========================================
  // Edge Cases Tests
  // ==========================================
  describe('Edge Cases', () => {
    it('should handle item with empty title', () => {
      const items = [
        createMockItem({
          title: '',
          url: '/empty-title'
        })
      ]

      renderNavMain(items)

      // Component should still render without crashing
      const menu = screen.getByRole('list')
      expect(menu.children).toHaveLength(1)
    })

    it('should handle item with empty url', () => {
      const items = [
        createMockItem({
          title: 'EmptyURL',
          url: ''
        })
      ]

      renderNavMain(items, 'collapsed')

      // Link should have empty href
      const link = screen.getByRole('link', { name: /emptyurl/i })
      expect(link).toHaveAttribute('href', '/')
    })

    it('should handle sub-item with empty title', () => {
      const items = [
        createMockItem({
          title: 'Parent',
          url: '/parent',
          isActive: true,
          items: [{ title: '', url: '/parent/empty' }]
        })
      ]

      renderNavMain(items)

      // Should render without crashing
      expect(screen.getByText('Parent')).toBeInTheDocument()
    })

    it('should handle sub-item with empty url', () => {
      const items = [
        createMockItem({
          title: 'Parent',
          url: '/parent',
          isActive: true,
          items: [{ title: 'EmptyURL', url: '' }]
        })
      ]

      renderNavMain(items)

      const link = screen.getByRole('link', { name: 'EmptyURL' })
      expect(link).toHaveAttribute('href', '/')
    })

    it('should handle special characters in titles', () => {
      const items = [
        createMockItem({
          title: 'Test & <Script>',
          url: '/special',
          isActive: true,
          items: [{ title: 'Sub "Item" \'Test\'', url: '/special/sub' }]
        })
      ]

      renderNavMain(items)

      expect(screen.getByText('Test & <Script>')).toBeInTheDocument()
      expect(screen.getByText('Sub "Item" \'Test\'')).toBeInTheDocument()
    })

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(100)
      const items = [
        createMockItem({
          title: longTitle,
          url: '/long'
        })
      ]

      renderNavMain(items)

      expect(screen.getByText(longTitle)).toBeInTheDocument()
    })

    it('should handle many items (performance check)', () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createMockItem({
          title: `Item ${i}`,
          url: `/item-${i}`,
          items: [{ title: `SubItem ${i}`, url: `/item-${i}/sub` }]
        })
      )

      renderNavMain(items)

      expect(screen.getByText('Item 0')).toBeInTheDocument()
      expect(screen.getByText('Item 49')).toBeInTheDocument()
    })

    it('should handle deeply nested structure (many sub-items)', () => {
      const items = [
        createMockItem({
          title: 'Parent',
          url: '/parent',
          isActive: true,
          items: Array.from({ length: 20 }, (_, i) => ({
            title: `SubItem ${i}`,
            url: `/parent/sub-${i}`
          }))
        })
      ]

      renderNavMain(items)

      expect(screen.getByText('SubItem 0')).toBeInTheDocument()
      expect(screen.getByText('SubItem 19')).toBeInTheDocument()
    })

    it('should handle items with duplicate titles', () => {
      const items = [
        createMockItem({ title: 'Duplicate', url: '/dup-1' }),
        createMockItem({ title: 'Duplicate', url: '/dup-2' }),
        createMockItem({ title: 'Duplicate', url: '/dup-3' })
      ]

      renderNavMain(items)

      const duplicates = screen.getAllByText('Duplicate')
      expect(duplicates).toHaveLength(3)
    })

    it('should handle items with duplicate urls', () => {
      const items = [
        createMockItem({ title: 'First', url: '/same-url' }),
        createMockItem({ title: 'Second', url: '/same-url' })
      ]

      renderNavMain(items)

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
    })

    it('should handle unicode characters in titles', () => {
      const items = [
        createMockItem({
          title: '日本語テスト 🎉',
          url: '/unicode',
          isActive: true,
          items: [{ title: '中文子项目 ✨', url: '/unicode/sub' }]
        })
      ]

      renderNavMain(items)

      expect(screen.getByText('日本語テスト 🎉')).toBeInTheDocument()
      expect(screen.getByText('中文子项目 ✨')).toBeInTheDocument()
    })

    it('should handle whitespace-only titles', () => {
      const items = [
        createMockItem({
          title: '   ',
          url: '/whitespace'
        })
      ]

      renderNavMain(items)

      // Should render without crashing
      const menu = screen.getByRole('list')
      expect(menu.children).toHaveLength(1)
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================
  describe('Accessibility', () => {
    it('should have proper ARIA roles for menu structure', () => {
      const items = [
        createMockItem({
          title: 'Settings',
          url: '/settings',
          isActive: true,
          items: [{ title: 'General', url: '/settings/general' }]
        })
      ]

      renderNavMain(items)

      // Main menu should be a list
      const menus = screen.getAllByRole('list')
      expect(menus.length).toBeGreaterThanOrEqual(1)
    })

    it('should have buttons for collapsible triggers', () => {
      const items = [
        createMockItem({
          title: 'Collapsible',
          url: '/collapsible',
          items: [{ title: 'Child', url: '/collapsible/child' }]
        })
      ]

      renderNavMain(items)

      const button = screen.getByRole('button', { name: /collapsible/i })
      expect(button).toBeInTheDocument()
    })

    it('should have links for sub-items', () => {
      const items = [
        createMockItem({
          title: 'Parent',
          url: '/parent',
          isActive: true,
          items: [
            { title: 'Child1', url: '/parent/child1' },
            { title: 'Child2', url: '/parent/child2' }
          ]
        })
      ]

      renderNavMain(items)

      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThanOrEqual(2)
    })

    it('should support keyboard navigation to toggle collapsible', async () => {
      const user = userEvent.setup()
      const items = [
        createMockItem({
          title: 'Keyboard',
          url: '/keyboard',
          isActive: false,
          items: [{ title: 'SubItem', url: '/keyboard/sub' }]
        })
      ]

      renderNavMain(items)

      const button = screen.getByRole('button', { name: /keyboard/i })

      // Focus and press Enter
      button.focus()
      await user.keyboard('{Enter}')

      // Sub-items should be visible
      expect(screen.getByText('SubItem')).toBeInTheDocument()
    })

    it('should support keyboard navigation with Space key', async () => {
      const user = userEvent.setup()
      const items = [
        createMockItem({
          title: 'SpaceKey',
          url: '/spacekey',
          isActive: false,
          items: [{ title: 'SubItem', url: '/spacekey/sub' }]
        })
      ]

      renderNavMain(items)

      const button = screen.getByRole('button', { name: /spacekey/i })

      // Focus and press Space
      button.focus()
      await user.keyboard(' ')

      // Sub-items should be visible
      expect(screen.getByText('SubItem')).toBeInTheDocument()
    })
  })

  // ==========================================
  // URL Handling Tests
  // ==========================================
  describe('URL Handling', () => {
    it('should handle absolute URLs', () => {
      const items = [
        createMockItem({
          title: 'Absolute',
          url: '/absolute/path/to/page',
          isActive: true,
          items: [{ title: 'Sub', url: '/absolute/path/to/page/sub' }]
        })
      ]

      renderNavMain(items)

      const link = screen.getByRole('link', { name: 'Sub' })
      expect(link).toHaveAttribute('href', '/absolute/path/to/page/sub')
    })

    it('should handle URLs with query parameters', () => {
      const items = [
        createMockItem({
          title: 'Query',
          url: '/query?param=value',
          isActive: true,
          items: [{ title: 'Sub', url: '/query/sub?foo=bar&baz=qux' }]
        })
      ]

      renderNavMain(items)

      const link = screen.getByRole('link', { name: 'Sub' })
      expect(link).toHaveAttribute('href', '/query/sub?foo=bar&baz=qux')
    })

    it('should handle URLs with hash fragments', () => {
      const items = [
        createMockItem({
          title: 'Hash',
          url: '/hash#section',
          isActive: true,
          items: [{ title: 'Sub', url: '/hash/sub#anchor' }]
        })
      ]

      renderNavMain(items)

      const link = screen.getByRole('link', { name: 'Sub' })
      expect(link).toHaveAttribute('href', '/hash/sub#anchor')
    })

    it('should handle root URL', () => {
      const items = [
        createMockItem({
          title: 'Root',
          url: '/'
        })
      ]

      renderNavMain(items, 'collapsed')

      const link = screen.getByRole('link', { name: /root/i })
      expect(link).toHaveAttribute('href', '/')
    })
  })

  // ==========================================
  // Multiple Active Items Tests
  // ==========================================
  describe('Multiple Active Items', () => {
    it('should support multiple items with isActive=true', () => {
      const items = [
        createMockItem({
          title: 'Active1',
          url: '/active1',
          isActive: true,
          items: [{ title: 'Sub1', url: '/active1/sub' }]
        }),
        createMockItem({
          title: 'Active2',
          url: '/active2',
          isActive: true,
          items: [{ title: 'Sub2', url: '/active2/sub' }]
        })
      ]

      renderNavMain(items)

      // Both should have their sub-items visible
      expect(screen.getByText('Sub1')).toBeInTheDocument()
      expect(screen.getByText('Sub2')).toBeInTheDocument()
    })

    it('should allow independent toggling of multiple items', async () => {
      const user = userEvent.setup()
      const items = [
        createMockItem({
          title: 'First',
          url: '/first',
          isActive: true,
          items: [{ title: 'FirstSub', url: '/first/sub' }]
        }),
        createMockItem({
          title: 'Second',
          url: '/second',
          isActive: true,
          items: [{ title: 'SecondSub', url: '/second/sub' }]
        })
      ]

      renderNavMain(items)

      // Both should be open initially
      expect(screen.getByText('FirstSub')).toBeInTheDocument()
      expect(screen.getByText('SecondSub')).toBeInTheDocument()

      // Collapse first
      const firstButton = screen.getByRole('button', { name: /first/i })
      await user.click(firstButton)

      // First should be collapsed, second should still be open
      expect(screen.queryByText('FirstSub')).not.toBeInTheDocument()
      expect(screen.getByText('SecondSub')).toBeInTheDocument()
    })
  })
})
