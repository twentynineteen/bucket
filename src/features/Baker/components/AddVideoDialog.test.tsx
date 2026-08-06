/**
 * Tests for AddVideoDialog's branded poster frame section.
 * Issue #140 (B1.1, B1.3-B1.5, B2.2, B4.1-B4.3, B5.2, B5.3, B5.6, B7.1)
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AddVideoDialog } from './AddVideoDialog'
import type { AddVideoDialogProps, PosterFrameDialogState } from './AddVideoDialog'

const BACKGROUNDS = ['/backgrounds/wbs-blue.jpg', '/backgrounds/wbs-red.png']

function posterFrameState(
  overrides: Partial<PosterFrameDialogState> = {}
): PosterFrameDialogState {
  return {
    available: true,
    unavailableReason: null,
    enabled: false,
    onEnabledChange: vi.fn(),
    backgrounds: BACKGROUNDS,
    selectedBackground: BACKGROUNDS[0],
    onBackgroundChange: vi.fn(),
    text: 'Managing Change',
    onTextChange: vi.fn(),
    previewImageUrl: 'blob:preview',
    saveCopy: false,
    onSaveCopyChange: vi.fn(),
    status: 'idle',
    error: null,
    onRetry: vi.fn(),
    ...overrides
  }
}

function baseProps(overrides: Partial<AddVideoDialogProps> = {}): AddVideoDialogProps {
  return {
    dialog: { isOpen: true, onOpenChange: vi.fn(), canAddVideo: true },
    mode: { addMode: 'upload', onTabChange: vi.fn() },
    form: {
      formData: {
        url: '',
        title: 'WBS - MSc - Managing Change',
        thumbnailUrl: '',
        sproutVideoId: ''
      },
      onFormFieldChange: vi.fn()
    },
    urlMode: {
      onFetchDetails: vi.fn(),
      onAddVideo: vi.fn(),
      isFetchingVideo: false,
      hasApiKey: true,
      fetchError: null
    },
    uploadMode: {
      selectedFile: '/renders/WBS_intro.mp4',
      uploading: false,
      progress: 0,
      message: null,
      uploadSuccess: false,
      onSelectFile: vi.fn(),
      onUploadAndAdd: vi.fn()
    },
    errors: { validationErrors: [], addError: null },
    posterFrame: posterFrameState(),
    posterFrameCanvasRef: React.createRef<HTMLCanvasElement>(),
    ...overrides
  }
}

describe('AddVideoDialog - poster frame option', () => {
  it('b1_1_offers_an_unticked_poster_frame_checkbox_with_no_controls', () => {
    render(<AddVideoDialog {...baseProps()} />)

    const checkbox = screen.getByRole('checkbox', {
      name: /create branded poster frame/i
    })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toBeEnabled()
    expect(screen.queryByLabelText(/poster frame text/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /poster frame preview/i })
    ).not.toBeInTheDocument()
  })

  it('b1_1_hides_the_poster_frame_option_on_the_url_tab', () => {
    render(
      <AddVideoDialog
        {...baseProps({ mode: { addMode: 'url', onTabChange: vi.fn() } })}
      />
    )

    expect(
      screen.queryByRole('checkbox', { name: /create branded poster frame/i })
    ).not.toBeInTheDocument()
  })

  it('b1_3_disables_the_option_and_explains_a_missing_font', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({
            available: false,
            unavailableReason:
              'Poster frame text requires Cabrito.otf in ~/Library/Fonts.'
          })
        })}
      />
    )

    expect(
      screen.getByRole('checkbox', { name: /create branded poster frame/i })
    ).toBeDisabled()
    expect(screen.getByText(/requires Cabrito\.otf/i)).toBeInTheDocument()
  })

  it('b1_4_disables_the_option_and_points_at_settings', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({
            available: false,
            unavailableReason:
              'No default background folder configured. Set one in Settings.'
          })
        })}
      />
    )

    expect(
      screen.getByRole('checkbox', { name: /create branded poster frame/i })
    ).toBeDisabled()
    expect(screen.getByText(/Set one in Settings/i)).toBeInTheDocument()
  })

  it('b1_5_disables_the_option_when_the_folder_has_no_images', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({
            available: false,
            unavailableReason: 'The background folder contains no image files.',
            backgrounds: []
          })
        })}
      />
    )

    expect(
      screen.getByRole('checkbox', { name: /create branded poster frame/i })
    ).toBeDisabled()
    expect(screen.getByText(/no image files/i)).toBeInTheDocument()
  })

  it('reports the tick back to the caller', () => {
    const onEnabledChange = vi.fn()
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ onEnabledChange }) })}
      />
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: /create branded poster frame/i })
    )

    expect(onEnabledChange).toHaveBeenCalledWith(true)
  })
})

describe('AddVideoDialog - poster frame controls', () => {
  it('b4_1_shows_the_preview_text_field_and_background_when_ticked', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true }) })}
      />
    )

    expect(screen.getByRole('img', { name: /poster frame preview/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/poster frame text/i)).toHaveValue('Managing Change')
  })

  it('b2_2_shows_the_selected_background_filename', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true }) })}
      />
    )

    expect(screen.getByText('wbs-blue.jpg')).toBeInTheDocument()
  })

  it('b4_2_reports_text_edits_back_to_the_caller', () => {
    const onTextChange = vi.fn()
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({ enabled: true, onTextChange })
        })}
      />
    )

    fireEvent.change(screen.getByLabelText(/poster frame text/i), {
      target: { value: 'Change, Managed' }
    })

    expect(onTextChange).toHaveBeenCalledWith('Change, Managed')
  })

  it('b4_3_removes_the_controls_when_unticked', () => {
    const { rerender } = render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true }) })}
      />
    )
    expect(screen.getByRole('img', { name: /poster frame preview/i })).toBeInTheDocument()

    rerender(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: false }) })}
      />
    )

    expect(
      screen.queryByRole('img', { name: /poster frame preview/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/poster frame text/i)).not.toBeInTheDocument()
  })

  it('b7_1_offers_the_save_a_copy_tick_reflecting_the_remembered_choice', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({ enabled: true, saveCopy: true })
        })}
      />
    )

    expect(
      screen.getByRole('checkbox', { name: /save a copy .*graphics/i })
    ).toBeChecked()
  })

  it('b7_1_hides_the_save_a_copy_tick_when_the_option_is_off', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: false }) })}
      />
    )

    expect(
      screen.queryByRole('checkbox', { name: /save a copy .*graphics/i })
    ).not.toBeInTheDocument()
  })
})

describe('AddVideoDialog - poster frame status', () => {
  it('b5_2_shows_a_status_line_and_withholds_finish_while_working', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          uploadMode: {
            ...baseProps().uploadMode,
            uploadSuccess: true
          },
          posterFrame: posterFrameState({ enabled: true, status: 'working' })
        })}
      />
    )

    expect(screen.getByText(/setting poster frame/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finish/i })).not.toBeInTheDocument()
  })

  it('b5_2_disables_cancel_while_the_poster_frame_is_in_flight', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({ enabled: true, status: 'working' })
        })}
      />
    )

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('b5_3_offers_finish_once_the_poster_frame_succeeds', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          uploadMode: { ...baseProps().uploadMode, uploadSuccess: true },
          posterFrame: posterFrameState({ enabled: true, status: 'success' })
        })}
      />
    )

    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.getByText(/poster frame set/i)).toBeInTheDocument()
  })

  it('b5_6_reports_a_failure_with_a_retry_action_and_still_allows_finish', () => {
    const onRetry = vi.fn()
    render(
      <AddVideoDialog
        {...baseProps({
          uploadMode: { ...baseProps().uploadMode, uploadSuccess: true },
          posterFrame: posterFrameState({
            enabled: true,
            status: 'error',
            error: 'Poster frame is 793 KB — Sprout Video allows up to 500 KB.',
            onRetry
          })
        })}
      />
    )

    expect(screen.getByText(/793 KB/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry poster frame/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('b5_3_leaves_the_existing_finish_behaviour_alone_when_the_option_is_off', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          uploadMode: { ...baseProps().uploadMode, uploadSuccess: true },
          posterFrame: posterFrameState({ enabled: false })
        })}
      />
    )

    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.queryByText(/setting poster frame/i)).not.toBeInTheDocument()
  })
})
