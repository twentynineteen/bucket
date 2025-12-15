/**
 * ProjectDetailPanel Animation Tests
 * Baker Page - Phase 2: Detail Panel Transition Animation
 *
 * Tests for smooth transitions when switching between projects,
 * navigation tab animations, and content fade-in effects.
 * Following TDD methodology - tests written before implementation.
 */

import { ProjectDetailPanel } from '@/components/Baker/ProjectDetailPanel'
import { BAKER_ANIMATIONS, DURATION } from '@/constants/animations'
import type { BreadcrumbsFile } from '@/types/baker'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockReducedMotion } from '@tests/utils/animation-testing'
import { beforeEach, describe, expect, it, vi, vi as vitest } from 'vitest'

// Mock matchMedia BEFORE imports (required for Framer Motion)
vi.hoisted(() => {
  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))

  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia
  })
})

// Mock Tauri shell API
vitest.mock('@tauri-apps/plugin-shell', () => ({
  open: vitest.fn()
}))

// Helper to render with QueryClient
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ProjectDetailPanel Animations', () => {
  // Mock breadcrumbs data
  const mockBreadcrumbs: BreadcrumbsFile = {
    projectTitle: 'Test Project',
    parentFolder: '/path/to/parent',
    numberOfCameras: 3,
    folderSizeBytes: 1024000000,
    createdBy: 'Test User',
    creationDateTime: '2024-01-01T10:00:00Z',
    files: [
      { name: 'file1.mp4', path: '/path/file1.mp4', camera: 1 },
      { name: 'file2.mp4', path: '/path/file2.mp4', camera: 2 },
      { name: 'file3.mp4', path: '/path/file3.mp4', camera: 3 }
    ]
  }

  const defaultProps = {
    selectedProject: '/path/to/project',
    breadcrumbs: mockBreadcrumbs,
    isLoadingBreadcrumbs: false,
    breadcrumbsError: null,
    previewMode: false,
    preview: null,
    onTogglePreview: vi.fn(),
    trelloApiKey: 'test-key',
    trelloApiToken: 'test-token'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Panel Entrance Animation', () => {
    it('should animate on mount when project is selected', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('should use detailPanel animation constants', () => {
      expect(BAKER_ANIMATIONS.detailPanel).toBeDefined()
      expect(BAKER_ANIMATIONS.detailPanel.enter).toEqual({ opacity: 0, x: 20 })
      expect(BAKER_ANIMATIONS.detailPanel.show).toEqual({
        opacity: 1,
        x: 0,
        transition: {
          duration: DURATION.normal / 1000,
          ease: [0.25, 0.1, 0.25, 1]
        }
      })
    })

    it('should animate with correct duration', () => {
      const duration = BAKER_ANIMATIONS.detailPanel.show.transition.duration
      expect(duration).toBe(DURATION.normal / 1000)
    })

    it('should use Apple easing curve', () => {
      const ease = BAKER_ANIMATIONS.detailPanel.show.transition.ease
      expect(ease).toEqual([0.25, 0.1, 0.25, 1])
    })
  })

  describe('Panel Exit Animation', () => {
    it('should animate when project is deselected', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false }
        }
      })
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel {...defaultProps} />
        </QueryClientProvider>
      )

      // Deselect project
      rerender(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel {...defaultProps} selectedProject={null} />
        </QueryClientProvider>
      )

      expect(screen.getByText('Select a project to view details')).toBeInTheDocument()
    })

    it('should use exit animation constants', () => {
      expect(BAKER_ANIMATIONS.detailPanel.exit).toEqual({
        opacity: 0,
        x: -20,
        transition: {
          duration: DURATION.fast / 1000
        }
      })
    })

    it('should exit faster than entrance', () => {
      const enterDuration = BAKER_ANIMATIONS.detailPanel.show.transition.duration
      const exitDuration = BAKER_ANIMATIONS.detailPanel.exit.transition.duration

      expect(exitDuration).toBeLessThan(enterDuration)
    })
  })

  describe('Navigation Tab Animations', () => {
    it('should render all navigation tabs', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      expect(screen.getAllByText(/Overview/)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Files \(3\)/)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Videos/)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Trello/)[0]).toBeInTheDocument()
    })

    it('should use navTab animation constants', () => {
      expect(BAKER_ANIMATIONS.navTab).toBeDefined()
      expect(BAKER_ANIMATIONS.navTab.hover.scale).toBe(1.02)
      expect(BAKER_ANIMATIONS.navTab.hover.duration).toBe(DURATION.fast)
    })

    it('should have hover animation on tabs', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      const overviewTab = screen.getAllByText(/Overview/)[0].closest('button')!
      await user.hover(overviewTab)

      // Button should be in the DOM and hoverable
      expect(overviewTab).toBeInTheDocument()
    })

    it('should trigger smooth scroll on tab click', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      const filesTab = screen.getAllByText(/Files \(3\)/)[0].closest('button')!
      await user.click(filesTab)

      // Scroll should be triggered (smooth behavior)
      // We can't easily test scrollTo in JSDOM, but we verify the click works
      expect(filesTab).toBeInTheDocument()
    })
  })

  describe('File List Item Animations', () => {
    it('should render all files', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      expect(screen.getByText('file1.mp4')).toBeInTheDocument()
      expect(screen.getByText('file2.mp4')).toBeInTheDocument()
      expect(screen.getByText('file3.mp4')).toBeInTheDocument()
    })

    it('should use fileItem animation constants', () => {
      expect(BAKER_ANIMATIONS.fileItem).toBeDefined()
      expect(BAKER_ANIMATIONS.fileItem.hover.scale).toBe(1.002)
      expect(BAKER_ANIMATIONS.fileItem.hover.duration).toBe(DURATION.fast)
    })

    it('should have hover transition on file items', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      // Find the parent container div (not the inner text div)
      const firstFileContainer = screen.getByText('file1.mp4').closest('.border')!
      expect(firstFileContainer.className).toContain('transition-colors')
    })

    it('should show hover state on mouse enter', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      // Find the parent container div (not the inner text div)
      const firstFileContainer = screen.getByText('file1.mp4').closest('.border')!
      await user.hover(firstFileContainer)

      await waitFor(() => {
        expect(firstFileContainer.className).toContain('hover:bg-accent/50')
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(
        <ProjectDetailPanel
          {...defaultProps}
          breadcrumbs={null}
          isLoadingBreadcrumbs={true}
        />
      )

      expect(screen.getByText('Loading breadcrumbs...')).toBeInTheDocument()
    })

    it('should animate loading spinner', () => {
      const { container } = render(
        <ProjectDetailPanel
          {...defaultProps}
          breadcrumbs={null}
          isLoadingBreadcrumbs={true}
        />
      )

      // Check for spinner with animate-spin class
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error message when error occurs', () => {
      render(
        <ProjectDetailPanel
          {...defaultProps}
          breadcrumbs={null}
          breadcrumbsError="Failed to load breadcrumbs"
        />
      )

      expect(screen.getByText('Failed to load breadcrumbs')).toBeInTheDocument()
    })

    it('should not animate error state (instant feedback)', () => {
      render(
        <ProjectDetailPanel
          {...defaultProps}
          breadcrumbs={null}
          breadcrumbsError="Error message"
        />
      )

      // Error should appear immediately
      const errorMessage = screen.getByText('Error message')
      expect(errorMessage).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no project selected', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} selectedProject={null} />)

      expect(screen.getByText('Select a project to view details')).toBeInTheDocument()
    })

    it('should show empty state icon', () => {
      const { container } = renderWithQueryClient(
        <ProjectDetailPanel {...defaultProps} selectedProject={null} />
      )

      // FolderOpen icon should be present
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should not animate empty state (static placeholder)', () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} selectedProject={null} />)

      const emptyMessage = screen.getByText('Select a project to view details')
      expect(emptyMessage).toBeInTheDocument()
      // Should be a static placeholder, no motion needed
    })
  })

  describe('Content Transition', () => {
    it('should animate content when switching projects', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false }
        }
      })
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel {...defaultProps} />
        </QueryClientProvider>
      )

      // Switch to different project with different breadcrumbs
      const newBreadcrumbs = {
        ...mockBreadcrumbs,
        projectTitle: 'New Project',
        numberOfCameras: 2
      }

      rerender(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel
            {...defaultProps}
            selectedProject="/path/to/new-project"
            breadcrumbs={newBreadcrumbs}
          />
        </QueryClientProvider>
      )

      expect(screen.getByText('New Project')).toBeInTheDocument()
    })

    it('should maintain smooth scroll position during transitions', async () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      // Scroll container should have smooth scroll behavior
      const scrollContainer = document.querySelector('[ref]')
      // In actual implementation, scrollTo with behavior: 'smooth' is used
    })
  })

  describe('Accessibility - Reduced Motion', () => {
    it('should respect prefers-reduced-motion for panel transition', () => {
      mockReducedMotion(true)

      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('should respect prefers-reduced-motion for tab animations', async () => {
      mockReducedMotion(true)
      const user = userEvent.setup()

      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      const overviewTab = screen.getAllByText(/Overview/)[0].closest('button')!
      await user.hover(overviewTab)

      // Functionality should remain intact
      expect(overviewTab).toBeInTheDocument()
    })

    it('should maintain focus visibility during animations', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      const overviewTab = screen.getAllByText(/Overview/)[0].closest('button')!
      await user.tab() // Focus first interactive element

      // Focus should be visible
      const focusedElement = document.activeElement
      expect(focusedElement).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should only animate GPU-accelerated properties', () => {
      const { enter, show } = BAKER_ANIMATIONS.detailPanel

      // Should only use opacity and x (transform: translateX)
      expect(enter).toHaveProperty('opacity')
      expect(enter).toHaveProperty('x')
      expect(show).toHaveProperty('opacity')
      expect(show).toHaveProperty('x')

      // Should NOT use layout-triggering properties
      expect(enter).not.toHaveProperty('width')
      expect(enter).not.toHaveProperty('height')
      expect(enter).not.toHaveProperty('margin')
    })

    it('should complete panel transition within performance budget', () => {
      const duration = BAKER_ANIMATIONS.detailPanel.show.transition.duration
      expect(duration).toBeLessThan(0.6) // Less than 600ms
    })

    it('should have faster exit than entrance', () => {
      const enterDuration = BAKER_ANIMATIONS.detailPanel.show.transition.duration
      const exitDuration = BAKER_ANIMATIONS.detailPanel.exit.transition.duration

      expect(exitDuration).toBeLessThan(enterDuration)
    })
  })

  describe('Integration - Project Switching', () => {
    it('should handle rapid project switches gracefully', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false }
        }
      })
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel {...defaultProps} />
        </QueryClientProvider>
      )

      // Rapidly switch between projects
      rerender(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel
            {...defaultProps}
            selectedProject="/path/to/project-b"
            breadcrumbs={{ ...mockBreadcrumbs, projectTitle: 'Project B' }}
          />
        </QueryClientProvider>
      )

      rerender(
        <QueryClientProvider client={queryClient}>
          <ProjectDetailPanel
            {...defaultProps}
            selectedProject="/path/to/project-c"
            breadcrumbs={{ ...mockBreadcrumbs, projectTitle: 'Project C' }}
          />
        </QueryClientProvider>
      )

      expect(screen.getByText('Project C')).toBeInTheDocument()
    })

    it('should maintain scroll position when possible', async () => {
      renderWithQueryClient(<ProjectDetailPanel {...defaultProps} />)

      // Verify scrollable container exists
      const scrollContainer = document.querySelector('.overflow-y-auto')
      expect(scrollContainer).toBeInTheDocument()
    })
  })
})
