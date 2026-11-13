/**
 * Test Suite: BatchActions Component
 *
 * The batch footer sits under the project list and renders only while at least
 * one project is ticked. It says how many are ticked, how many of those have
 * something to write, and opens the review dialog. Selecting every project is
 * the list header checkbox's job now, so there is no "Select all" here.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { BatchActions } from './BatchActions'

describe('BatchActions Component', () => {
  let mockOnClearSelection: Mock
  let mockOnApplyChanges: Mock

  beforeEach(() => {
    mockOnClearSelection = vi.fn()
    mockOnApplyChanges = vi.fn()
  })

  interface BarOptions {
    selected?: string[]
    needingUpdate?: number
    hiddenByFilter?: number
    isUpdating?: boolean
  }

  const renderBar = ({
    selected = ['/path/to/project1'],
    needingUpdate = selected.length,
    hiddenByFilter,
    isUpdating = false
  }: BarOptions = {}) =>
    render(
      <BatchActions
        selectedProjects={selected}
        needingUpdateCount={needingUpdate}
        hiddenByFilterCount={hiddenByFilter}
        isUpdating={isUpdating}
        onClearSelection={mockOnClearSelection}
        onApplyChanges={mockOnApplyChanges}
      />
    )

  describe('Visibility', () => {
    test('renders nothing when no projects are selected', () => {
      const { container } = renderBar({ selected: [] })

      expect(container.firstChild).toBeNull()
    })

    test('appears with the review button when at least one project is selected', () => {
      renderBar()

      expect(
        screen.getByRole('button', { name: 'Review and update breadcrumbs' })
      ).toBeEnabled()
    })

    test('has no Select all button, because the list header checkbox replaced it', () => {
      renderBar()

      expect(
        screen.queryByRole('button', { name: /select all/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Selection summary', () => {
    test('shows how many projects are selected', () => {
      renderBar({
        selected: ['/a', '/b', '/c'],
        needingUpdate: 3
      })

      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    test('shows only the update count when every selected project needs updating', () => {
      renderBar({ selected: ['/a', '/b'], needingUpdate: 2 })

      expect(screen.getByText('2 to update')).toBeInTheDocument()
      expect(screen.queryByText(/already current/)).not.toBeInTheDocument()
    })

    test('says how many selected projects are already current and will be skipped', () => {
      renderBar({ selected: ['/a', '/b', '/c'], needingUpdate: 2 })

      expect(
        screen.getByText('2 to update · 1 already current, skipped')
      ).toBeInTheDocument()
    })

    test('shows only the skipped count when every selected project is already current', () => {
      renderBar({ selected: ['/a', '/b'], needingUpdate: 0 })

      expect(screen.getByText('2 already current, skipped')).toBeInTheDocument()
      expect(screen.queryByText(/to update/)).not.toBeInTheDocument()
    })

    test('says how many selected projects the active filter is hiding', () => {
      renderBar({ selected: ['/a', '/b', '/c'], needingUpdate: 3, hiddenByFilter: 1 })

      expect(screen.getByText('(1 hidden by filter)')).toBeInTheDocument()
    })

    test('omits the hidden-by-filter note when the filter hides nothing', () => {
      renderBar({ selected: ['/a'], hiddenByFilter: 0 })

      expect(screen.queryByText(/hidden by filter/)).not.toBeInTheDocument()
    })
  })

  describe('Updating state', () => {
    test('disables the button and shows "Updating..." while an update runs', () => {
      renderBar({ isUpdating: true })

      expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Review and update breadcrumbs' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    test('calls onApplyChanges, and nothing else, when the review button is clicked', async () => {
      const user = userEvent.setup()
      renderBar()

      await user.click(
        screen.getByRole('button', { name: 'Review and update breadcrumbs' })
      )

      expect(mockOnApplyChanges).toHaveBeenCalledTimes(1)
      expect(mockOnClearSelection).not.toHaveBeenCalled()
    })

    test('calls onClearSelection, and nothing else, when "Clear selection" is clicked', async () => {
      const user = userEvent.setup()
      renderBar()

      await user.click(screen.getByRole('button', { name: 'Clear selection' }))

      expect(mockOnClearSelection).toHaveBeenCalledTimes(1)
      expect(mockOnApplyChanges).not.toHaveBeenCalled()
    })

    test('both buttons are reachable and operable from the keyboard', async () => {
      const user = userEvent.setup()
      renderBar()

      await user.tab()
      expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveFocus()
      await user.keyboard('{Enter}')

      await user.tab()
      expect(
        screen.getByRole('button', { name: 'Review and update breadcrumbs' })
      ).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(mockOnClearSelection).toHaveBeenCalledTimes(1)
      expect(mockOnApplyChanges).toHaveBeenCalledTimes(1)
    })
  })
})
