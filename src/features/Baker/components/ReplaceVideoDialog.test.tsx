/**
 * ReplaceVideoDialog (issue #282, B4-B5)
 *
 * Presentational, like SetPosterFrameDialog: every value is owned by
 * useReplaceVideo. The dialog is itself the confirmation for an irreversible
 * Sprout replace, so it carries the warning and there is no second modal.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ReplaceVideoDialog } from './ReplaceVideoDialog'
import type { ReplaceVideoDialogProps } from './ReplaceVideoDialog'

const CARDS = [
  { cardId: 'c1', title: 'Card One', boardName: 'MSc Board' },
  { cardId: 'c2', title: 'Card Two' }
]

function baseProps(overrides: Partial<ReplaceVideoDialogProps> = {}): ReplaceVideoDialogProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    videoTitle: 'WBS - MSc - Managing Change',
    upload: {
      selectedFile: null,
      onSelectFile: vi.fn(),
      status: 'idle',
      progress: { percentage: 0, bytesSent: 0, totalBytes: 0 },
      error: null,
      onCancel: vi.fn()
    },
    posterMode: 'keep',
    onPosterModeChange: vi.fn(),
    trello: {
      available: true,
      enabled: true,
      onEnabledChange: vi.fn(),
      cards: CARDS,
      selectedCardIds: ['c1', 'c2'],
      onToggleCard: vi.fn(),
      text: 'Replaced the video "WBS - MSc - Managing Change" on Sprout Video. The link is unchanged.',
      onTextChange: vi.fn(),
      validationMessage: null
    },
    canSubmit: false,
    onConfirm: vi.fn(),
    ...overrides
  }
}

const withFile = (overrides: Partial<ReplaceVideoDialogProps> = {}) =>
  baseProps({
    upload: {
      ...baseProps().upload,
      selectedFile: '/Volumes/Renders/WBS_managing_change_v2.mp4',
      ...(overrides.upload ?? {})
    },
    canSubmit: true,
    ...overrides
  })

const primary = () => screen.getByRole('button', { name: /^replace video$/i })

describe('ReplaceVideoDialog - form', () => {
  it('b4_1_names_the_video_defaults_to_keep_and_blocks_submit_without_a_file', () => {
    render(<ReplaceVideoDialog {...baseProps()} />)

    expect(screen.getByText('WBS - MSc - Managing Change')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /keep the current poster frame/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /set a new poster frame/i })).not.toBeChecked()
    expect(primary()).toBeDisabled()
  })

  it('asks the caller to pick a file', () => {
    const onSelectFile = vi.fn()
    render(
      <ReplaceVideoDialog {...baseProps({ upload: { ...baseProps().upload, onSelectFile } })} />
    )

    fireEvent.click(screen.getByRole('button', { name: /choose (a )?file/i }))

    expect(onSelectFile).toHaveBeenCalledTimes(1)
  })

  it('b4_6_shows_the_chosen_filename_and_the_permanent_replacement_warning', () => {
    render(<ReplaceVideoDialog {...withFile()} />)

    expect(screen.getByText('WBS_managing_change_v2.mp4')).toBeInTheDocument()
    expect(screen.getByText(/permanently replaced/i)).toBeInTheDocument()
    expect(screen.getByText(/links stay the same/i)).toBeInTheDocument()
    expect(primary()).toBeEnabled()
  })

  it('reports the poster frame choice', () => {
    const onPosterModeChange = vi.fn()
    render(<ReplaceVideoDialog {...withFile({ onPosterModeChange })} />)

    fireEvent.click(screen.getByRole('radio', { name: /set a new poster frame/i }))

    expect(onPosterModeChange).toHaveBeenCalledWith('new')
  })

  it('b4_3_renders_no_trello_section_when_it_is_unavailable', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({ trello: { ...baseProps().trello, available: false } })}
      />
    )

    expect(screen.queryByText(/comment on trello/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Card One')).not.toBeInTheDocument()
  })

  it('b4_4_shows_the_toggle_on_every_card_checked_and_the_prefilled_comment', () => {
    render(<ReplaceVideoDialog {...withFile()} />)

    expect(screen.getByRole('checkbox', { name: /comment on trello/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /card one/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /card two/i })).toBeChecked()
    expect(screen.getByText('MSc Board')).toBeInTheDocument()
    expect(screen.getByLabelText(/^comment$/i)).toHaveValue(
      'Replaced the video "WBS - MSc - Managing Change" on Sprout Video. The link is unchanged.'
    )
  })

  it('reports card and text edits back to the caller', () => {
    const onToggleCard = vi.fn()
    const onTextChange = vi.fn()
    const onEnabledChange = vi.fn()
    render(
      <ReplaceVideoDialog
        {...withFile({
          trello: { ...baseProps().trello, onToggleCard, onTextChange, onEnabledChange }
        })}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /card two/i }))
    fireEvent.change(screen.getByLabelText(/^comment$/i), {
      target: { value: 'New cut is live.' }
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /comment on trello/i }))

    expect(onToggleCard).toHaveBeenCalledWith('c2')
    expect(onTextChange).toHaveBeenCalledWith('New cut is live.')
    expect(onEnabledChange).toHaveBeenCalledWith(false)
  })

  it('b4_5_shows_the_validation_message_and_blocks_submit', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({
          canSubmit: false,
          trello: {
            ...baseProps().trello,
            selectedCardIds: [],
            validationMessage: 'Choose at least one card, or turn the comment off.'
          }
        })}
      />
    )

    expect(
      screen.getByText('Choose at least one card, or turn the comment off.')
    ).toBeInTheDocument()
    expect(primary()).toBeDisabled()
  })

  it('hides the card list and comment when the toggle is off', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({ trello: { ...baseProps().trello, enabled: false } })}
      />
    )

    expect(screen.getByRole('checkbox', { name: /comment on trello/i })).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /card one/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^comment$/i)).not.toBeInTheDocument()
  })
})

describe('ReplaceVideoDialog - transfer lifecycle', () => {
  it('b5_1_submits_through_the_primary_action', () => {
    const onConfirm = vi.fn()
    render(<ReplaceVideoDialog {...withFile({ onConfirm })} />)

    fireEvent.click(primary())

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('b5_1_shows_progress_while_uploading', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({
          upload: {
            ...withFile().upload,
            status: 'uploading',
            progress: { percentage: 42.5, bytesSent: 425_000_000, totalBytes: 1_000_000_000 }
          }
        })}
      />
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText(/42%|43%/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^replace video$/i })).not.toBeInTheDocument()
  })

  it('b5_2_offers_cancel_while_uploading_and_reports_it', () => {
    const onCancel = vi.fn()
    render(
      <ReplaceVideoDialog
        {...withFile({ upload: { ...withFile().upload, status: 'uploading', onCancel } })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('b5_2_shows_a_disabled_cancelling_state_until_the_backend_confirms', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({ upload: { ...withFile().upload, status: 'cancelling' } })}
      />
    )

    expect(screen.getByRole('button', { name: /cancelling/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^replace video$/i })).not.toBeInTheDocument()
  })

  it('b5_3_does_not_ask_to_close_on_escape_while_uploading', () => {
    const onOpenChange = vi.fn()
    render(
      <ReplaceVideoDialog
        {...withFile({ onOpenChange, upload: { ...withFile().upload, status: 'uploading' } })}
      />
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('b5_3_does_not_ask_to_close_on_escape_while_cancelling', () => {
    const onOpenChange = vi.fn()
    render(
      <ReplaceVideoDialog
        {...withFile({ onOpenChange, upload: { ...withFile().upload, status: 'cancelling' } })}
      />
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('asks to close on escape when idle', () => {
    const onOpenChange = vi.fn()
    render(<ReplaceVideoDialog {...withFile({ onOpenChange })} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('b5_4_shows_the_error_inline_and_leaves_the_form_re_submittable', () => {
    render(
      <ReplaceVideoDialog
        {...withFile({
          upload: {
            ...withFile().upload,
            status: 'error',
            error: 'Sprout rejected the request: HTTP 413 Request Entity Too Large'
          }
        })}
      />
    )

    expect(screen.getByText(/HTTP 413 Request Entity Too Large/)).toBeInTheDocument()
    expect(screen.getByText('WBS_managing_change_v2.mp4')).toBeInTheDocument()
    expect(primary()).toBeEnabled()
  })
})
