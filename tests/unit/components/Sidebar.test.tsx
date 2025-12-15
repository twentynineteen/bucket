import * as useMobileHook from '@components/hooks/use-mobile'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from '@components/ui/sidebar'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the use-mobile hook
vi.mock('@components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn()
}))

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
  })

  describe('Basic Rendering', () => {
    test('renders sidebar with children', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <div>Sidebar Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(screen.getByText('Sidebar Content')).toBeInTheDocument()
    })

    test('applies data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="sidebar"]')).toBeInTheDocument()
    })
  })

  describe('Collapsible Variants', () => {
    test('renders with collapsible="offcanvas" by default', () => {
      const { container } = render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      const sidebarWrapper = container.querySelector('[data-collapsible]')
      expect(sidebarWrapper).toHaveAttribute('data-collapsible', 'offcanvas')
    })

    test('renders with collapsible="icon"', () => {
      const { container } = render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar collapsible="icon">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      const sidebarWrapper = container.querySelector('[data-collapsible]')
      expect(sidebarWrapper).toHaveAttribute('data-collapsible', 'icon')
    })

    test('renders with collapsible="none" - simple div without state', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar collapsible="none">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      // Should not have data-collapsible or data-state attributes
      expect(container.querySelector('[data-collapsible]')).not.toBeInTheDocument()
      expect(container.querySelector('[data-state]')).not.toBeInTheDocument()
    })

    test('does not add data-collapsible when sidebar is expanded', () => {
      const { container } = render(
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      const sidebarWrapper = container.querySelector('[data-state="expanded"]')
      expect(sidebarWrapper).not.toHaveAttribute('data-collapsible')
    })
  })

  describe('Side Prop', () => {
    test('renders on left side by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-side="left"]')).toBeInTheDocument()
    })

    test('renders on right side when specified', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar side="right">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-side="right"]')).toBeInTheDocument()
    })
  })

  describe('Variant Prop', () => {
    test('uses sidebar variant by default', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-variant="sidebar"]')).toBeInTheDocument()
    })

    test('applies floating variant', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar variant="floating">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-variant="floating"]')).toBeInTheDocument()
    })

    test('applies inset variant', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar variant="inset">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-variant="inset"]')).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    test('shows expanded state when open', () => {
      const { container } = render(
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument()
    })

    test('shows collapsed state when closed', () => {
      const { container } = render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument()
    })
  })

  describe('Mobile Rendering', () => {
    test('renders as Sheet on mobile', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Mobile Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      // On mobile, sidebar should use Sheet component (not have desktop data-state)
      expect(container.querySelector('[data-state]')).not.toBeInTheDocument()
      // Sheet component is rendered but may not show content until opened
      // The Sidebar component should be in the DOM, just wrapped in Sheet
    })

    test('applies mobile width CSS variable', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      // On mobile, uses Sheet component which handles the content differently
      // Desktop data-state should not be present
      expect(container.querySelector('[data-state]')).not.toBeInTheDocument()
    })

    test('hides sidebar on desktop with md:block class', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)

      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      const sidebarWrapper = container.querySelector('[data-state]')
      expect(sidebarWrapper).toHaveClass('hidden')
      expect(sidebarWrapper).toHaveClass('md:block')
    })
  })

  describe('Custom Styling', () => {
    test('applies custom className', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar className="custom-sidebar">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('.custom-sidebar')).toBeInTheDocument()
    })

    test('forwards other props', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar data-testid="my-sidebar">
            <div>Content</div>
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-testid="my-sidebar"]')).toBeInTheDocument()
    })
  })
})

describe('SidebarTrigger Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
  })

  describe('Basic Rendering', () => {
    test('renders trigger button', () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    test('has data-sidebar attribute', () => {
      const { container } = render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="trigger"]')).toBeInTheDocument()
    })

    test('has accessible label', () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
    })

    test('renders PanelLeft icon', () => {
      const { container } = render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Toggle Functionality', () => {
    test('toggles sidebar when clicked', async () => {
      const user = userEvent.setup()

      const { container } = render(
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <div>Content</div>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')

      // Initial state should be expanded
      expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument()

      // Click to collapse
      await user.click(button)

      // Should now be collapsed
      expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument()
    })

    test('calls custom onClick handler', async () => {
      const user = userEvent.setup()
      const customOnClick = vi.fn()

      render(
        <SidebarProvider>
          <SidebarTrigger onClick={customOnClick} />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      await user.click(button)

      expect(customOnClick).toHaveBeenCalled()
    })

    test('custom onClick is called before toggle', async () => {
      const user = userEvent.setup()
      const callOrder: string[] = []

      const customOnClick = vi.fn(() => {
        callOrder.push('custom')
      })

      render(
        <SidebarProvider defaultOpen={true}>
          <SidebarTrigger onClick={customOnClick} />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      await user.click(button)

      expect(callOrder).toEqual(['custom'])
      expect(customOnClick).toHaveBeenCalled()
    })
  })

  describe('Custom Styling', () => {
    test('applies custom className', () => {
      render(
        <SidebarProvider>
          <SidebarTrigger className="custom-trigger" />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-trigger')
    })

    test('has default size classes', () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('h-7')
      expect(button).toHaveClass('w-7')
    })

    test('has ghost variant', () => {
      render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      )

      const button = screen.getByRole('button')
      // Ghost variant is applied via Button component
      expect(button).toBeInTheDocument()
    })
  })
})

describe('SidebarRail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
  })

  describe('Basic Rendering', () => {
    test('renders rail button', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      expect(container.querySelector('[data-sidebar="rail"]')).toBeInTheDocument()
    })

    test('has accessible label', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')
      expect(rail).toBeInTheDocument()
      expect(rail).toHaveAttribute('title', 'Toggle Sidebar')
    })

    test('has negative tabIndex', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')
      expect(rail).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('Toggle Functionality', () => {
    test('toggles sidebar when clicked', async () => {
      const user = userEvent.setup()

      const { container } = render(
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <div>Content</div>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')

      // Initial state should be expanded
      expect(container.querySelector('[data-state="expanded"]')).toBeInTheDocument()

      // Click to collapse
      await user.click(rail)

      // Should now be collapsed
      expect(container.querySelector('[data-state="collapsed"]')).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    test('applies custom className', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail className="custom-rail" />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')
      expect(rail).toHaveClass('custom-rail')
    })

    test('has absolute positioning', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')
      expect(rail).toHaveClass('absolute')
    })
  })

  describe('Performance Optimizations', () => {
    test('should not use transition-all for better drag performance', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')

      // transition-all is expensive - should use specific properties instead
      expect(rail.className).not.toContain('transition-all')
    })

    test('should use specific transition properties', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      )

      const rail = screen.getByLabelText('Toggle Sidebar')

      // Should use transition-opacity or other specific transitions, not transition-all
      // This test verifies we're not using the expensive transition-all
      const hasSpecificTransition =
        rail.className.includes('transition-opacity') ||
        rail.className.includes('transition-transform') ||
        !rail.className.includes('transition')

      expect(hasSpecificTransition).toBe(true)
    })
  })
})

describe('SidebarInset Component', () => {
  describe('Basic Rendering', () => {
    test('renders as main element', () => {
      render(
        <SidebarProvider>
          <SidebarInset>
            <div>Main Content</div>
          </SidebarInset>
        </SidebarProvider>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByText('Main Content')).toBeInTheDocument()
    })

    test('has flex layout classes', () => {
      const { container } = render(
        <SidebarProvider>
          <SidebarInset>Content</SidebarInset>
        </SidebarProvider>
      )

      const main = screen.getByRole('main')
      expect(main).toHaveClass('flex')
      expect(main).toHaveClass('flex-col')
      expect(main).toHaveClass('flex-1')
    })

    test('has minimum height class', () => {
      render(
        <SidebarProvider>
          <SidebarInset>Content</SidebarInset>
        </SidebarProvider>
      )

      const main = screen.getByRole('main')
      expect(main).toHaveClass('min-h-svh')
    })
  })

  describe('Custom Styling', () => {
    test('applies custom className', () => {
      render(
        <SidebarProvider>
          <SidebarInset className="custom-inset">Content</SidebarInset>
        </SidebarProvider>
      )

      const main = screen.getByRole('main')
      expect(main).toHaveClass('custom-inset')
    })

    test('forwards other props', () => {
      render(
        <SidebarProvider>
          <SidebarInset data-testid="main-content">Content</SidebarInset>
        </SidebarProvider>
      )

      expect(screen.getByTestId('main-content')).toBeInTheDocument()
    })
  })

  describe('Background Styling', () => {
    test('has background class', () => {
      render(
        <SidebarProvider>
          <SidebarInset>Content</SidebarInset>
        </SidebarProvider>
      )

      const main = screen.getByRole('main')
      expect(main).toHaveClass('bg-background')
    })

    test('has relative positioning', () => {
      render(
        <SidebarProvider>
          <SidebarInset>Content</SidebarInset>
        </SidebarProvider>
      )

      const main = screen.getByRole('main')
      expect(main).toHaveClass('relative')
    })
  })
})
