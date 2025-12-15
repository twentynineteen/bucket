/**
 * Component Test: ExampleCard (T014)
 * Feature: 007-frontend-script-example
 */

import { ExampleCard } from '@/pages/AI/ExampleEmbeddings/ExampleCard'
import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

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

describe('ExampleCard - Contract Tests (T014)', () => {
  const bundledExample: ExampleWithMetadata = {
    id: '1',
    title: 'Bundled Example',
    category: 'dramatic',
    source: 'bundled',
    beforeText: 'This is a short preview text.',
    afterText: 'After text',
    tags: ['drama', 'emotional'],
    wordCount: 150,
    qualityScore: 4.5,
    createdAt: '2024-01-01T00:00:00Z'
  }

  const uploadedExample: ExampleWithMetadata = {
    id: '2',
    title: 'User Example',
    category: 'comedy',
    source: 'user-uploaded',
    beforeText: 'A'.repeat(250), // Long text to test truncation
    afterText: 'After text',
    tags: ['funny', 'light'],
    wordCount: 200,
    qualityScore: 4.0,
    createdAt: '2024-01-02T00:00:00Z'
  }

  const defaultProps = {
    onDelete: vi.fn(),
    onReplace: vi.fn(),
    onView: vi.fn(),
    onDownload: vi.fn()
  }

  it('should display example title, category, and source badge', () => {
    // Contract: Must show example.title
    // Contract: Must show example.category
    // Contract: Must show badge with source ('Bundled' or 'Uploaded')
    render(<ExampleCard example={bundledExample} {...defaultProps} />)

    expect(screen.getByText('Bundled Example')).toBeInTheDocument()
    expect(screen.getByText('dramatic')).toBeInTheDocument()
    expect(screen.getByText('Bundled')).toBeInTheDocument()
  })

  it('should show preview text truncated to ~200 chars', () => {
    // Contract: Must display truncated beforeText
    // Contract: Must add ellipsis if content exceeds limit
    render(<ExampleCard example={uploadedExample} {...defaultProps} />)

    const previewText = screen.getByText(/A+\.\.\./)
    expect(previewText).toBeInTheDocument()
    expect(previewText.textContent?.length).toBeLessThanOrEqual(203) // 200 chars + "..."
  })

  it('should display tags as badges', () => {
    // Contract: Must render each tag in tags array as Badge component
    render(<ExampleCard example={bundledExample} {...defaultProps} />)

    expect(screen.getByText('drama')).toBeInTheDocument()
    expect(screen.getByText('emotional')).toBeInTheDocument()
  })

  it('should hide delete/replace buttons for bundled examples', () => {
    // Contract: If source='bundled', action buttons must be hidden
    render(<ExampleCard example={bundledExample} {...defaultProps} />)

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Replace')).not.toBeInTheDocument()
    // Download button should still be visible
    expect(screen.getByTitle('Download')).toBeInTheDocument()
  })

  it('should show delete/replace buttons for user-uploaded examples', () => {
    // Contract: If source='user-uploaded', must show RefreshCw and Trash2 buttons
    render(<ExampleCard example={uploadedExample} {...defaultProps} />)

    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(screen.getByTitle('Replace')).toBeInTheDocument()
    expect(screen.getByTitle('Download')).toBeInTheDocument()
  })

  it('should call onDelete when delete button clicked', async () => {
    // Contract: Clicking delete button calls onDelete callback
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
      <ExampleCard example={uploadedExample} {...defaultProps} onDelete={onDelete} />
    )

    const deleteButton = screen.getByTitle('Delete')
    await user.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith('2')
  })

  it('should call onReplace when replace button clicked', async () => {
    // Contract: Clicking replace button calls onReplace callback
    const user = userEvent.setup()
    const onReplace = vi.fn()

    render(
      <ExampleCard example={uploadedExample} {...defaultProps} onReplace={onReplace} />
    )

    const replaceButton = screen.getByTitle('Replace')
    await user.click(replaceButton)

    expect(onReplace).toHaveBeenCalledWith('2')
  })
})
