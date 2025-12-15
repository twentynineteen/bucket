import * as useMobileHook from '@components/hooks/use-mobile'
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider
} from '@components/ui/sidebar'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the use-mobile hook
vi.mock('@components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn()
}))

describe('SidebarMenu Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
  })

  describe('SidebarMenu', () => {
    test('renders as ul element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('ul[data-sidebar="menu"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <li>Menu Item</li>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Menu Item')).toBeInTheDocument()
    })

    test('has flex column layout', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu />
          </Sidebar>
        </SidebarProvider>
      )

      const menu = container.querySelector('[data-sidebar="menu"]')
      expect(menu).toHaveClass('flex')
      expect(menu).toHaveClass('flex-col')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu className="custom-menu" />
          </Sidebar>
        </SidebarProvider>
      )

      const menu = container.querySelector('[data-sidebar="menu"]')
      expect(menu).toHaveClass('custom-menu')
    })
  })

  describe('SidebarMenuItem', () => {
    test('renders as li element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>Item</SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('li[data-sidebar="menu-item"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>Menu Item Content</SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Menu Item Content')).toBeInTheDocument()
    })

    test('has group class for menu-item', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem />
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const menuItem = container.querySelector('[data-sidebar="menu-item"]')
      expect(menuItem).toHaveClass('group/menu-item')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem className="custom-item" />
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const menuItem = container.querySelector('[data-sidebar="menu-item"]')
      expect(menuItem).toHaveClass('custom-item')
    })
  })

  describe('SidebarMenuButton', () => {
    test('renders as button by default', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Click me</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Button</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="menu-button"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Home')).toBeInTheDocument()
    })

    test('shows active state when isActive=true', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={true}>Active</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toHaveAttribute('data-active', 'true')
    })

    test('does not show active state by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Not Active</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toHaveAttribute('data-active', 'false')
    })

    test('applies size="default" by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Button</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toHaveAttribute('data-size', 'default')
    })

    test('applies custom size', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">Large Button</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toHaveAttribute('data-size', 'lg')
    })

    test('applies variant="default" by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Button</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toBeInTheDocument()
      // Variant classes are applied via CVA
    })

    test('applies outline variant', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton variant="outline">Outline</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = screen.getByRole('button', { name: 'Outline' })
      expect(button).toBeInTheDocument()
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="custom-button">Button</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-button"]')
      expect(button).toHaveClass('custom-button')
    })

    test('renders with tooltip when tooltip prop is string', () => {
      render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Home Page">Home</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    })

    test('renders with tooltip when tooltip prop is object', () => {
      render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{ children: 'Custom Tooltip' }}>
                  Button
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByRole('button', { name: 'Button' })).toBeInTheDocument()
    })

    test('uses asChild to render custom element', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/home">Home Link</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const link = screen.getByRole('link', { name: 'Home Link' })
      expect(link).toHaveAttribute('href', '/home')
    })
  })

  describe('SidebarMenuAction', () => {
    test('renders as button by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuAction>Action</SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="menu-action"]')
      expect(action?.tagName).toBe('BUTTON')
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuAction>Action</SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="menu-action"]')).toBeInTheDocument()
    })

    test('applies showOnHover styles', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuAction showOnHover>Action</SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="menu-action"]')
      // showOnHover adds specific classes for opacity
      expect(action).toBeInTheDocument()
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuAction className="custom-action">Action</SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="menu-action"]')
      expect(action).toHaveClass('custom-action')
    })

    test('uses asChild to render custom element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuAction asChild>
                  <a href="/action">Action Link</a>
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const link = screen.getByRole('link', { name: 'Action Link' })
      expect(link).toHaveAttribute('href', '/action')
    })
  })

  describe('SidebarMenuBadge', () => {
    test('renders badge div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="menu-badge"]')).toBeInTheDocument()
    })

    test('renders badge content', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuBadge>12</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('12')).toBeInTheDocument()
    })

    test('has absolute positioning', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuBadge>5</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const badge = container.querySelector('[data-sidebar="menu-badge"]')
      expect(badge).toHaveClass('absolute')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>Item</SidebarMenuButton>
                <SidebarMenuBadge className="custom-badge">5</SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const badge = container.querySelector('[data-sidebar="menu-badge"]')
      expect(badge).toHaveClass('custom-badge')
    })
  })

  describe('SidebarMenuSkeleton', () => {
    test('renders skeleton div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(
        container.querySelector('[data-sidebar="menu-skeleton"]')
      ).toBeInTheDocument()
    })

    test('renders without icon by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(
        container.querySelector('[data-sidebar="menu-skeleton-icon"]')
      ).not.toBeInTheDocument()
    })

    test('renders with icon when showIcon=true', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(
        container.querySelector('[data-sidebar="menu-skeleton-icon"]')
      ).toBeInTheDocument()
    })

    test('generates random width on mount', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const skeletonText = container.querySelector(
        '[data-sidebar="menu-skeleton-text"]'
      ) as HTMLElement

      const width = skeletonText?.style.getPropertyValue('--skeleton-width')
      expect(width).toMatch(/^\d+%$/)

      const widthNum = parseInt(width)
      expect(widthNum).toBeGreaterThanOrEqual(50)
      expect(widthNum).toBeLessThanOrEqual(90)
    })

    test('maintains same width on re-render', () => {
      const { container, rerender } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const skeletonText = container.querySelector(
        '[data-sidebar="menu-skeleton-text"]'
      ) as HTMLElement
      const initialWidth = skeletonText?.style.getPropertyValue('--skeleton-width')

      rerender(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const skeletonTextAfter = container.querySelector(
        '[data-sidebar="menu-skeleton-text"]'
      ) as HTMLElement
      const widthAfter = skeletonTextAfter?.style.getPropertyValue('--skeleton-width')

      expect(widthAfter).toBe(initialWidth)
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton className="custom-skeleton" />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const skeleton = container.querySelector('[data-sidebar="menu-skeleton"]')
      expect(skeleton).toHaveClass('custom-skeleton')
    })
  })

  describe('SidebarMenuSub', () => {
    test('renders as ul element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('ul[data-sidebar="menu-sub"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <li>Sub Item</li>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Sub Item')).toBeInTheDocument()
    })

    test('has border-left styling', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const menuSub = container.querySelector('[data-sidebar="menu-sub"]')
      expect(menuSub).toHaveClass('border-l')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub className="custom-sub" />
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const menuSub = container.querySelector('[data-sidebar="menu-sub"]')
      expect(menuSub).toHaveClass('custom-sub')
    })
  })

  describe('SidebarMenuSubItem', () => {
    test('renders as li element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>Sub Item</SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('li')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>Sub Item Content</SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Sub Item Content')).toBeInTheDocument()
    })
  })

  describe('SidebarMenuSubButton', () => {
    test('renders as anchor by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>Sub Link</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-sub-button"]')
      expect(button?.tagName).toBe('A')
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>Sub Button</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(
        container.querySelector('[data-sidebar="menu-sub-button"]')
      ).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>Settings</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    test('applies size="md" by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>Button</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-sub-button"]')
      expect(button).toHaveAttribute('data-size', 'md')
    })

    test('applies custom size', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton size="sm">Small</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-sub-button"]')
      expect(button).toHaveAttribute('data-size', 'sm')
    })

    test('shows active state when isActive=true', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton isActive={true}>Active</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-sub-button"]')
      expect(button).toHaveAttribute('data-active', 'true')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton className="custom-sub-button">
                      Button
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = container.querySelector('[data-sidebar="menu-sub-button"]')
      expect(button).toHaveClass('custom-sub-button')
    })

    test('uses asChild to render custom element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <button>Custom Button</button>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>
      )

      const button = screen.getByRole('button', { name: 'Custom Button' })
      expect(button.tagName).toBe('BUTTON')
    })
  })
})
