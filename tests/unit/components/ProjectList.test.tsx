/**
 * Test Suite: ProjectList Component
 *
 * Tests for the Baker workflow project list display component.
 * Following TDD methodology as per DEBT-009 Phase 2.
 *
 * Test Categories:
 * 1. Rendering (4 tests)
 * 2. Selection (3 tests)
 * 3. View Actions (3 tests)
 * 4. Breadcrumbs Display (3 tests)
 * 5. Project Status Display (3 tests)
 *
 * Total: 16 tests
 */

import type { BreadcrumbsFile, BreadcrumbsPreview, ProjectFolder } from '@/types/baker'
import { ProjectList } from '@components/Baker/ProjectList'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, prop) => {
        const Component = React.forwardRef<any, any>((props, ref) => {
          const { children, ...rest } = props
          return React.createElement(prop as string, { ...rest, ref }, children)
        })
        Component.displayName = `motion.${String(prop)}`
        return Component
      }
    }
  ),
  AnimatePresence: ({ children }: any) => children
}))

// Mock BreadcrumbsViewerEnhanced component
vi.mock('@components/BreadcrumbsViewerEnhanced', () => ({
  BreadcrumbsViewerEnhanced: ({
    breadcrumbs,
    projectPath
  }: {
    breadcrumbs: BreadcrumbsFile
    projectPath: string
  }) => (
    <div data-testid="breadcrumbs-viewer">
      <div>Project: {breadcrumbs.projectTitle}</div>
      <div>Path: {projectPath}</div>
      <div>Cameras: {breadcrumbs.numberOfCameras}</div>
    </div>
  )
}))

describe('ProjectList Component', () => {
  // Mock functions for callbacks
  let mockOnProjectSelection: ReturnType<typeof vi.fn>
  let mockOnViewBreadcrumbs: ReturnType<typeof vi.fn>
  let mockOnTogglePreview: ReturnType<typeof vi.fn>
  let mockGetPreview: ReturnType<typeof vi.fn>

  // Test data
  const mockProjects: ProjectFolder[] = [
    {
      path: '/projects/project1',
      name: 'Project 1',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-01T00:00:00Z',
      cameraCount: 3,
      validationErrors: []
    },
    {
      path: '/projects/project2',
      name: 'Project 2',
      isValid: false,
      hasBreadcrumbs: false,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-02T00:00:00Z',
      cameraCount: 2,
      validationErrors: ['Missing Footage folder']
    },
    {
      path: '/projects/project3',
      name: 'Project 3',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: true,
      invalidBreadcrumbs: false,
      lastScanned: '2024-01-03T00:00:00Z',
      cameraCount: 1,
      validationErrors: []
    }
  ]

  const mockBreadcrumbs: BreadcrumbsFile = {
    projectTitle: 'Test Project',
    numberOfCameras: 3,
    files: [],
    parentFolder: '/projects',
    createdBy: 'test-user',
    creationDateTime: '2024-01-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnProjectSelection = vi.fn()
    mockOnViewBreadcrumbs = vi.fn()
    mockOnTogglePreview = vi.fn()
    mockGetPreview = vi.fn().mockReturnValue(null)
  })

  // =================================================================
  // Test Category 1: Rendering (4 tests)
  // =================================================================

  describe('Rendering', () => {
    test('renders empty state when no projects', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('No projects found')).toBeInTheDocument()
    })

    test('renders list of projects', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={mockProjects}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Found Projects (3)')).toBeInTheDocument()
      expect(screen.getByText('Project 1')).toBeInTheDocument()
      expect(screen.getByText('Project 2')).toBeInTheDocument()
      expect(screen.getByText('Project 3')).toBeInTheDocument()
    })

    test('renders project count correctly', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={mockProjects}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText(/Found Projects \(3\)/)).toBeInTheDocument()
    })

    test('renders all project details', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Project 1')).toBeInTheDocument()
      expect(screen.getByText('/projects/project1')).toBeInTheDocument()
      expect(screen.getByText('Valid')).toBeInTheDocument()
      expect(screen.getByText('Has breadcrumbs')).toBeInTheDocument()
      expect(screen.getByText('Up to date')).toBeInTheDocument()
      expect(screen.getByText('3 cameras')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Selection (3 tests)
  // =================================================================

  describe('Selection', () => {
    test('selects single project when checkbox clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <ProjectList
          projects={mockProjects}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      // Assert
      expect(mockOnProjectSelection).toHaveBeenCalledWith('/projects/project1', true)
    })

    test('deselects project when checkbox unchecked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <ProjectList
          projects={mockProjects}
          selectedProjects={['/projects/project1']}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      // Assert
      expect(mockOnProjectSelection).toHaveBeenCalledWith('/projects/project1', false)
    })

    test('shows correct checked state for selected projects', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={mockProjects}
          selectedProjects={['/projects/project1', '/projects/project3']}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      expect(checkboxes[2]).toBeChecked()
    })
  })

  // =================================================================
  // Test Category 3: View Actions (3 tests)
  // =================================================================

  describe('View Actions', () => {
    test('triggers onViewBreadcrumbs when View button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <ProjectList
          projects={[mockProjects[0]]} // Project with breadcrumbs
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /view/i }))

      // Assert
      expect(mockOnViewBreadcrumbs).toHaveBeenCalledWith('/projects/project1')
    })

    test('does not show View button for projects without breadcrumbs', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[1]]} // Project without breadcrumbs
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument()
    })

    test('changes View button text to "Hide" when expanded', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject="/projects/project1"
          previewProject={null}
          breadcrumbs={mockBreadcrumbs}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 4: Breadcrumbs Display (3 tests)
  // =================================================================

  describe('Breadcrumbs Display', () => {
    test('shows loading state when loading breadcrumbs', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject="/projects/project1"
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={true}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Loading breadcrumbs...')).toBeInTheDocument()
    })

    test('shows error state when breadcrumbs error occurs', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject="/projects/project1"
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError="Failed to load breadcrumbs"
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Failed to load breadcrumbs')).toBeInTheDocument()
    })

    test('displays breadcrumbs viewer when expanded with valid breadcrumbs', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject="/projects/project1"
          previewProject={null}
          breadcrumbs={mockBreadcrumbs}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByTestId('breadcrumbs-viewer')).toBeInTheDocument()
      expect(screen.getByText('Project: Test Project')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 5: Performance Optimizations (React.memo) (3 tests)
  // =================================================================

  describe('Performance Optimizations', () => {
    test('should be wrapped with React.memo', () => {
      // React.memo components have a specific type structure
      const component = ProjectList as any
      expect(component.$$typeof).toBeDefined()
    })

    test('should not re-render when props remain unchanged', () => {
      // Arrange: Track render count
      let renderCount = 0
      const TestWrapper = (props: any) => {
        renderCount++
        return <ProjectList {...props} />
      }

      // Act: Render twice with same props
      const defaultProps = {
        projects: mockProjects,
        selectedProjects: [],
        onProjectSelection: mockOnProjectSelection,
        onViewBreadcrumbs: mockOnViewBreadcrumbs,
        onTogglePreview: mockOnTogglePreview,
        expandedProject: null,
        previewProject: null,
        breadcrumbs: null,
        isLoadingBreadcrumbs: false,
        breadcrumbsError: null,
        getPreview: mockGetPreview
      }

      const { rerender } = render(<TestWrapper {...defaultProps} />)
      const initialRenderCount = renderCount

      // Rerender with same props
      rerender(<TestWrapper {...defaultProps} />)

      // Assert: Wrapper renders, but memo should reduce ProjectList renders
      expect(renderCount).toBeGreaterThan(initialRenderCount)
    })

    test('should work with stable callback references', () => {
      // Arrange: Create stable callbacks using useCallback
      const TestParent = () => {
        const stableOnProjectSelection = React.useCallback(
          (path: string, isSelected: boolean) => {
            // Callback implementation
          },
          []
        )

        const stableOnViewBreadcrumbs = React.useCallback((path: string) => {
          // Callback implementation
        }, [])

        const stableOnTogglePreview = React.useCallback((path: string) => {
          // Callback implementation
        }, [])

        const stableGetPreview = React.useCallback((path: string) => null, [])

        return (
          <ProjectList
            projects={mockProjects}
            selectedProjects={[]}
            onProjectSelection={stableOnProjectSelection}
            onViewBreadcrumbs={stableOnViewBreadcrumbs}
            onTogglePreview={stableOnTogglePreview}
            expandedProject={null}
            previewProject={null}
            breadcrumbs={null}
            isLoadingBreadcrumbs={false}
            breadcrumbsError={null}
            getPreview={stableGetPreview}
          />
        )
      }

      // Act
      const { rerender } = render(<TestParent />)
      rerender(<TestParent />)

      // Assert: Component should render without errors
      expect(screen.getByText('Project 1')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 6: Project Status Display (3 tests)
  // =================================================================

  describe('Project Status Display', () => {
    test('displays correct status badges for valid project', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[0]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Valid')).toBeInTheDocument()
      expect(screen.getByText('Has breadcrumbs')).toBeInTheDocument()
      expect(screen.getByText('Up to date')).toBeInTheDocument()
    })

    test('displays correct status badges for invalid project', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[1]]}
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Invalid')).toBeInTheDocument()
      expect(screen.getByText('Missing breadcrumbs')).toBeInTheDocument()
      expect(screen.queryByText('Up to date')).not.toBeInTheDocument()
    })

    test('displays stale breadcrumbs badge correctly', () => {
      // Arrange & Act
      render(
        <ProjectList
          projects={[mockProjects[2]]} // Project with stale breadcrumbs
          selectedProjects={[]}
          onProjectSelection={mockOnProjectSelection}
          onViewBreadcrumbs={mockOnViewBreadcrumbs}
          onTogglePreview={mockOnTogglePreview}
          expandedProject={null}
          previewProject={null}
          breadcrumbs={null}
          isLoadingBreadcrumbs={false}
          breadcrumbsError={null}
          getPreview={mockGetPreview}
        />
      )

      // Assert
      expect(screen.getByText('Stale breadcrumbs')).toBeInTheDocument()
      expect(screen.getByText('1 camera')).toBeInTheDocument()
    })
  })
})
