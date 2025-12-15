/**
 * Component Test: DeleteConfirm (T016)
 * Feature: 007-frontend-script-example
 */

import { DeleteConfirm } from '@/pages/AI/ExampleEmbeddings/DeleteConfirm'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

describe('DeleteConfirm - Contract Tests (T016)', () => {
  const defaultProps = {
    open: true,
    exampleTitle: 'Test Example',
    isDeleting: false,
    onClose: vi.fn(),
    onConfirm: vi.fn()
  }

  it('should show example title in warning message', () => {
    // Contract: Must display "Delete {exampleTitle}?" in dialog
    // Contract: Must show destructive action warning
    render(<DeleteConfirm {...defaultProps} />)

    expect(screen.getByText('Delete Example?')).toBeInTheDocument()
    expect(screen.getByText(/Test Example/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('should call onConfirm when delete button clicked', async () => {
    // Contract: Delete button must call onConfirm callback
    // Contract: Button should have destructive styling (red)
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DeleteConfirm {...defaultProps} onConfirm={onConfirm} />)

    const deleteButton = screen.getByRole('button', { name: /^delete$/i })
    expect(deleteButton).toHaveClass('bg-destructive')

    await user.click(deleteButton)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button clicked', async () => {
    // Contract: Cancel button must call onClose callback
    // Contract: Must close dialog without calling onConfirm
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<DeleteConfirm {...defaultProps} onClose={onClose} onConfirm={onConfirm} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('should show loading state when isDeleting=true', () => {
    // Contract: Must disable both buttons during deletion
    // Contract: Must show Loader2 icon with spinning animation
    // Contract: Delete button text changes to "Deleting..."
    render(<DeleteConfirm {...defaultProps} isDeleting={true} />)

    const deleteButton = screen.getByRole('button', { name: /deleting/i })
    const cancelButton = screen.getByRole('button', { name: /cancel/i })

    expect(deleteButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
    expect(screen.getByText('Deleting...')).toBeInTheDocument()
  })

  it('should use Radix UI AlertDialog component', () => {
    // Contract: Must use AlertDialog.Root, AlertDialog.Content
    // Contract: Must have AlertDialog.Title and AlertDialog.Description
    // Contract: Must be accessible (ARIA attributes)
    render(<DeleteConfirm {...defaultProps} />)

    // AlertDialog renders with proper ARIA attributes
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete Example?')).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('should close dialog on Escape key press', async () => {
    // Contract: Pressing Escape must call onClose
    // Contract: Must not delete when Escape pressed
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<DeleteConfirm {...defaultProps} onClose={onClose} onConfirm={onConfirm} />)

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('should prevent deletion during loading state', async () => {
    // Contract: When isDeleting=true, buttons must be disabled
    // Contract: Multiple clicks should not trigger multiple deletions
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DeleteConfirm {...defaultProps} isDeleting={true} onConfirm={onConfirm} />)

    const deleteButton = screen.getByRole('button', { name: /deleting/i })
    expect(deleteButton).toBeDisabled()

    // Try to click disabled button (should not trigger callback)
    await user.click(deleteButton)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
