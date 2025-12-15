import * as useMobileHook from '@components/hooks/use-mobile'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarProvider,
  SidebarSeparator
} from '@components/ui/sidebar'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the use-mobile hook
vi.mock('@components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn()
}))

describe('Sidebar Layout Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
  })

  describe('SidebarHeader', () => {
    test('renders header div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="header"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div>Header Content</div>
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })

    test('has flex column layout with gap', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader />
          </Sidebar>
        </SidebarProvider>
      )

      const header = container.querySelector('[data-sidebar="header"]')
      expect(header).toHaveClass('flex')
      expect(header).toHaveClass('flex-col')
      expect(header).toHaveClass('gap-2')
    })

    test('has padding', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader />
          </Sidebar>
        </SidebarProvider>
      )

      const header = container.querySelector('[data-sidebar="header"]')
      expect(header).toHaveClass('p-2')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader className="custom-header" />
          </Sidebar>
        </SidebarProvider>
      )

      const header = container.querySelector('[data-sidebar="header"]')
      expect(header).toHaveClass('custom-header')
    })

    test('forwards other props', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader data-testid="my-header" />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-testid="my-header"]')).toBeInTheDocument()
    })
  })

  describe('SidebarFooter', () => {
    test('renders footer div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarFooter />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="footer"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarFooter>
              <div>Footer Content</div>
            </SidebarFooter>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Footer Content')).toBeInTheDocument()
    })

    test('has flex column layout with gap', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarFooter />
          </Sidebar>
        </SidebarProvider>
      )

      const footer = container.querySelector('[data-sidebar="footer"]')
      expect(footer).toHaveClass('flex')
      expect(footer).toHaveClass('flex-col')
      expect(footer).toHaveClass('gap-2')
    })

    test('has padding', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarFooter />
          </Sidebar>
        </SidebarProvider>
      )

      const footer = container.querySelector('[data-sidebar="footer"]')
      expect(footer).toHaveClass('p-2')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarFooter className="custom-footer" />
          </Sidebar>
        </SidebarProvider>
      )

      const footer = container.querySelector('[data-sidebar="footer"]')
      expect(footer).toHaveClass('custom-footer')
    })
  })

  describe('SidebarContent', () => {
    test('renders content div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="content"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <div>Main Content</div>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Main Content')).toBeInTheDocument()
    })

    test('has flex column layout', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="content"]')
      expect(content).toHaveClass('flex')
      expect(content).toHaveClass('flex-col')
      expect(content).toHaveClass('flex-1')
    })

    test('has overflow-auto', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent />
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="content"]')
      expect(content).toHaveClass('overflow-auto')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent className="custom-content" />
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="content"]')
      expect(content).toHaveClass('custom-content')
    })
  })

  describe('SidebarGroup', () => {
    test('renders group div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="group"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <div>Group Content</div>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Group Content')).toBeInTheDocument()
    })

    test('has flex column layout', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const group = container.querySelector('[data-sidebar="group"]')
      expect(group).toHaveClass('flex')
      expect(group).toHaveClass('flex-col')
    })

    test('has relative positioning', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const group = container.querySelector('[data-sidebar="group"]')
      expect(group).toHaveClass('relative')
    })

    test('has padding', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const group = container.querySelector('[data-sidebar="group"]')
      expect(group).toHaveClass('p-2')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup className="custom-group" />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const group = container.querySelector('[data-sidebar="group"]')
      expect(group).toHaveClass('custom-group')
    })
  })

  describe('SidebarGroupLabel', () => {
    test('renders as div by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Label</SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const label = container.querySelector('[data-sidebar="group-label"]')
      expect(label?.tagName).toBe('DIV')
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Label</SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="group-label"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Navigation')).toBeInTheDocument()
    })

    test('has flex layout', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Label</SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const label = container.querySelector('[data-sidebar="group-label"]')
      expect(label).toHaveClass('flex')
      expect(label).toHaveClass('items-center')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel className="custom-label">Label</SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const label = container.querySelector('[data-sidebar="group-label"]')
      expect(label).toHaveClass('custom-label')
    })

    test('uses asChild to render custom element', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <button>Button Label</button>
                </SidebarGroupLabel>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const button = screen.getByRole('button', { name: 'Button Label' })
      expect(button).toBeInTheDocument()
    })
  })

  describe('SidebarGroupAction', () => {
    test('renders as button by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction>Action</SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="group-action"]')
      expect(action?.tagName).toBe('BUTTON')
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction>Action</SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="group-action"]')).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction>
                  <span>+</span>
                </SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('+')).toBeInTheDocument()
    })

    test('has absolute positioning', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction>Action</SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="group-action"]')
      expect(action).toHaveClass('absolute')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction className="custom-action">Action</SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const action = container.querySelector('[data-sidebar="group-action"]')
      expect(action).toHaveClass('custom-action')
    })

    test('uses asChild to render custom element', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupAction asChild>
                  <a href="/add">Add Item</a>
                </SidebarGroupAction>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const link = screen.getByRole('link', { name: 'Add Item' })
      expect(link).toHaveAttribute('href', '/add')
    })
  })

  describe('SidebarGroupContent', () => {
    test('renders content div', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent />
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(
        container.querySelector('[data-sidebar="group-content"]')
      ).toBeInTheDocument()
    })

    test('renders children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <div>Group Items</div>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Group Items')).toBeInTheDocument()
    })

    test('has full width', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent />
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="group-content"]')
      expect(content).toHaveClass('w-full')
    })

    test('has text size class', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent />
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="group-content"]')
      expect(content).toHaveClass('text-sm')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent className="custom-group-content" />
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const content = container.querySelector('[data-sidebar="group-content"]')
      expect(content).toHaveClass('custom-group-content')
    })
  })

  describe('SidebarInput', () => {
    test('renders input element', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="input"]')).toBeInTheDocument()
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      const input = container.querySelector('input')
      expect(input).toHaveAttribute('data-sidebar', 'input')
    })

    test('accepts placeholder prop', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput placeholder="Search..." />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      const input = container.querySelector('input')
      expect(input).toHaveAttribute('placeholder', 'Search...')
    })

    test('accepts value prop', async () => {
      const user = userEvent.setup()

      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'test')

      expect(input).toHaveValue('test')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput className="custom-input" />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      const input = container.querySelector('input')
      expect(input).toHaveClass('custom-input')
    })

    test('forwards other input props', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput type="search" data-testid="search-input" />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      )

      const input = container.querySelector('input')
      expect(input).toHaveAttribute('type', 'search')
      expect(input).toHaveAttribute('data-testid', 'search-input')
    })
  })

  describe('SidebarSeparator', () => {
    test('renders separator', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="separator"]')).toBeInTheDocument()
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const separator = container.querySelector('[data-sidebar="separator"]')
      expect(separator).toBeInTheDocument()
    })

    test('has horizontal margin', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const separator = container.querySelector('[data-sidebar="separator"]')
      expect(separator).toHaveClass('mx-2')
    })

    test('has auto width', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const separator = container.querySelector('[data-sidebar="separator"]')
      expect(separator).toHaveClass('w-auto')
    })

    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator className="custom-separator" />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      const separator = container.querySelector('[data-sidebar="separator"]')
      expect(separator).toHaveClass('custom-separator')
    })

    test('forwards other props', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarSeparator data-testid="my-separator" />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-testid="my-separator"]')).toBeInTheDocument()
    })
  })
})
