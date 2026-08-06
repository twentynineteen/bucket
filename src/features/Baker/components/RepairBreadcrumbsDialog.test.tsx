/**
 * Repair Breadcrumbs Dialog Tests
 *
 * B3.1/B3.2 — repairing an unparseable breadcrumbs file is confirmed via an
 * AlertDialog that explains a backup is always written first.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RepairBreadcrumbsDialog } from './RepairBreadcrumbsDialog'

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof RepairBreadcrumbsDialog>> = {}
) => {
  const props = {
    open: true,
    projectName: 'Podcast Ep 1',
    isRepairing: false,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides
  }
  render(<RepairBreadcrumbsDialog {...props} />)
  return props
}

describe('RepairBreadcrumbsDialog', () => {
  it('names the project and mentions the backup', () => {
    renderDialog()

    expect(screen.getByText(/Podcast Ep 1/)).toBeInTheDocument()
    expect(screen.getByText(/backup/i)).toBeInTheDocument()
  })

  it('confirms the repair', () => {
    const props = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /repair/i }))

    expect(props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('can be cancelled without repairing', () => {
    const props = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('disables the confirm button while repairing', () => {
    renderDialog({ isRepairing: true })

    expect(screen.getByRole('button', { name: /repairing/i })).toBeDisabled()
  })
})
