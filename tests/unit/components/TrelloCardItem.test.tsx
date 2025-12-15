/**
 * Test Suite: TrelloCardItem Component
 *
 * Tests for the Baker workflow Trello card display item.
 * Following TDD methodology as per DEBT-009 Phase 4.
 *
 * Test Categories:
 * 1. Rendering (2 tests)
 * 2. Relative Time Display (3 tests)
 * 3. Actions (2 tests)
 * 4. Stale State (1 test)
 *
 * Total: 8 tests
 */

import type { TrelloCard } from '@/types/baker'
import { logger } from '@/utils/logger'
import { TrelloCardItem } from '@components/Baker/TrelloCardItem'
import { openUrl } from '@tauri-apps/plugin-opener'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock Tauri opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn()
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

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

describe('TrelloCardItem Component', () => {
  // Mock functions for callbacks
  let mockOnRemove: ReturnType<typeof vi.fn>
  let mockOnRefresh: ReturnType<typeof vi.fn>

  // Mock data
  const baseTrelloCard: TrelloCard = {
    url: 'https://trello.com/c/abc123',
    cardId: 'abc123',
    title: 'Test Project - Video Edit',
    boardName: 'Production Board',
    cachedTitle: 'Test Project - Video Edit',
    lastFetched: new Date().toISOString() // Current time
  }

  // Helper to render TrelloCardItem in a proper table structure
  const renderInTable = (component: React.ReactElement) => {
    return render(
      <table>
        <tbody>{component}</tbody>
      </table>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnRemove = vi.fn()
    mockOnRefresh = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering (2 tests)
  // =================================================================

  describe('Rendering', () => {
    test('renders card with all information', () => {
      // Arrange & Act
      renderInTable(
        <TrelloCardItem
          trelloCard={baseTrelloCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('Test Project - Video Edit')).toBeInTheDocument()
      expect(screen.getByText(/ID: abc123/i)).toBeInTheDocument()
      expect(screen.getByText('Production Board')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument()
      expect(screen.getByTitle(/remove card/i)).toBeInTheDocument()
    })

    test('renders without board name when not provided', () => {
      // Arrange
      const cardWithoutBoard: TrelloCard = {
        ...baseTrelloCard,
        boardName: null
      }

      // Act
      renderInTable(
        <TrelloCardItem
          trelloCard={cardWithoutBoard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('Test Project - Video Edit')).toBeInTheDocument()
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Relative Time Display (3 tests)
  // =================================================================

  describe('Relative Time Display', () => {
    test('displays "today" for current date', () => {
      // Arrange
      const todayCard: TrelloCard = {
        ...baseTrelloCard,
        lastFetched: new Date().toISOString()
      }

      // Act
      renderInTable(
        <TrelloCardItem
          trelloCard={todayCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('today')).toBeInTheDocument()
    })

    test('displays "X days ago" for recent dates', () => {
      // Arrange
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const recentCard: TrelloCard = {
        ...baseTrelloCard,
        lastFetched: threeDaysAgo.toISOString()
      }

      // Act
      renderInTable(
        <TrelloCardItem
          trelloCard={recentCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('3 days ago')).toBeInTheDocument()
    })

    test('does not display last updated when lastFetched is null', () => {
      // Arrange
      const cardWithoutDate: TrelloCard = {
        ...baseTrelloCard,
        lastFetched: undefined
      }

      // Act
      renderInTable(
        <TrelloCardItem
          trelloCard={cardWithoutDate}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('Never')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Actions (2 tests)
  // =================================================================

  describe('Actions', () => {
    test('opens Trello URL when "Open" button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      renderInTable(
        <TrelloCardItem
          trelloCard={baseTrelloCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /open/i }))

      // Assert
      expect(openUrl).toHaveBeenCalledWith('https://trello.com/c/abc123')
    })

    test('triggers onRemove when remove button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      renderInTable(
        <TrelloCardItem
          trelloCard={baseTrelloCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Act
      await user.click(screen.getByTitle(/remove card/i))

      // Assert
      expect(mockOnRemove).toHaveBeenCalledTimes(1)
    })
  })

  // =================================================================
  // Test Category 4: Stale State (1 test)
  // =================================================================

  describe('Stale State', () => {
    test('displays stale indicator for cards older than 7 days', () => {
      // Arrange
      const eightDaysAgo = new Date()
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

      const staleCard: TrelloCard = {
        ...baseTrelloCard,
        lastFetched: eightDaysAgo.toISOString()
      }

      // Act
      const { container } = renderInTable(
        <TrelloCardItem
          trelloCard={staleCard}
          onRemove={mockOnRemove}
          onRefresh={mockOnRefresh}
        />
      )

      // Assert
      expect(screen.getByText('Stale')).toBeInTheDocument()
      // Check for warning color class indicating stale state
      const staleText = container.querySelector('.text-warning')
      expect(staleText).toBeInTheDocument()
    })
  })
})
