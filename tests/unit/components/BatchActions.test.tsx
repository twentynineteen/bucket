/**
 * Test Suite: BatchActions Component
 *
 * Tests for the Baker workflow batch operations component.
 * Following TDD methodology as per DEBT-009 Phase 2.
 *
 * Test Categories:
 * 1. Rendering (3 tests)
 * 2. Apply Changes (4 tests)
 * 3. Selection Actions (3 tests)
 * 4. Accessibility (2 tests)
 *
 * Total: 12 tests
 */

import { BatchActions } from '@components/Baker/BatchActions'
import { render, screen } from '@testing-library/react'
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

describe('BatchActions Component', () => {
  // Mock functions for callbacks
  let mockOnSelectAll: ReturnType<typeof vi.fn>
  let mockOnClearSelection: ReturnType<typeof vi.fn>
  let mockOnApplyChanges: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSelectAll = vi.fn()
    mockOnClearSelection = vi.fn()
    mockOnApplyChanges = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering (3 tests)
  // =================================================================

  describe('Rendering', () => {
    test('renders with no selected projects', () => {
      // Arrange & Act
      render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      expect(screen.getByText('0 of 5 projects selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
    })

    test('renders with selected projects', () => {
      // Arrange & Act
      render(
        <BatchActions
          selectedProjects={[
            '/path/to/project1',
            '/path/to/project2',
            '/path/to/project3'
          ]}
          totalProjects={10}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      expect(screen.getByText('3 of 10 projects selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /apply changes/i })).not.toBeDisabled()
    })

    test('returns null when totalProjects is 0', () => {
      // Arrange & Act
      const { container } = render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={0}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      expect(container.firstChild).toBeNull()
    })
  })

  // =================================================================
  // Test Category 2: Apply Changes (4 tests)
  // =================================================================

  describe('Apply Changes', () => {
    test('triggers onApplyChanges callback when button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={['/path/to/project1']}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /apply changes/i }))

      // Assert
      expect(mockOnApplyChanges).toHaveBeenCalledTimes(1)
    })

    test('Apply Changes button is disabled when no projects selected', () => {
      // Arrange & Act
      render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      const button = screen.getByRole('button', { name: /apply changes/i })
      expect(button).toBeDisabled()
    })

    test('Apply Changes button is disabled when isUpdating is true', () => {
      // Arrange & Act
      render(
        <BatchActions
          selectedProjects={['/path/to/project1']}
          totalProjects={5}
          isUpdating={true}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      const button = screen.getByRole('button', { name: /updating/i })
      expect(button).toBeDisabled()
    })

    test('shows "Updating..." state with spinner when isUpdating is true', () => {
      // Arrange & Act
      render(
        <BatchActions
          selectedProjects={['/path/to/project1']}
          totalProjects={5}
          isUpdating={true}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Assert
      expect(screen.getByText(/updating/i)).toBeInTheDocument()
      expect(screen.queryByText(/apply changes/i)).not.toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Selection Actions (3 tests)
  // =================================================================

  describe('Selection Actions', () => {
    test('triggers onSelectAll callback when Select All clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Assert
      expect(mockOnSelectAll).toHaveBeenCalledTimes(1)
    })

    test('triggers onClearSelection callback when Clear Selection clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={['/path/to/project1']}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /clear selection/i }))

      // Assert
      expect(mockOnClearSelection).toHaveBeenCalledTimes(1)
    })

    test('selection buttons work independently of apply changes button', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act - Select All button should work even when Apply Changes is disabled
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Assert
      expect(mockOnSelectAll).toHaveBeenCalledTimes(1)
      expect(mockOnApplyChanges).not.toHaveBeenCalled()
    })
  })

  // =================================================================
  // Test Category 4: Accessibility (2 tests)
  // =================================================================

  describe('Accessibility', () => {
    test('all buttons are keyboard accessible', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={['/path/to/project1']}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act - Tab through buttons and press Enter
      await user.tab()
      await user.keyboard('{Enter}')
      await user.tab()
      await user.keyboard('{Enter}')
      await user.tab()
      await user.keyboard('{Enter}')

      // Assert - All callbacks should have been triggered
      expect(mockOnSelectAll).toHaveBeenCalled()
      expect(mockOnClearSelection).toHaveBeenCalled()
      expect(mockOnApplyChanges).toHaveBeenCalled()
    })

    test('disabled button is not keyboard accessible', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <BatchActions
          selectedProjects={[]}
          totalProjects={5}
          isUpdating={false}
          onSelectAll={mockOnSelectAll}
          onClearSelection={mockOnClearSelection}
          onApplyChanges={mockOnApplyChanges}
        />
      )

      // Act - Tab through all interactive elements
      await user.tab() // Select All
      await user.tab() // Clear Selection
      await user.tab() // Apply Changes (disabled)
      await user.keyboard('{Enter}')

      // Assert - Apply Changes should not be called (it's disabled)
      expect(mockOnSelectAll).not.toHaveBeenCalled()
      expect(mockOnClearSelection).not.toHaveBeenCalled()
      expect(mockOnApplyChanges).not.toHaveBeenCalled()
    })
  })
})
