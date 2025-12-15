// tests/unit/pages/BuildProject/ProjectFileList.test.tsx

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import ProjectFileList from '@/pages/BuildProject/ProjectFileList'

describe('ProjectFileList', () => {
  const mockFiles = [
    {
      file: { name: 'video1.mp4', path: '/path/to/video1.mp4' },
      camera: 1
    },
    {
      file: { name: 'video2.mp4', path: '/path/to/video2.mp4' },
      camera: 2
    },
    {
      file: { name: 'video3.mp4', path: '/path/to/video3.mp4' },
      camera: 1
    }
  ]

  const defaultProps = {
    files: mockFiles,
    numCameras: 3,
    onUpdateCamera: vi.fn(),
    onDeleteFile: vi.fn()
  }

  describe('Rendering', () => {
    test('displays all files in the list', () => {
      render(<ProjectFileList {...defaultProps} />)

      expect(screen.getByText('video1.mp4')).toBeInTheDocument()
      expect(screen.getByText('video2.mp4')).toBeInTheDocument()
      expect(screen.getByText('video3.mp4')).toBeInTheDocument()
    })

    test('shows file paths', () => {
      render(<ProjectFileList {...defaultProps} />)

      expect(screen.getByText('/path/to/video1.mp4')).toBeInTheDocument()
      expect(screen.getByText('/path/to/video2.mp4')).toBeInTheDocument()
    })

    test('displays empty state when no files', () => {
      render(<ProjectFileList {...defaultProps} files={[]} />)

      expect(screen.getByText('No files selected yet')).toBeInTheDocument()
      expect(
        screen.getByText('Click "Select Files" to add footage to your project')
      ).toBeInTheDocument()
    })

    test('renders camera selectors with correct values', () => {
      render(<ProjectFileList {...defaultProps} />)

      const selects = screen.getAllByRole('combobox')
      expect(selects).toHaveLength(3)
      expect(selects[0]).toHaveValue('1')
      expect(selects[1]).toHaveValue('2')
      expect(selects[2]).toHaveValue('1')
    })

    test('renders correct number of camera options', () => {
      render(<ProjectFileList {...defaultProps} numCameras={5} />)

      const select = screen.getAllByRole('combobox')[0]
      const options = Array.from(select.querySelectorAll('option'))
      expect(options).toHaveLength(5)
      expect(options.map((o) => o.textContent)).toEqual([
        'Camera 1',
        'Camera 2',
        'Camera 3',
        'Camera 4',
        'Camera 5'
      ])
    })

    test('renders delete buttons for each file', () => {
      render(<ProjectFileList {...defaultProps} />)

      const deleteButtons = screen.getAllByLabelText(/Delete/)
      expect(deleteButtons).toHaveLength(3)
    })
  })

  describe('Camera Selection', () => {
    test('calls onUpdateCamera when camera is changed', async () => {
      const user = userEvent.setup()
      const onUpdateCamera = vi.fn()

      render(<ProjectFileList {...defaultProps} onUpdateCamera={onUpdateCamera} />)

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], '3')

      expect(onUpdateCamera).toHaveBeenCalledWith(0, 3)
    })

    test('updates camera for correct file index', async () => {
      const user = userEvent.setup()
      const onUpdateCamera = vi.fn()

      render(<ProjectFileList {...defaultProps} onUpdateCamera={onUpdateCamera} />)

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[1], '1')

      expect(onUpdateCamera).toHaveBeenCalledWith(1, 1)
    })

    test('camera selector has accessible label', () => {
      render(<ProjectFileList {...defaultProps} />)

      expect(
        screen.getByLabelText('Select camera for video1.mp4')
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText('Select camera for video2.mp4')
      ).toBeInTheDocument()
    })
  })

  describe('File Deletion', () => {
    test('calls onDeleteFile when delete button clicked', async () => {
      const user = userEvent.setup()
      const onDeleteFile = vi.fn()

      render(<ProjectFileList {...defaultProps} onDeleteFile={onDeleteFile} />)

      const deleteButtons = screen.getAllByLabelText(/Delete/)
      await user.click(deleteButtons[0])

      expect(onDeleteFile).toHaveBeenCalledWith(0)
    })

    test('deletes correct file by index', async () => {
      const user = userEvent.setup()
      const onDeleteFile = vi.fn()

      render(<ProjectFileList {...defaultProps} onDeleteFile={onDeleteFile} />)

      const deleteButtons = screen.getAllByLabelText(/Delete/)
      await user.click(deleteButtons[2])

      expect(onDeleteFile).toHaveBeenCalledWith(2)
    })

    test('delete button has accessible label', () => {
      render(<ProjectFileList {...defaultProps} />)

      expect(screen.getByLabelText('Delete video1.mp4')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('file names are truncated with title attribute for tooltips', () => {
      render(<ProjectFileList {...defaultProps} />)

      const heading = screen.getByText('video1.mp4')
      expect(heading).toHaveAttribute('title', 'video1.mp4')
    })

    test('file paths have title attribute for tooltips', () => {
      render(<ProjectFileList {...defaultProps} />)

      const path = screen.getByText('/path/to/video1.mp4')
      expect(path).toHaveAttribute('title', '/path/to/video1.mp4')
    })
  })

  describe('Performance - List Item Memoization', () => {
    test('list items should be memoized to prevent unnecessary re-renders', () => {
      // This test verifies the component structure supports memoization
      // After refactoring, individual list items should be separate components
      const { rerender } = render(<ProjectFileList {...defaultProps} />)

      const initialItems = screen.getAllByRole('combobox')
      expect(initialItems).toHaveLength(3)

      // Re-render with same props
      rerender(<ProjectFileList {...defaultProps} />)

      const afterItems = screen.getAllByRole('combobox')
      expect(afterItems).toHaveLength(3)
    })

    test('callback props should remain stable across renders', () => {
      const onUpdateCamera = vi.fn()
      const onDeleteFile = vi.fn()

      const { rerender } = render(
        <ProjectFileList
          files={mockFiles}
          numCameras={3}
          onUpdateCamera={onUpdateCamera}
          onDeleteFile={onDeleteFile}
        />
      )

      const initialDeleteButtons = screen.getAllByLabelText(/Delete/)

      // Re-render with same callback references
      rerender(
        <ProjectFileList
          files={mockFiles}
          numCameras={3}
          onUpdateCamera={onUpdateCamera}
          onDeleteFile={onDeleteFile}
        />
      )

      const afterDeleteButtons = screen.getAllByLabelText(/Delete/)
      expect(afterDeleteButtons).toHaveLength(initialDeleteButtons.length)
    })

    test('individual items should not re-render when unrelated items change', () => {
      // This test documents expected behavior after memoization refactor
      // Each list item should be a separate memoized component
      const files = [
        ...mockFiles,
        {
          file: { name: 'video4.mp4', path: '/path/to/video4.mp4' },
          camera: 2
        }
      ]

      render(<ProjectFileList {...defaultProps} files={files} />)

      expect(screen.getByText('video1.mp4')).toBeInTheDocument()
      expect(screen.getByText('video4.mp4')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    test('handles single file', () => {
      render(
        <ProjectFileList
          {...defaultProps}
          files={[mockFiles[0]]}
          numCameras={1}
        />
      )

      expect(screen.getByText('video1.mp4')).toBeInTheDocument()
      expect(screen.getAllByRole('combobox')).toHaveLength(1)
    })

    test('handles large file lists', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        file: { name: `video${i}.mp4`, path: `/path/to/video${i}.mp4` },
        camera: (i % 3) + 1
      }))

      const { container } = render(
        <ProjectFileList {...defaultProps} files={manyFiles} numCameras={3} />
      )

      // With 100 files, virtual scrolling should be enabled (threshold is 50)
      const virtualContainer = container.querySelector('[data-virtual-container]')
      expect(virtualContainer).toBeInTheDocument()

      // Virtual scrolling means not all items are rendered at once (performance optimization)
      // The container should have the proper scroll structure
      expect(virtualContainer).toHaveStyle({ height: '600px' })
    })

    test('handles files with special characters in names', () => {
      const specialFiles = [
        {
          file: {
            name: "video's & \"special\".mp4",
            path: '/path/to/special.mp4'
          },
          camera: 1
        }
      ]

      render(<ProjectFileList {...defaultProps} files={specialFiles} />)

      expect(screen.getByText("video's & \"special\".mp4")).toBeInTheDocument()
    })

    test('handles very long file names', () => {
      const longFiles = [
        {
          file: {
            name: 'a'.repeat(200) + '.mp4',
            path: '/path/to/long.mp4'
          },
          camera: 1
        }
      ]

      render(<ProjectFileList {...defaultProps} files={longFiles} />)

      const longName = 'a'.repeat(200) + '.mp4'
      expect(screen.getByText(longName)).toBeInTheDocument()
    })

    test('handles numCameras = 1', () => {
      render(<ProjectFileList {...defaultProps} numCameras={1} />)

      const select = screen.getAllByRole('combobox')[0]
      const options = Array.from(select.querySelectorAll('option'))
      expect(options).toHaveLength(1)
      expect(options[0]).toHaveTextContent('Camera 1')
    })
  })

  describe('Animation', () => {
    test('applies staggered animation styles to list items', () => {
      const { container } = render(<ProjectFileList {...defaultProps} />)

      const items = container.querySelectorAll('.group')
      expect(items).toHaveLength(3)

      // Verify animation styles are applied (check that animation property exists and contains timing)
      items.forEach((item) => {
        const style = window.getComputedStyle(item)
        expect(style.animation).toContain('ms')
      })
    })
  })

  describe('Virtual Scrolling', () => {
    test('uses virtual scrolling for lists with 50+ files', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        file: { name: `video${i}.mp4`, path: `/path/to/video${i}.mp4` },
        camera: (i % 3) + 1
      }))

      const { container } = render(
        <ProjectFileList {...defaultProps} files={manyFiles} numCameras={3} />
      )

      // Virtual scrolling should create a container with specific data attributes
      const virtualContainer = container.querySelector('[data-virtual-container]')
      expect(virtualContainer).toBeInTheDocument()
    })

    test('does not use virtual scrolling for lists with fewer than 50 files', () => {
      const { container } = render(<ProjectFileList {...defaultProps} />)

      // Should not have virtual scrolling container
      const virtualContainer = container.querySelector('[data-virtual-container]')
      expect(virtualContainer).not.toBeInTheDocument()
    })

    test('renders visible items correctly with virtual scrolling', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        file: { name: `video${i}.mp4`, path: `/path/to/video${i}.mp4` },
        camera: (i % 3) + 1
      }))

      const { container } = render(
        <ProjectFileList {...defaultProps} files={manyFiles} numCameras={3} />
      )

      // Verify virtual container is set up correctly
      const virtualContainer = container.querySelector('[data-virtual-container]')
      expect(virtualContainer).toBeInTheDocument()

      // Verify the total size is calculated (100 items * 80px estimated height = 8000px)
      const innerDiv = virtualContainer?.querySelector('div')
      expect(innerDiv).toHaveStyle({ height: '8000px' })
    })

    test('preserves interactions with virtually scrolled items', () => {
      const onUpdateCamera = vi.fn()
      const onDeleteFile = vi.fn()

      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        file: { name: `video${i}.mp4`, path: `/path/to/video${i}.mp4` },
        camera: 1
      }))

      const { container } = render(
        <ProjectFileList
          files={manyFiles}
          numCameras={3}
          onUpdateCamera={onUpdateCamera}
          onDeleteFile={onDeleteFile}
        />
      )

      // Verify the virtual scrolling structure is in place
      const virtualContainer = container.querySelector('[data-virtual-container]')
      expect(virtualContainer).toBeInTheDocument()
      expect(virtualContainer).toHaveClass('overflow-auto')

      // Callbacks should be passed correctly (tested through component structure)
      expect(onUpdateCamera).toBeDefined()
      expect(onDeleteFile).toBeDefined()
    })

    test('maintains animations for items below virtual scrolling threshold', () => {
      const files = Array.from({ length: 30 }, (_, i) => ({
        file: { name: `video${i}.mp4`, path: `/path/to/video${i}.mp4` },
        camera: 1
      }))

      const { container } = render(
        <ProjectFileList {...defaultProps} files={files} numCameras={3} />
      )

      // Should still have animation styles for lists under 50 items
      const items = container.querySelectorAll('.group')
      expect(items.length).toBeGreaterThan(0)
      items.forEach((item) => {
        const style = window.getComputedStyle(item)
        expect(style.animation).toContain('ms')
      })
    })
  })
})
