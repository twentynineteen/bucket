/**
 * Test Suite: UpdateDialog Component
 *
 * Tests for the app update dialog with scrollable release notes.
 * Following TDD methodology.
 *
 * Test Categories:
 * 1. Rendering States (4 tests)
 * 2. Version Display (3 tests)
 * 3. Release Notes (4 tests)
 * 4. User Actions (4 tests)
 * 5. Accessibility (2 tests)
 *
 * Total: 17 tests
 */

import { UpdateDialog } from '@components/UpdateDialog'
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

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  )
}))

describe('UpdateDialog Component', () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>
  let mockOnCancel: ReturnType<typeof vi.fn>

  const defaultProps = {
    open: true,
    currentVersion: '0.10.0',
    latestVersion: '0.11.0',
    releaseNotes: "## What's New\n\n- Feature 1\n- Feature 2\n- Bug fix",
    onUpdate: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdate = vi.fn()
    mockOnCancel = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering States (4 tests)
  // =================================================================

  describe('Rendering States', () => {
    test('does not render when open is false', () => {
      render(
        <UpdateDialog
          {...defaultProps}
          open={false}
          onUpdate={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('renders dialog when open is true', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    test('renders Update and Cancel buttons', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    test('renders release notes section', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByText(/release notes/i)).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Version Display (3 tests)
  // =================================================================

  describe('Version Display', () => {
    test('displays current version', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByText(/0\.10\.0/)).toBeInTheDocument()
    })

    test('displays latest version', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByText(/0\.11\.0/)).toBeInTheDocument()
    })

    test('displays version transition (current → latest)', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      // Should show something like "0.10.0 → 0.11.0" or similar
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/0\.10\.0/)).toBeInTheDocument()
      expect(within(dialog).getByText(/0\.11\.0/)).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Release Notes (4 tests)
  // =================================================================

  describe('Release Notes', () => {
    test('renders release notes content', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    })

    test('release notes container has scrollable styles', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      const notesContainer = screen.getByTestId('release-notes-container')
      expect(notesContainer).toHaveClass('overflow-y-auto')
    })

    test('release notes container has max height constraint', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      const notesContainer = screen.getByTestId('release-notes-container')
      // Should have max-h class for constraining height
      expect(notesContainer.className).toMatch(/max-h-/)
    })

    test('handles empty release notes gracefully', () => {
      render(
        <UpdateDialog
          {...defaultProps}
          releaseNotes=""
          onUpdate={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      )

      // Should still render dialog without crashing
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 4: User Actions (4 tests)
  // =================================================================

  describe('User Actions', () => {
    test('calls onUpdate when Update button clicked', async () => {
      const user = userEvent.setup()
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      await user.click(screen.getByRole('button', { name: /update/i }))

      expect(mockOnUpdate).toHaveBeenCalledTimes(1)
    })

    test('calls onCancel when Cancel button clicked', async () => {
      const user = userEvent.setup()
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    test('calls onCancel when dialog close button clicked', async () => {
      const user = userEvent.setup()
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      // Find the X close button (sr-only text "Close")
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    test('calls onCancel when Escape key pressed', async () => {
      const user = userEvent.setup()
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      await user.keyboard('{Escape}')

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  // =================================================================
  // Test Category 5: Accessibility (2 tests)
  // =================================================================

  describe('Accessibility', () => {
    test('dialog has proper title for screen readers', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      expect(
        screen.getByRole('dialog', { name: /update available/i })
      ).toBeInTheDocument()
    })

    test('dialog has descriptive content for screen readers', () => {
      render(
        <UpdateDialog {...defaultProps} onUpdate={mockOnUpdate} onCancel={mockOnCancel} />
      )

      // Should have a description explaining the update
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-describedby')
    })
  })
})
