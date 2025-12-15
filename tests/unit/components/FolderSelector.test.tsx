/**
 * Test Suite: FolderSelector Component
 *
 * Tests for the Baker workflow folder selection component.
 * Following TDD methodology as per DEBT-009 Phase 3.
 *
 * Test Categories:
 * 1. Rendering (2 tests)
 * 2. Folder Selection (3 tests)
 * 3. Scan Controls (3 tests)
 * 4. Button States (2 tests)
 *
 * Total: 10 tests
 */

import { logger } from '@/utils/logger'
import { FolderSelector } from '@components/Baker/FolderSelector'
import { open } from '@tauri-apps/plugin-dialog'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
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

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('FolderSelector Component', () => {
  // Mock functions for callbacks
  let mockOnFolderChange: ReturnType<typeof vi.fn>
  let mockOnStartScan: ReturnType<typeof vi.fn>
  let mockOnCancelScan: ReturnType<typeof vi.fn>
  let mockOnClearResults: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnFolderChange = vi.fn()
    mockOnStartScan = vi.fn()
    mockOnCancelScan = vi.fn()
    mockOnClearResults = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering (2 tests)
  // =================================================================

  describe('Rendering', () => {
    test('renders with no folder selected', () => {
      // Arrange & Act
      render(
        <FolderSelector
          selectedFolder=""
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Assert
      expect(screen.getByText('Select Folder to Scan')).toBeInTheDocument()
      expect(
        screen.getByText(
          /Choose a root directory to scan for BuildProject-compatible folders/i
        )
      ).toBeInTheDocument()
      expect(screen.getByPlaceholderText('No folder selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start scan/i })).toBeInTheDocument()
    })

    test('renders with selected folder', () => {
      // Arrange
      const selectedFolder = '/Users/test/Projects'

      // Act
      render(
        <FolderSelector
          selectedFolder={selectedFolder}
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Assert
      const input = screen.getByDisplayValue(selectedFolder)
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('readonly')
    })
  })

  // =================================================================
  // Test Category 2: Folder Selection (3 tests)
  // =================================================================

  describe('Folder Selection', () => {
    test('opens folder dialog when Browse button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      ;(open as any).mockResolvedValue('/Users/test/SelectedFolder')

      render(
        <FolderSelector
          selectedFolder=""
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /browse/i }))

      // Assert
      expect(open).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: 'Select folder to scan for projects'
      })
    })

    test('calls onFolderChange when folder selected', async () => {
      // Arrange
      const user = userEvent.setup()
      const selectedPath = '/Users/test/SelectedFolder'
      ;(open as any).mockResolvedValue(selectedPath)

      render(
        <FolderSelector
          selectedFolder=""
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /browse/i }))

      // Assert
      expect(mockOnFolderChange).toHaveBeenCalledWith(selectedPath)
    })

    test('handles folder dialog cancellation gracefully', async () => {
      // Arrange
      const user = userEvent.setup()
      ;(open as any).mockResolvedValue(null) // User cancelled

      render(
        <FolderSelector
          selectedFolder=""
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /browse/i }))

      // Assert
      expect(mockOnFolderChange).not.toHaveBeenCalled()
    })
  })

  // =================================================================
  // Test Category 3: Scan Controls (3 tests)
  // =================================================================

  describe('Scan Controls', () => {
    test('triggers onStartScan when Start Scan button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <FolderSelector
          selectedFolder="/Users/test/Projects"
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /start scan/i }))

      // Assert
      expect(mockOnStartScan).toHaveBeenCalledTimes(1)
    })

    test('shows Cancel button and triggers onCancelScan when scanning', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <FolderSelector
          selectedFolder="/Users/test/Projects"
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={true}
          hasResults={false}
        />
      )

      // Assert - Cancel button should be visible
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeInTheDocument()

      // Act
      await user.click(cancelButton)

      // Assert
      expect(mockOnCancelScan).toHaveBeenCalledTimes(1)
    })

    test('shows Clear Results button and triggers onClearResults when hasResults', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <FolderSelector
          selectedFolder="/Users/test/Projects"
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={true}
        />
      )

      // Assert - Clear Results button should be visible
      const clearButton = screen.getByRole('button', { name: /clear results/i })
      expect(clearButton).toBeInTheDocument()

      // Act
      await user.click(clearButton)

      // Assert
      expect(mockOnClearResults).toHaveBeenCalledTimes(1)
    })
  })

  // =================================================================
  // Test Category 4: Button States (2 tests)
  // =================================================================

  describe('Button States', () => {
    test('Start Scan button disabled when no folder selected', () => {
      // Arrange & Act
      render(
        <FolderSelector
          selectedFolder=""
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={false}
          hasResults={false}
        />
      )

      // Assert
      const startButton = screen.getByRole('button', { name: /start scan/i })
      expect(startButton).toBeDisabled()
    })

    test('Browse button disabled when scanning', () => {
      // Arrange & Act
      render(
        <FolderSelector
          selectedFolder="/Users/test/Projects"
          onFolderChange={mockOnFolderChange}
          onStartScan={mockOnStartScan}
          onCancelScan={mockOnCancelScan}
          onClearResults={mockOnClearResults}
          isScanning={true}
          hasResults={false}
        />
      )

      // Assert
      const browseButton = screen.getByRole('button', { name: /browse/i })
      expect(browseButton).toBeDisabled()
    })
  })
})
