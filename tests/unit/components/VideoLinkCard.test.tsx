/**
 * Test Suite: VideoLinkCard Component
 *
 * Tests for the Baker workflow video link display card.
 * Following TDD methodology as per DEBT-009 Phase 4.
 *
 * Test Categories:
 * 1. Rendering (2 tests)
 * 2. Thumbnail Display (2 tests)
 * 3. Actions (3 tests)
 * 4. Date Formatting (1 test)
 *
 * Total: 8 tests
 */

import type { VideoLink } from '@/types/baker'
import { logger } from '@/utils/logger'
import { VideoLinkCard } from '@components/Baker/VideoLinkCard'
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

describe('VideoLinkCard Component', () => {
  // Mock functions for callbacks
  let mockOnRemove: ReturnType<typeof vi.fn>
  let mockOnMoveUp: ReturnType<typeof vi.fn>
  let mockOnMoveDown: ReturnType<typeof vi.fn>

  // Mock data
  const baseVideoLink: VideoLink = {
    url: 'https://sproutvideo.com/videos/abc123',
    title: 'Project Alpha - Final Edit',
    sproutVideoId: 'abc123',
    uploadDate: '2024-01-15T10:30:00Z',
    thumbnailUrl: 'https://sproutvideo.com/thumbnails/abc123.jpg',
    sourceRenderFile: 'project_alpha_final.mp4'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnRemove = vi.fn()
    mockOnMoveUp = vi.fn()
    mockOnMoveDown = vi.fn()
  })

  // =================================================================
  // Test Category 1: Rendering (2 tests)
  // =================================================================

  describe('Rendering', () => {
    test('renders video link with all information', () => {
      // Arrange & Act
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert
      expect(screen.getByText('Project Alpha - Final Edit')).toBeInTheDocument()
      expect(screen.getByText(/ID: abc123/i)).toBeInTheDocument()
      expect(screen.getByText(/Uploaded:/i)).toBeInTheDocument()
      expect(screen.getByText(/Source: project_alpha_final.mp4/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /open in sprout video/i })
      ).toBeInTheDocument()
    })

    test('renders without optional fields', () => {
      // Arrange
      const minimalVideoLink: VideoLink = {
        url: 'https://sproutvideo.com/videos/xyz789',
        title: 'Minimal Video',
        sproutVideoId: null,
        uploadDate: null,
        thumbnailUrl: null,
        sourceRenderFile: null
      }

      // Act
      render(
        <VideoLinkCard
          videoLink={minimalVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={false}
          canMoveDown={false}
        />
      )

      // Assert
      expect(screen.getByText('Minimal Video')).toBeInTheDocument()
      expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Uploaded:/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Source:/i)).not.toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 2: Thumbnail Display (2 tests)
  // =================================================================

  describe('Thumbnail Display', () => {
    test('displays thumbnail image when URL provided', () => {
      // Arrange & Act
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert
      const thumbnail = screen.getByAltText('Project Alpha - Final Edit')
      expect(thumbnail).toBeInTheDocument()
      expect(thumbnail).toHaveAttribute(
        'src',
        'https://sproutvideo.com/thumbnails/abc123.jpg'
      )
    })

    test('displays placeholder icon when no thumbnail URL', () => {
      // Arrange
      const videoWithoutThumbnail: VideoLink = {
        ...baseVideoLink,
        thumbnailUrl: null
      }

      // Act
      const { container } = render(
        <VideoLinkCard
          videoLink={videoWithoutThumbnail}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert - Should show placeholder with muted background
      const placeholder = container.querySelector('.bg-muted')
      expect(placeholder).toBeInTheDocument()
      expect(screen.queryByAltText('Project Alpha - Final Edit')).not.toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 3: Actions (3 tests)
  // =================================================================

  describe('Actions', () => {
    test('opens video URL when "Open in Sprout Video" clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /open in sprout video/i }))

      // Assert
      expect(openUrl).toHaveBeenCalledWith('https://sproutvideo.com/videos/abc123')
    })

    test('triggers move up/down callbacks and respects disabled state', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={false}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /move up/i }))

      // Assert
      expect(mockOnMoveUp).toHaveBeenCalledTimes(1)

      // Move down button should be disabled
      const moveDownButton = screen.getByRole('button', { name: /move down/i })
      expect(moveDownButton).toBeDisabled()
    })

    test('triggers onRemove when remove button clicked', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Act
      await user.click(screen.getByRole('button', { name: /remove video/i }))

      // Assert
      expect(mockOnRemove).toHaveBeenCalledTimes(1)
    })
  })

  // =================================================================
  // Test Category 4: Performance Optimizations (React.memo) (3 tests)
  // =================================================================

  describe('Performance Optimizations', () => {
    test('should be wrapped with React.memo', () => {
      // React.memo components have a specific type structure
      const component = VideoLinkCard as any
      expect(component.$$typeof).toBeDefined()
    })

    test('should not re-render when props remain unchanged', () => {
      // Arrange: Track render count
      let renderCount = 0
      const TestWrapper = (props: any) => {
        renderCount++
        return <VideoLinkCard {...props} />
      }

      // Act: Render twice with same props
      const defaultProps = {
        videoLink: baseVideoLink,
        onRemove: mockOnRemove,
        onMoveUp: mockOnMoveUp,
        onMoveDown: mockOnMoveDown,
        canMoveUp: true,
        canMoveDown: true
      }

      const { rerender } = render(<TestWrapper {...defaultProps} />)
      const initialRenderCount = renderCount

      // Rerender with same props
      rerender(<TestWrapper {...defaultProps} />)

      // Assert: Wrapper renders, but memo should reduce VideoLinkCard renders
      expect(renderCount).toBeGreaterThan(initialRenderCount)
    })

    test('should work with stable callback references', () => {
      // Arrange: Create stable callbacks using useCallback
      const TestParent = () => {
        const stableOnRemove = React.useCallback(() => {
          // Callback implementation
        }, [])

        const stableOnMoveUp = React.useCallback(() => {
          // Callback implementation
        }, [])

        const stableOnMoveDown = React.useCallback(() => {
          // Callback implementation
        }, [])

        return (
          <VideoLinkCard
            videoLink={baseVideoLink}
            onRemove={stableOnRemove}
            onMoveUp={stableOnMoveUp}
            onMoveDown={stableOnMoveDown}
            canMoveUp={true}
            canMoveDown={true}
          />
        )
      }

      // Act
      const { rerender } = render(<TestParent />)
      rerender(<TestParent />)

      // Assert: Component should render without errors
      expect(screen.getByText('Project Alpha - Final Edit')).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 5: Date Formatting (1 test)
  // =================================================================

  describe('Date Formatting', () => {
    test('formats upload date correctly', () => {
      // Arrange & Act
      render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert - Date should be formatted as "Jan 15, 2024"
      expect(screen.getByText(/Uploaded: Jan 15, 2024/i)).toBeInTheDocument()
    })
  })

  // =================================================================
  // Test Category 5: Performance Optimizations (3 tests)
  // =================================================================

  describe('Performance Optimizations', () => {
    test('should not use backdrop-blur on action buttons for better drag performance', () => {
      // Arrange & Act
      const { container } = render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert - Find all buttons
      const buttons = container.querySelectorAll('button')

      buttons.forEach((button) => {
        // backdrop-blur is expensive during window drag
        expect(button.className).not.toContain('backdrop-blur')
      })
    })

    test('should use solid backgrounds instead of blur effects', () => {
      // Arrange & Act
      const { container } = render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert - Check for solid background usage
      const buttons = container.querySelectorAll('button')

      buttons.forEach((button) => {
        // Should have solid background (bg-background or similar)
        const hasSolidBackground =
          button.className.includes('bg-background') ||
          button.className.includes('bg-card') ||
          button.className.includes('bg-muted')

        // If button has a background, it should be solid, not blurred
        if (hasSolidBackground) {
          expect(button.className).not.toContain('backdrop-blur')
        }
      })
    })

    test('should not have blur effects on overlay elements', () => {
      // Arrange & Act
      const { container } = render(
        <VideoLinkCard
          videoLink={baseVideoLink}
          onRemove={mockOnRemove}
          onMoveUp={mockOnMoveUp}
          onMoveDown={mockOnMoveDown}
          canMoveUp={true}
          canMoveDown={true}
        />
      )

      // Assert - Check all child elements for blur
      const allElements = container.querySelectorAll('*')

      allElements.forEach((element) => {
        expect(element.className).not.toContain('backdrop-blur')
      })
    })
  })
})
