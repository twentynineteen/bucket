/**
 * Tests for SetPosterFrameDialog — the card action that sets a branded poster
 * frame on an already-linked Sprout video.
 * Issue #141 (B3.1-B3.3, B3.5-B3.8, B4.1-B4.5, B5.3, B5.4)
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SetPosterFrameDialog } from './SetPosterFrameDialog'
import type {
  SetPosterFrameDialogProps,
  SetPosterFramePanelState
} from './SetPosterFrameDialog'

const BACKGROUNDS = ['/backgrounds/wbs-blue.jpg', '/backgrounds/wbs-red.png']

function panelState(
  overrides: Partial<SetPosterFramePanelState> = {}
): SetPosterFramePanelState {
  return {
    unavailableReason: null,
    backgrounds: BACKGROUNDS,
    selectedBackground: BACKGROUNDS[0],
    onBackgroundChange: vi.fn(),
    template: 'rebrand',
    offAspect: false,
    text: 'Managing Change',
    onTextChange: vi.fn(),
    previewImageUrl: 'blob:preview',
    saveCopy: false,
    onSaveCopyChange: vi.fn(),
    status: 'idle',
    error: null,
    ...overrides
  }
}

function baseProps(
  overrides: Partial<SetPosterFrameDialogProps> = {}
): SetPosterFrameDialogProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    videoTitle: 'WBS - MSc - Managing Change',
    posterFrame: panelState(),
    canvasRef: React.createRef<HTMLCanvasElement>(),
    onConfirm: vi.fn(),
    onRetry: vi.fn(),
    ...overrides
  }
}

describe('SetPosterFrameDialog - contents', () => {
  it('b3_1_names_the_video_the_frame_will_be_set_on', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByText('WBS - MSc - Managing Change')).toBeInTheDocument()
  })

  it('b3_2_shows_the_selected_background_filename', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByText('wbs-blue.jpg')).toBeInTheDocument()
  })

  it('b3_3_shows_the_prefilled_poster_frame_text', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByLabelText(/poster frame text/i)).toHaveValue('Managing Change')
  })

  it('b3_4_reports_text_edits_back_to_the_caller', () => {
    const onTextChange = vi.fn()
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ onTextChange }) })}
      />
    )

    fireEvent.change(screen.getByLabelText(/poster frame text/i), {
      target: { value: 'Change, Managed' }
    })

    expect(onTextChange).toHaveBeenCalledWith('Change, Managed')
  })

  it('b3_5_renders_the_live_preview_canvas', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByRole('img', { name: /poster frame preview/i })).toBeInTheDocument()
  })

  it('b3_6_offers_the_save_a_copy_tick_reflecting_the_remembered_choice', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ saveCopy: true }) })}
      />
    )

    expect(
      screen.getByRole('checkbox', { name: /save a copy .*graphics/i })
    ).toBeChecked()
  })

  it('b3_6_reports_the_save_a_copy_tick_back_to_the_caller', () => {
    const onSaveCopyChange = vi.fn()
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ onSaveCopyChange }) })}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /save a copy .*graphics/i }))

    expect(onSaveCopyChange).toHaveBeenCalledWith(true)
  })

  it('b3_7_warns_that_the_current_poster_frame_will_be_replaced', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByText(/replaces the current poster frame/i)).toBeInTheDocument()
  })

  it('b3_7_exposes_exactly_one_confirming_button_and_no_second_confirmation', () => {
    const onConfirm = vi.fn()
    render(<SetPosterFrameDialog {...baseProps({ onConfirm })} />)

    const confirm = screen.getByRole('button', { name: /^set poster frame$/i })
    fireEvent.click(confirm)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    // No AlertDialog step in between
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('SetPosterFrameDialog - required text (B3.8)', () => {
  it('b3_8_disables_the_action_and_explains_when_the_text_is_empty', () => {
    render(
      <SetPosterFrameDialog {...baseProps({ posterFrame: panelState({ text: '' }) })} />
    )

    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
    expect(screen.getByText(/poster frame text is required/i)).toBeInTheDocument()
  })

  it('b3_8_treats_whitespace_only_text_as_empty', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ text: '   ' }) })}
      />
    )

    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
    expect(screen.getByText(/poster frame text is required/i)).toBeInTheDocument()
  })

  it('b3_8_enables_the_action_once_there_is_real_text', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeEnabled()
    expect(screen.queryByText(/poster frame text is required/i)).not.toBeInTheDocument()
  })
})

describe('SetPosterFrameDialog - unavailable configuration', () => {
  it('b4_1_explains_a_missing_background_folder_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason:
              'No default background folder configured. Set one in Settings.'
          })
        })}
      />
    )

    expect(screen.getByText(/Set one in Settings/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  // Issue #166 B6.1. The b4_* cases above predate the cannot-read state, so
  // without this the dialog had no test proving it renders the new reason: the
  // one a user actually hits when a configured folder stops resolving.
  it('b6_1_explains_a_background_folder_it_cannot_read_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason:
              'Cannot read background folder: /Users/me/Documents/backgrounds',
            backgrounds: []
          })
        })}
      />
    )

    expect(
      screen.getByText(
        /Cannot read background folder: \/Users\/me\/Documents\/backgrounds/i
      )
    ).toBeInTheDocument()
    // Must not regress to blaming an empty folder for one that is not there.
    expect(screen.queryByText(/no image files/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  it('b6_3_explains_a_font_check_that_could_not_run_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason:
              'Could not check whether the poster frame font is installed.'
          })
        })}
      />
    )

    expect(screen.getByText(/could not check whether/i)).toBeInTheDocument()
    expect(screen.queryByText(/requires Cabrito/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  it('b4_2_explains_a_folder_with_no_images_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason: 'The background folder contains no image files.',
            backgrounds: []
          })
        })}
      />
    )

    expect(screen.getByText(/no image files/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  it('b4_3_explains_a_missing_font_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason:
              'Poster frame text requires Cabrito.otf in ~/Library/Fonts.'
          })
        })}
      />
    )

    expect(screen.getByText(/requires Cabrito\.otf/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  it('b4_4_explains_a_missing_sprout_api_key_and_disables_the_action', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({
          posterFrame: panelState({
            unavailableReason:
              'Sprout Video API key not configured. Go to Settings to add it.'
          })
        })}
      />
    )

    expect(screen.getByText(/API key not configured/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeDisabled()
  })

  it('b4_5_claims_no_reason_while_the_checks_are_still_in_flight', () => {
    render(<SetPosterFrameDialog {...baseProps()} />)

    expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cabrito/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^set poster frame$/i })).toBeEnabled()
  })
})

describe('SetPosterFrameDialog - request in flight and failure', () => {
  it('b5_3_locks_the_dialog_while_the_request_is_in_flight', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ status: 'working' }) })}
      />
    )

    expect(screen.getByRole('button', { name: /setting poster frame/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('b5_3_keeps_the_text_field_untouchable_while_working', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ status: 'working' }) })}
      />
    )

    expect(screen.getByLabelText(/poster frame text/i)).toBeDisabled()
  })

  it('b5_4_reports_a_terminal_failure_with_a_retry_action', () => {
    const onRetry = vi.fn()
    render(
      <SetPosterFrameDialog
        {...baseProps({
          onRetry,
          posterFrame: panelState({
            status: 'error',
            error: 'Poster frame is 793 KB — Sprout Video allows up to 500 KB.'
          })
        })}
      />
    )

    expect(screen.getByText(/793 KB/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('SetPosterFrameDialog - template visibility and aspect warning (#189)', () => {
  it('b3_2_names_the_active_template_even_without_a_selector', () => {
    // This dialog deliberately has no selector - it follows the shared
    // last-used choice - so the user must at least see which template will
    // render before sending a frame to Sprout (review round, finding 4).
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ template: 'rebrand' }) })}
      />
    )

    expect(screen.getByText(/rebrand/i)).toBeInTheDocument()
  })

  it('b4_2_warns_when_the_background_is_off_aspect', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ offAspect: true }) })}
      />
    )

    expect(screen.getByText(/16:9/)).toBeInTheDocument()
  })

  it('b4_2_shows_no_aspect_warning_for_a_16_9_background', () => {
    render(
      <SetPosterFrameDialog
        {...baseProps({ posterFrame: panelState({ offAspect: false }) })}
      />
    )

    expect(screen.queryByText(/16:9/)).not.toBeInTheDocument()
  })
})
