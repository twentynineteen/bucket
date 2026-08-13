/**
 * Tests for AddVideoDialog's branded poster frame section.
 * Issue #140 (B1.1, B1.3-B1.5, B2.2, B4.1-B4.3, B5.2, B5.3, B5.6, B7.1)
 */

import { fireEvent, render as baseRender, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AddVideoDialog } from './AddVideoDialog'
import type { AddVideoDialogProps, PosterFrameDialogState } from './AddVideoDialog'

import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@tests/utils/queryClientWrapper'

/**
 * AddVideoDialog now renders SproutFolderPicker, which reads folder levels
 * through React Query (issue #155). Every render needs a client in scope.
 */
const render: typeof baseRender = (ui, options) =>
  baseRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    ),
    ...options
  })

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
    template: 'classic',
    onTemplateChange: vi.fn(),
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

// Issue #141 amendment: a blank poster frame is never sent to Sprout, in the
// upload flow as well as the card action (B7.1-B7.3).
describe('AddVideoDialog - poster frame text is required (B7)', () => {
  it('b7_1_blocks_the_upload_when_the_option_is_ticked_and_the_text_is_blank', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true, text: '' }) })}
      />
    )

    expect(screen.getByRole('button', { name: /upload and add/i })).toBeDisabled()
    expect(screen.getByText(/poster frame text is required/i)).toBeInTheDocument()
  })

  it('b7_3_treats_whitespace_only_text_as_blank', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true, text: '   ' }) })}
      />
    )

    expect(screen.getByRole('button', { name: /upload and add/i })).toBeDisabled()
    expect(screen.getByText(/poster frame text is required/i)).toBeInTheDocument()
  })

  it('b7_1_allows_the_upload_once_there_is_real_text', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: true }) })}
      />
    )

    expect(screen.getByRole('button', { name: /upload and add/i })).toBeEnabled()
    expect(screen.queryByText(/poster frame text is required/i)).not.toBeInTheDocument()
  })

  it('b7_2_does_not_block_the_upload_when_the_option_is_unticked', () => {
    render(
      <AddVideoDialog
        {...baseProps({ posterFrame: posterFrameState({ enabled: false, text: '' }) })}
      />
    )

    expect(screen.getByRole('button', { name: /upload and add/i })).toBeEnabled()
    expect(screen.queryByText(/poster frame text is required/i)).not.toBeInTheDocument()
  })
})

// ==========================================================================
// UPLOAD-02 — upload message severity comes from the event, not the text.
//
// Every message below deliberately contains neither "failed" nor "success":
// that is the whole regression. `message.includes('failed')` renders a hard
// failure as a neutral notice.
// ==========================================================================
type UploadMessage = {
  text: string
  severity: 'error' | 'success' | 'info'
}

/**
 * Casts through the current `string | null` prop type. Once the message shape
 * lands in @features/Upload this cast disappears.
 */
const messageProps = (message: UploadMessage) =>
  baseProps({
    uploadMode: {
      ...baseProps().uploadMode,
      uploading: false,
      message: message as unknown as string
    }
  })

const DESTRUCTIVE_CLASSES = ['border-red-500/50', 'text-red-600']

describe('AddVideoDialog - upload message severity (UPLOAD-02)', () => {
  it('renders an HTTP 413 rejection with the destructive alert variant', () => {
    const text = 'Sprout rejected the upload: HTTP 413 — <html>'

    expect(text.toLowerCase()).not.toContain('failed')
    expect(text.toLowerCase()).not.toContain('success')

    render(<AddVideoDialog {...messageProps({ text, severity: 'error' })} />)

    const alert = screen.getByRole('alert')
    for (const cls of DESTRUCTIVE_CLASSES) {
      expect(alert.className).toContain(cls)
    }
    expect(alert).toHaveTextContent(text)
  })

  it('renders a non-JSON body rejection with the destructive alert variant', () => {
    const text = 'Sprout returned HTTP 200 but the response body was not valid JSON (…)'

    expect(text.toLowerCase()).not.toContain('failed')

    render(<AddVideoDialog {...messageProps({ text, severity: 'error' })} />)

    const alert = screen.getByRole('alert')
    for (const cls of DESTRUCTIVE_CLASSES) {
      expect(alert.className).toContain(cls)
    }
    expect(alert).toHaveTextContent(text)
  })

  it('does not use the destructive variant for a success message', () => {
    const text = 'Upload complete — the video is now on Sprout'

    render(<AddVideoDialog {...messageProps({ text, severity: 'success' })} />)

    const alert = screen.getByRole('alert')
    for (const cls of DESTRUCTIVE_CLASSES) {
      expect(alert.className).not.toContain(cls)
    }
    expect(alert).toHaveTextContent(text)
  })

  it('never renders the message as [object Object]', () => {
    const text = 'Sprout rejected the upload: HTTP 413 — <html>'

    render(<AddVideoDialog {...messageProps({ text, severity: 'error' })} />)

    expect(screen.getByRole('alert')).not.toHaveTextContent('[object Object]')
  })
})

describe('AddVideoDialog - poster frame template (#189)', () => {
  it('b3_2_offers_the_template_choice_once_the_option_is_enabled', () => {
    render(
      <AddVideoDialog
        {...baseProps({
          posterFrame: posterFrameState({ enabled: true, template: 'rebrand' })
        })}
      />
    )

    expect(screen.getByRole('combobox', { name: /template/i })).toHaveTextContent(
      /rebrand/i
    )
  })

  it('b3_2_shows_no_template_choice_while_the_option_is_off', () => {
    render(
      <AddVideoDialog {...baseProps({ posterFrame: posterFrameState({ enabled: false }) })} />
    )

    expect(
      screen.queryByRole('combobox', { name: /template/i })
    ).not.toBeInTheDocument()
  })
})
