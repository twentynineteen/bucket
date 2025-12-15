/**
 * Component Test: ExampleList (T013)
 * Feature: 007-frontend-script-example
 */

import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'
import { ExampleList } from '@pages/AI/ExampleEmbeddings/ExampleList'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Mock the ExampleCard component to simplify testing
vi.mock('@pages/AI/ExampleEmbeddings/ExampleCard', () => ({
  ExampleCard: ({ example, onDelete, onReplace }: any) => (
    <div data-testid={`example-card-${example.id}`}>
      <span>{example.title}</span>
      <button onClick={() => onDelete(example.id)}>Delete</button>
      <button onClick={() => onReplace(example.id)}>Replace</button>
    </div>
  )
}))

const mockExamples: ExampleWithMetadata[] = [
  {
    id: '1',
    title: 'Example 1',
    source: 'bundled',
    filepath: 'example1.txt',
    uploadedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    title: 'Example 2',
    source: 'uploaded',
    filepath: 'example2.txt',
    uploadedAt: '2024-01-02T00:00:00Z'
  }
]

describe('ExampleList - Contract Tests (T013)', () => {
  it('should render loading skeleton when isLoading=true', () => {
    render(
      <ExampleList
        examples={[]}
        isLoading={true}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should render empty state when examples.length === 0', () => {
    render(
      <ExampleList
        examples={[]}
        isLoading={false}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Should show empty state message
    expect(screen.getByText('No examples found')).toBeInTheDocument()
    expect(screen.getByText(/Upload your first script example/i)).toBeInTheDocument()
  })

  it('should render grid of ExampleCards when examples provided', () => {
    render(
      <ExampleList
        examples={mockExamples}
        isLoading={false}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Should render both example cards
    expect(screen.getByTestId('example-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('example-card-2')).toBeInTheDocument()
    expect(screen.getByText('Example 1')).toBeInTheDocument()
    expect(screen.getByText('Example 2')).toBeInTheDocument()
  })

  it('should call onDelete when delete action triggered from card', async () => {
    const onDeleteMock = vi.fn()
    const user = userEvent.setup()

    render(
      <ExampleList
        examples={mockExamples}
        isLoading={false}
        onDelete={onDeleteMock}
        onReplace={vi.fn()}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Click delete button on first card
    const deleteButton = screen.getAllByText('Delete')[0]
    await user.click(deleteButton)

    expect(onDeleteMock).toHaveBeenCalledWith('1')
  })

  it('should call onReplace when replace action triggered from card', async () => {
    const onReplaceMock = vi.fn()
    const user = userEvent.setup()

    render(
      <ExampleList
        examples={mockExamples}
        isLoading={false}
        onDelete={vi.fn()}
        onReplace={onReplaceMock}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Click replace button on first card
    const replaceButton = screen.getAllByText('Replace')[0]
    await user.click(replaceButton)

    expect(onReplaceMock).toHaveBeenCalledWith('1')
  })

  it('should maintain grid layout responsiveness', () => {
    const { container } = render(
      <ExampleList
        examples={mockExamples}
        isLoading={false}
        onDelete={vi.fn()}
        onReplace={vi.fn()}
        onView={vi.fn()}
        onDownload={vi.fn()}
      />
    )

    // Check for responsive grid classes
    const gridElement = container.querySelector('.grid')
    expect(gridElement).toBeInTheDocument()
    expect(gridElement?.className).toContain('sm:grid-cols-1')
    expect(gridElement?.className).toContain('md:grid-cols-2')
    expect(gridElement?.className).toContain('lg:grid-cols-3')
  })
})
