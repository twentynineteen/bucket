/**
 * Test Suite: TrelloCardUpdateDialog Component
 *
 * Tests for the Baker workflow Trello card update dialog.
 * Following TDD methodology as per DEBT-009 Phase 3.
 *
 * Test Categories:
 * 1. Rendering States (3 tests)
 * 2. Card Selection (4 tests)
 * 3. Update Operation (4 tests)
 * 4. Dialog Lifecycle (2 tests)
 * 5. Error Handling (2 tests)
 *
 * Total: 15 tests
 */

import type { TrelloCard } from '@/types/baker'
import { TrelloCardUpdateDialog } from '@components/Baker/TrelloCardUpdateDialog'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('TrelloCardUpdateDialog Component', () => {
  // Mock functions for callbacks
  let mockOnOpenChange: ReturnType<typeof vi.fn>
  let mockOnUpdate: ReturnType<typeof vi.fn>
  let mockOnAddTrelloCard: ReturnType<typeof vi.fn>

  // Mock data
  const mockTrelloCards: TrelloCard[] = [
    {
      url: 'https://trello.com/c/card1',
      title: 'Project Alpha - Video Edit',
      boardName: 'Production Board',
      cachedTitle: 'Project Alpha - Video Edit',
      lastFetched: '2024-01-01T00:00:00Z'
    },
    {
      url: 'https://trello.com/c/card2',
      title: 'Project Beta - Final Cut',
      boardName: 'Post-Production',
      cachedTitle: 'Project Beta - Final Cut',
      lastFetched: '2024-01-02T00:00:00Z'
    },
    {
      url: 'https://trello.com/c/card3',
      title: 'Project Gamma - Review',
      boardName: null,
      cachedTitle: 'Project Gamma - Review',
      lastFetched: '2024-01-03T00:00:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnOpenChange = vi.fn()
    mockOnUpdate = vi.fn().mockResolvedValue(undefined)
    mockOnAddTrelloCard = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering States (3 tests)
  // =================================================================

  describe('Rendering States', () => {
    test('does not render when open is false', () => {
      // Arrange & Act
      const { container } = render(
        <TrelloCardUpdateDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('renders empty state when no Trello cards', () => {
      // Arrange & Act
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={[]}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert
      expect(screen.getByText('Update Trello Cards')).toBeInTheDocument()
      expect(
        screen.getByText(/No Trello cards are linked to this project yet/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add trello card/i })).toBeInTheDocument()
    })

    test('renders card selection when cards exist', () => {
      // Arrange & Act
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert
      expect(screen.getByText('Update Trello Cards')).toBeInTheDocument()
      expect(
        screen.getByText(/Select which Trello card\(s\) to update/i)
      ).toBeInTheDocument()
      expect(screen.getByText('Project Alpha - Video Edit')).toBeInTheDocument()
      expect(screen.getByText('Project Beta - Final Cut')).toBeInTheDocument()
      expect(screen.getByText('Project Gamma - Review')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Card Selection (4 tests)
  // =================================================================

  describe('Card Selection', () => {
    test('allows selecting a single card', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      // Assert
      expect(checkboxes[0]).toBeChecked()
      expect(screen.getByRole('button', { name: /update 1 card/i })).toBeInTheDocument()
    })

    test('allows selecting multiple cards', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      // Assert
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      expect(screen.getByRole('button', { name: /update 2 cards/i })).toBeInTheDocument()
    })

    test('allows deselecting cards', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act - Select then deselect
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[0])

      // Assert
      expect(checkboxes[0]).not.toBeChecked()
      expect(screen.getByRole('button', { name: /update 0 cards/i })).toBeDisabled()
    })

    test('displays board names when available', () => {
      // Arrange & Act
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert
      expect(screen.getByText('Production Board')).toBeInTheDocument()
      expect(screen.getByText('Post-Production')).toBeInTheDocument()
      // Card 3 has no board name, so shouldn't render it
    })
  })

  // =================================================================
  // Test Category 3: Update Operation (4 tests)
  // =================================================================

  describe('Update Operation', () => {
    test('calls onUpdate with selected card indexes', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[2])
      await user.click(screen.getByRole('button', { name: /update 2 cards/i }))

      // Assert
      expect(mockOnUpdate).toHaveBeenCalledWith([0, 2])
    })

    test('closes dialog after successful update', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(screen.getByRole('button', { name: /update 1 card/i }))

      // Assert
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    test('shows loading state during update', async () => {
      // Arrange
      const user = userEvent.setup()
      let resolveUpdate: () => void
      mockOnUpdate.mockReturnValue(
        new Promise(resolve => {
          resolveUpdate = resolve
        })
      )

      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(screen.getByRole('button', { name: /update 1 card/i }))

      // Assert - Should show updating state
      await waitFor(() => {
        expect(screen.getByText(/updating/i)).toBeInTheDocument()
      })

      // Cleanup
      resolveUpdate!()
    })

    test('disables update button when no cards selected', () => {
      // Arrange & Act
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert
      const updateButton = screen.getByRole('button', { name: /update 0 cards/i })
      expect(updateButton).toBeDisabled()
    })
  })

  // =================================================================
  // Test Category 4: Dialog Lifecycle (2 tests)
  // =================================================================

  describe('Dialog Lifecycle', () => {
    test('resets selection when dialog closes', async () => {
      // Arrange
      const user = userEvent.setup()
      const { rerender } = render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act - Select a card then close dialog
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)

      // Reopen dialog
      rerender(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert - Selection should be reset
      const newCheckboxes = screen.getAllByRole('checkbox')
      expect(newCheckboxes[0]).not.toBeChecked()
    })

    test('calls onAddTrelloCard and closes when Add Trello Card clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={[]}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /add trello card/i }))

      // Assert
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      expect(mockOnAddTrelloCard).toHaveBeenCalledTimes(1)
    })
  })

  // =================================================================
  // Test Category 5: Error Handling (2 tests)
  // =================================================================

  describe('Error Handling', () => {
    test('displays error message when update fails', async () => {
      // Arrange
      const user = userEvent.setup()
      const errorMessage = 'Failed to update Trello cards'
      mockOnUpdate.mockRejectedValue(new Error(errorMessage))

      render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(screen.getByRole('button', { name: /update 1 card/i }))

      // Assert
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    test('clears error when dialog reopens', async () => {
      // Arrange
      const user = userEvent.setup()
      mockOnUpdate.mockRejectedValue(new Error('Update failed'))

      const { rerender } = render(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Act - Trigger error
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(screen.getByRole('button', { name: /update 1 card/i }))

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument()
      })

      // Close dialog
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Reopen dialog
      rerender(
        <TrelloCardUpdateDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          trelloCards={mockTrelloCards}
          onUpdate={mockOnUpdate}
          onAddTrelloCard={mockOnAddTrelloCard}
        />
      )

      // Assert - Error should be cleared
      expect(screen.queryByText('Update failed')).not.toBeInTheDocument()
    })
  })
})
