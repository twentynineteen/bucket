/**
 * Test Suite: BatchActions Component
 *
 * Tests for the Baker floating batch action bar. The bar renders only while
 * at least one project is selected, so the disabled-button states of the old
 * static panel are replaced by visibility assertions.
 *
 * Test Categories:
 * 1. Visibility (3 tests)
 * 2. Rendering (2 tests)
 * 3. Actions (4 tests)
 * 4. Accessibility (1 test)
 *
 * Total: 10 tests
 */

import { BatchActions } from '../../../src/features/Baker/components/BatchActions'
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

  const renderBar = (selectedProjects: string[], totalProjects = 5, isUpdating = false) =>
    render(
      <BatchActions
        selectedProjects={selectedProjects}
        totalProjects={totalProjects}
        isUpdating={isUpdating}
        onSelectAll={mockOnSelectAll}
        onClearSelection={mockOnClearSelection}
        onApplyChanges={mockOnApplyChanges}
      />
    )

  // =================================================================
  // Test Category 1: Visibility (3 tests)
  // =================================================================

  describe('Visibility', () => {
    test('returns null when no projects are selected', () => {
      // Arrange & Act
      const { container } = renderBar([])

      // Assert - The floating bar only appears while a selection exists
      expect(container.firstChild).toBeNull()
    })

    test('returns null when totalProjects is 0', () => {
      // Arrange & Act
      const { container } = renderBar([], 0)

      // Assert
      expect(container.firstChild).toBeNull()
    })

    test('appears when at least one project is selected', () => {
      // Arrange & Act
      renderBar(['/path/to/project1'])

      // Assert
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Rendering (2 tests)
  // =================================================================

  describe('Rendering', () => {
    test('shows selection count and all actions', () => {
      // Arrange & Act
      renderBar(['/path/to/project1', '/path/to/project2', '/path/to/project3'], 10)

      // Assert
      expect(screen.getByText(/of 10 selected/)).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /apply changes/i })).not.toBeDisabled()
    })

    test('shows "Updating..." state with spinner when isUpdating is true', () => {
      // Arrange & Act
      renderBar(['/path/to/project1'], 5, true)

      // Assert
      const button = screen.getByRole('button', { name: /updating/i })
      expect(button).toBeDisabled()
      expect(screen.queryByText(/apply changes/i)).not.toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Actions (4 tests)
  // =================================================================

  describe('Actions', () => {
    test('triggers onApplyChanges callback when button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      renderBar(['/path/to/project1'])

      // Act
      await user.click(screen.getByRole('button', { name: /apply changes/i }))

      // Assert
      expect(mockOnApplyChanges).toHaveBeenCalledTimes(1)
    })

    test('triggers onSelectAll callback when Select All clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      renderBar(['/path/to/project1'])

      // Act
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Assert
      expect(mockOnSelectAll).toHaveBeenCalledTimes(1)
    })

    test('triggers onClearSelection callback when Clear clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      renderBar(['/path/to/project1'])

      // Act
      await user.click(screen.getByRole('button', { name: /^clear$/i }))

      // Assert
      expect(mockOnClearSelection).toHaveBeenCalledTimes(1)
    })

    test('selection buttons work independently of apply changes button', async () => {
      // Arrange
      const user = userEvent.setup()
      renderBar(['/path/to/project1'])

      // Act
      await user.click(screen.getByRole('button', { name: /select all/i }))

      // Assert
      expect(mockOnSelectAll).toHaveBeenCalledTimes(1)
      expect(mockOnApplyChanges).not.toHaveBeenCalled()
    })
  })

  // =================================================================
  // Test Category 4: Accessibility (1 test)
  // =================================================================

  describe('Accessibility', () => {
    test('all buttons are keyboard accessible', async () => {
      // Arrange
      const user = userEvent.setup()
      renderBar(['/path/to/project1'])

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
  })
})
