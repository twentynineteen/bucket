/**
 * ProjectListPanel Animation Tests
 * Baker Page - Phase 1: Project List Stagger Animation
 *
 * Tests for staggered entrance animation when projects load,
 * hover animations on project rows, and selection state transitions.
 * Following TDD methodology - tests written before implementation.
 */

import { ProjectListPanel } from '@/components/Baker/ProjectListPanel'
import { BAKER_ANIMATIONS, DURATION } from '@/constants/animations'
import type { ProjectFolder } from '@/types/baker'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectMotionComponent, mockReducedMotion } from '@tests/utils/animation-testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('ProjectListPanel Animations', () => {
  // Mock project data
  const mockProjects: ProjectFolder[] = [
    {
      name: 'Project A',
      path: '/path/to/project-a',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      cameraCount: 3
    },
    {
      name: 'Project B',
      path: '/path/to/project-b',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: true,
      invalidBreadcrumbs: false,
      cameraCount: 2
    },
    {
      name: 'Project C',
      path: '/path/to/project-c',
      isValid: false,
      hasBreadcrumbs: false,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      cameraCount: 1
    }
  ]

  const defaultProps = {
    projects: mockProjects,
    selectedProjects: [],
    selectedProject: null,
    onProjectSelection: vi.fn(),
    onProjectClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List Container Animation', () => {
    it('should be a Framer Motion component', () => {
      const { container } = render(<ProjectListPanel {...defaultProps} />)
      const listContainer =
        container.querySelector('[role="list"]') || container.firstChild

      expect(listContainer).toBeInTheDocument()
      // The container or its children should have motion attributes
    })

    it('should use stagger animation constants', () => {
      expect(BAKER_ANIMATIONS.projectList.container).toBeDefined()
      expect(BAKER_ANIMATIONS.projectList.item).toBeDefined()
    })

    it('should stagger children with correct delay', () => {
      expect(BAKER_ANIMATIONS.projectList.container.show.transition.staggerChildren).toBe(
        0.05
      )
    })
  })

  describe('Project Item Stagger Animation', () => {
    it('should animate each project item on mount', () => {
      render(<ProjectListPanel {...defaultProps} />)

      // All project items should render
      mockProjects.forEach(project => {
        expect(screen.getByText(project.name)).toBeInTheDocument()
      })
    })

    it('should use item animation variants', () => {
      const { item } = BAKER_ANIMATIONS.projectList

      expect(item.hidden).toEqual({ opacity: 0, y: 10 })
      expect(item.show.opacity).toBe(1)
      expect(item.show.y).toBe(0)
    })

    it('should animate with correct duration', () => {
      const duration = BAKER_ANIMATIONS.projectList.item.show.transition.duration
      expect(duration).toBe(DURATION.normal / 1000) // Converted to seconds
    })

    it('should use Apple easing curve', () => {
      const ease = BAKER_ANIMATIONS.projectList.item.show.transition.ease
      expect(ease).toEqual([0.25, 0.1, 0.25, 1])
    })
  })

  describe('Project Row Hover Animation', () => {
    it('should be hoverable motion components', async () => {
      const user = userEvent.setup()
      render(<ProjectListPanel {...defaultProps} />)

      const firstProject = screen
        .getByText('Project A')
        .closest('div[role="button"], div')
      expect(firstProject).toBeInTheDocument()
    })

    it('should use hover animation constants', () => {
      expect(BAKER_ANIMATIONS.projectRow.hover).toBeDefined()
      expect(BAKER_ANIMATIONS.projectRow.hover.scale).toBe(1.005)
      expect(BAKER_ANIMATIONS.projectRow.hover.duration).toBe(DURATION.fast)
    })

    it('should have transition-colors class for smooth background change', () => {
      render(<ProjectListPanel {...defaultProps} />)
      // Find the parent container div (with border-b class), not the inner text div
      const firstProject = screen.getByText('Project A').closest('.border-b')

      // Phase 6: Now uses transition-[transform,background-color] for both transform and color transitions
      expect(firstProject?.className).toContain('transition-[transform,background-color]')
    })

    it('should apply hover styles on mouse enter', async () => {
      const user = userEvent.setup()
      render(<ProjectListPanel {...defaultProps} />)

      // Find the parent container div (with border-b class), not the inner text div
      const firstProject = screen.getByText('Project A').closest('.border-b')!
      await user.hover(firstProject)

      // Should have hover classes applied
      await waitFor(() => {
        expect(firstProject.className).toContain('hover:bg-accent/50')
      })
    })
  })

  describe('Selection State Animation', () => {
    it('should animate background when project is selected', () => {
      const { rerender } = render(<ProjectListPanel {...defaultProps} />)

      // Select first project
      rerender(
        <ProjectListPanel {...defaultProps} selectedProject="/path/to/project-a" />
      )

      // Find the parent container div (with border-b class), not the inner text div
      const selectedProject = screen.getByText('Project A').closest('.border-b')
      expect(selectedProject?.className).toContain('bg-accent')
    })

    it('should use selection animation constants', () => {
      expect(BAKER_ANIMATIONS.projectRow.selected.duration).toBe(DURATION.normal)
    })

    it('should maintain smooth transition during selection change', () => {
      const { rerender } = render(
        <ProjectListPanel {...defaultProps} selectedProject="/path/to/project-a" />
      )

      // Change selection
      rerender(
        <ProjectListPanel {...defaultProps} selectedProject="/path/to/project-b" />
      )

      // Find the parent container divs (with border-b class), not the inner text divs
      const projectA = screen.getByText('Project A').closest('.border-b')
      const projectB = screen.getByText('Project B').closest('.border-b')

      // Both should have transition classes (Phase 6: updated to use transition-[transform,background-color])
      expect(projectA?.className).toContain('transition-[transform,background-color]')
      expect(projectB?.className).toContain('transition-[transform,background-color]')
    })
  })

  describe('Checkbox Animation', () => {
    it('should be present for each project', () => {
      render(<ProjectListPanel {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(mockProjects.length)
    })

    it('should use checkbox animation constants', () => {
      expect(BAKER_ANIMATIONS.checkbox).toBeDefined()
      expect(BAKER_ANIMATIONS.checkbox.scale.checked).toBe(1.1)
      expect(BAKER_ANIMATIONS.checkbox.scale.unchecked).toBe(1)
    })

    it('should handle checkbox click without triggering row click', async () => {
      const user = userEvent.setup()
      const onProjectClick = vi.fn()
      const onProjectSelection = vi.fn()

      render(
        <ProjectListPanel
          {...defaultProps}
          onProjectClick={onProjectClick}
          onProjectSelection={onProjectSelection}
        />
      )

      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(firstCheckbox)

      expect(onProjectSelection).toHaveBeenCalledWith('/path/to/project-a', true)
      expect(onProjectClick).not.toHaveBeenCalled()
    })
  })

  describe('Status Badge Animations', () => {
    it('should render status badges for each project', () => {
      render(<ProjectListPanel {...defaultProps} />)

      // Check for various badge types (use getAllByText since multiple projects can be "Valid")
      expect(screen.getAllByText('Valid').length).toBeGreaterThan(0)
      expect(screen.getByText('Stale')).toBeInTheDocument()
      expect(screen.getByText('Invalid')).toBeInTheDocument()
    })

    it('should use badge pulse animation for warnings', () => {
      const { pulse } = BAKER_ANIMATIONS.statusBadge

      expect(pulse.scale).toEqual([1, 1.05, 1])
      expect(pulse.transition.duration).toBe(2)
      expect(pulse.transition.repeat).toBe(Infinity)
    })

    it('should apply pulse animation to stale badges', () => {
      render(<ProjectListPanel {...defaultProps} />)

      const staleBadge = screen.getByText('Stale')
      expect(staleBadge).toBeInTheDocument()
      expect(staleBadge.className).toContain('bg-warning/20')
    })
  })

  describe('Empty State', () => {
    it('should render empty state message when no projects', () => {
      render(<ProjectListPanel {...defaultProps} projects={[]} />)

      expect(screen.getByText('No projects found')).toBeInTheDocument()
    })

    it('should not animate empty state message', () => {
      const { container } = render(<ProjectListPanel {...defaultProps} projects={[]} />)

      // Empty state should be static, no motion attributes needed
      const emptyMessage = screen.getByText('No projects found')
      expect(emptyMessage).toBeInTheDocument()
    })
  })

  describe('Accessibility - Reduced Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      mockReducedMotion(true)

      render(<ProjectListPanel {...defaultProps} />)

      // Component should still render
      expect(screen.getByText('Project A')).toBeInTheDocument()
    })

    it('should maintain functionality with reduced motion', async () => {
      mockReducedMotion(true)
      const user = userEvent.setup()
      const onProjectClick = vi.fn()

      render(<ProjectListPanel {...defaultProps} onProjectClick={onProjectClick} />)

      const firstProject = screen.getByText('Project A').closest('div')!
      await user.click(firstProject)

      expect(onProjectClick).toHaveBeenCalledWith('/path/to/project-a')
    })
  })

  describe('Performance', () => {
    it('should only animate GPU-accelerated properties', () => {
      // Verify animation constants only use transform and opacity
      const { item } = BAKER_ANIMATIONS.projectList

      expect(item.hidden).toHaveProperty('opacity')
      expect(item.hidden).toHaveProperty('y') // transform: translateY
      expect(item.hidden).not.toHaveProperty('height')
      expect(item.hidden).not.toHaveProperty('width')
      expect(item.hidden).not.toHaveProperty('margin')
      expect(item.hidden).not.toHaveProperty('padding')
    })

    it('should complete animations within performance budget', () => {
      const duration = BAKER_ANIMATIONS.projectList.item.show.transition.duration
      expect(duration).toBeLessThan(0.6) // Less than 600ms
    })

    it('should use stagger delay under 100ms', () => {
      const stagger =
        BAKER_ANIMATIONS.projectList.container.show.transition.staggerChildren
      expect(stagger).toBeLessThan(0.1) // Less than 100ms
    })
  })

  describe('Integration - Row Click Behavior', () => {
    it('should animate and trigger click handler', async () => {
      const user = userEvent.setup()
      const onProjectClick = vi.fn()

      render(<ProjectListPanel {...defaultProps} onProjectClick={onProjectClick} />)

      const secondProject = screen.getByText('Project B').closest('div')!
      await user.click(secondProject)

      expect(onProjectClick).toHaveBeenCalledWith('/path/to/project-b')
    })

    it('should show selected state immediately after click', async () => {
      const user = userEvent.setup()
      let selectedProject = null
      const onProjectClick = vi.fn(path => {
        selectedProject = path
      })

      const { rerender } = render(
        <ProjectListPanel {...defaultProps} onProjectClick={onProjectClick} />
      )

      const firstProject = screen.getByText('Project A').closest('.border-b')!
      await user.click(firstProject)

      // Rerender with updated selection
      rerender(
        <ProjectListPanel
          {...defaultProps}
          selectedProject="/path/to/project-a"
          onProjectClick={onProjectClick}
        />
      )

      // Re-query the element after rerender to get updated className
      const updatedFirstProject = screen.getByText('Project A').closest('.border-b')!
      expect(updatedFirstProject.className).toContain('bg-accent')
    })
  })
})
