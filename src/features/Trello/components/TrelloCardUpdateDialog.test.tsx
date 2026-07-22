/**
 * Tests for TrelloCardUpdateDialog — card selection and the optional
 * rename-to-video-title checkbox
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TrelloCard } from '@shared/types'

import { TrelloCardUpdateDialog } from './TrelloCardUpdateDialog'

const cards: TrelloCard[] = [
  {
    url: 'https://trello.com/c/abc123/my-card',
    cardId: 'abc123',
    title: 'Old Card Name',
    boardName: 'Production'
  }
]

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  trelloCards: cards,
  onAddTrelloCard: vi.fn()
}

describe('TrelloCardUpdateDialog', () => {
  it('hides the rename option when no proposed name is given', () => {
    render(<TrelloCardUpdateDialog {...baseProps} onUpdate={vi.fn()} />)

    expect(screen.queryByText(/rename card/i)).not.toBeInTheDocument()
  })

  it('shows the rename option with the proposed name, unticked by default', () => {
    render(
      <TrelloCardUpdateDialog
        {...baseProps}
        onUpdate={vi.fn()}
        proposedCardName="My Video (1:30mins)"
      />
    )

    expect(screen.getByText(/rename card/i)).toBeInTheDocument()
    expect(screen.getByText('My Video (1:30mins)')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /rename card/i })).not.toBeChecked()
  })

  it('passes renameToVideoTitle: false when the checkbox is left unticked', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <TrelloCardUpdateDialog
        {...baseProps}
        onUpdate={onUpdate}
        proposedCardName="My Video (1:30mins)"
      />
    )

    // Select the card via its checkbox (first in the list)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole('button', { name: /update 1 card/i }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith([0], { renameToVideoTitle: false })
    )
  })

  it('passes renameToVideoTitle: true when the checkbox is ticked', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <TrelloCardUpdateDialog
        {...baseProps}
        onUpdate={onUpdate}
        proposedCardName="My Video (1:30mins)"
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0]) // select the card
    fireEvent.click(screen.getByRole('checkbox', { name: /rename card/i }))
    fireEvent.click(screen.getByRole('button', { name: /update 1 card/i }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith([0], { renameToVideoTitle: true })
    )
  })
})
