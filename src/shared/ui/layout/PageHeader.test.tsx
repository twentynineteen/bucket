import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page heading, level 1', () => {
    render(<PageHeader title="Upload to SproutVideo" />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Upload to SproutVideo' })
    ).toBeInTheDocument()
  })

  it('renders no description paragraph when none is given', () => {
    const { container } = render(<PageHeader title="Baker" />)

    expect(container.querySelector('p')).toBeNull()
  })

  it('renders the description under the title, in the same block', () => {
    render(<PageHeader title="Baker" description="Scan folders and update breadcrumbs" />)

    const title = screen.getByRole('heading', { level: 1 })
    const description = screen.getByText('Scan folders and update breadcrumbs')
    expect(title.parentElement).toContainElement(description)
    expect(title.compareDocumentPosition(description)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('renders the icon before the title', () => {
    render(<PageHeader title="Baker" icon={<svg data-testid="page-icon" />} />)

    const icon = screen.getByTestId('page-icon')
    const title = screen.getByRole('heading', { level: 1 })
    expect(icon.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('renders actions after the title, and children between the title and the actions', () => {
    render(
      <PageHeader title="Baker" actions={<button type="button">Settings</button>}>
        <input aria-label="Scan folder" />
      </PageHeader>
    )

    const title = screen.getByRole('heading', { level: 1 })
    const child = screen.getByRole('textbox', { name: 'Scan folder' })
    const action = screen.getByRole('button', { name: 'Settings' })

    expect(title.compareDocumentPosition(child)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(child.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('renders only what it was given: no actions container without actions', () => {
    const { container } = render(<PageHeader title="Baker" />)

    expect(within(container).queryByRole('button')).not.toBeInTheDocument()
    expect(container.firstElementChild?.children).toHaveLength(1)
  })

  it('lets the title block take the remaining width unless children share the row', () => {
    const { rerender } = render(<PageHeader title="Baker" />)
    const titleBlock = () => screen.getByRole('heading', { level: 1 }).parentElement!

    expect(titleBlock()).toHaveClass('flex-1')

    rerender(
      <PageHeader title="Baker">
        <input aria-label="Scan folder" />
      </PageHeader>
    )

    expect(titleBlock()).not.toHaveClass('flex-1')
    expect(titleBlock()).toHaveClass('flex-shrink-0')
  })

  it('appends a caller className to the header row', () => {
    const { container } = render(<PageHeader title="Baker" className="custom-row" />)

    expect(container.firstElementChild).toHaveClass('custom-row')
  })
})
