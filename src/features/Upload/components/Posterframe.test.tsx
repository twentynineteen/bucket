/**
 * Tests for the Posterframe page - saying which folder is in use, and why it
 * cannot be used.
 * Issue #166 (B4.1, B4.2, B5.1-B5.6)
 *
 * The page previously gated the whole background picker on files.length > 0 and
 * never printed the folder, so a dead configured path looked identical to a
 * first-run app.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Posterframe from './Posterframe'
import { useBackgroundFolder } from '../hooks/useBackgroundFolder'
import { useFileSelection } from '../hooks/useFileSelection'
import { usePosterframeTemplate } from '../hooks/usePosterframeTemplate'
import { PosterFrameTooLargeError, exportCanvasJpegUnder } from '../internal/posterFrame'
import {
  fetchSproutVideoDetails,
  openFolderDialog,
  saveFile,
  setSproutPosterFrame
} from '../api'
import { toast } from 'sonner'

vi.mock('../hooks/useBackgroundFolder', () => ({ useBackgroundFolder: vi.fn() }))
vi.mock('../hooks/useFileSelection', () => ({ useFileSelection: vi.fn() }))
vi.mock('../hooks/usePosterframeTemplate', () => ({ usePosterframeTemplate: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// The JPEG pipeline touches canvas.toBlob, which jsdom does not implement;
// the page's routing through the SHARED pipeline is what is under test (#189
// B5.4), not the encoding itself.
vi.mock('../internal/posterFrame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../internal/posterFrame')>()
  return { ...actual, exportCanvasJpegUnder: vi.fn() }
})

// Canvas work cannot run in jsdom; the page's rendering decisions are what
// these tests are about. Mutable so individual tests can hand the page a
// "ready" canvas or an off-aspect background.
const canvasHook = vi.hoisted(() => ({
  canvasRef: { current: null as HTMLCanvasElement | null },
  draw: vi.fn().mockResolvedValue(undefined),
  fontStatus: 'available',
  offAspect: false
}))
vi.mock('../hooks/usePosterframeCanvas', () => ({
  usePosterframeCanvas: () => canvasHook
}))
vi.mock('../hooks/usePosterframeAutoRedraw', () => ({
  usePosterframeAutoRedraw: vi.fn()
}))
vi.mock('../hooks/useAutoFileSelection', () => ({ useAutoFileSelection: vi.fn() }))
vi.mock('../hooks/useZoomPan', () => ({
  useZoomPan: () => ({
    zoomLevel: 1,
    pan: { x: 0, y: 0 },
    setZoomLevel: vi.fn(),
    setPan: vi.fn()
  })
}))
vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  return {
    ...actual,
    useBreadcrumb: vi.fn(),
    // The Sprout upload panel needs a key to be usable; the key itself is
    // React Query-backed I/O, which is exactly what belongs behind a mock.
    useSproutVideoApiKey: vi.fn(() => ({
      apiKey: 'sprout-key',
      isLoading: false,
      error: null
    }))
  }
})
vi.mock('../api', () => ({
  openFolder: vi.fn(),
  openFolderDialog: vi.fn(),
  saveFile: vi.fn(),
  fetchSproutVideoDetails: vi.fn(),
  setSproutPosterFrame: vi.fn()
}))

const DEFAULT_FOLDER = '/backgrounds/wbs'
const SESSION_FOLDER = '/Volumes/Media/bgs'

type FolderState = Partial<ReturnType<typeof useBackgroundFolder>>

function folderState(overrides: FolderState = {}) {
  return {
    files: [],
    status: 'ready',
    reason: null,
    folderInUse: DEFAULT_FOLDER,
    defaultFolder: DEFAULT_FOLDER,
    isSessionOverride: false,
    isLoading: false,
    loadFolder: vi.fn(),
    useDefaultFolder: vi.fn(),
    ...overrides
  } as ReturnType<typeof useBackgroundFolder>
}

function selectionState(selectedFilePath: string | null = null) {
  return {
    selectedFilePath,
    selectedFileBlob: selectedFilePath ? 'blob:preview' : null,
    selectFile: vi.fn(),
    clearSelection: vi.fn()
  } as unknown as ReturnType<typeof useFileSelection>
}

function templateState(
  template: 'classic' | 'rebrand' = 'classic',
  setTemplate = vi.fn()
) {
  return { template, setTemplate } as ReturnType<typeof usePosterframeTemplate>
}

function renderPage(
  state: FolderState = {},
  selected: string | null = null,
  template: 'classic' | 'rebrand' = 'classic'
) {
  vi.mocked(useBackgroundFolder).mockReturnValue(folderState(state))
  vi.mocked(useFileSelection).mockReturnValue(selectionState(selected))
  vi.mocked(usePosterframeTemplate).mockReturnValue(templateState(template))
  return render(<Posterframe />)
}

describe('Posterframe page - background folder diagnostics (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('b5_1_displays_the_folder_currently_in_use', () => {
    renderPage({ status: 'ready', files: ['/backgrounds/wbs/a.jpg'] })

    expect(screen.getByText(DEFAULT_FOLDER)).toBeInTheDocument()
  })

  it('b5_2_warns_with_the_path_and_keeps_the_picker_available', () => {
    renderPage({
      status: 'cannot-read',
      reason: `Cannot read background folder: ${DEFAULT_FOLDER}`
    })

    expect(
      screen.getByText(`Cannot read background folder: ${DEFAULT_FOLDER}`)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /select background folder/i })
    ).toBeEnabled()
  })

  it('b5_3_explains_a_folder_with_no_images', () => {
    renderPage({
      status: 'empty',
      reason: 'The background folder contains no image files.'
    })

    expect(screen.getByText(/contains no image files/i)).toBeInTheDocument()
  })

  it('b5_4_explains_that_no_folder_is_configured', () => {
    renderPage({
      status: 'not-configured',
      reason: 'No default background folder configured. Set one in Settings.',
      folderInUse: null,
      defaultFolder: null
    })

    expect(screen.getByText(/set one in settings/i)).toBeInTheDocument()
  })

  it('b5_5_explains_that_settings_could_not_be_read', () => {
    renderPage({
      status: 'settings-error',
      reason: 'Could not read your settings, so the background folder is unknown.',
      folderInUse: null,
      defaultFolder: null
    })

    expect(screen.getByText(/could not read your settings/i)).toBeInTheDocument()
  })

  it('b5_6_shows_no_warning_while_the_listing_is_still_in_flight', () => {
    renderPage({ status: 'loading', reason: null, isLoading: true })

    expect(screen.queryByText(/cannot read background folder/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/contains no image files/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/set one in settings/i)).not.toBeInTheDocument()
  })

  it('b3_2_labels_a_session_override_alongside_the_default', () => {
    renderPage({
      status: 'ready',
      files: ['/Volumes/Media/bgs/a.jpg'],
      folderInUse: SESSION_FOLDER,
      isSessionOverride: true
    })

    expect(screen.getByText(SESSION_FOLDER)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_FOLDER)).toBeInTheDocument()
  })

  it('b3_3_offers_a_reset_to_the_default_while_an_override_is_active', () => {
    renderPage({
      status: 'ready',
      files: ['/Volumes/Media/bgs/a.jpg'],
      folderInUse: SESSION_FOLDER,
      isSessionOverride: true
    })

    expect(screen.getByRole('button', { name: /use default/i })).toBeEnabled()
  })

  it('b3_4_offers_no_reset_when_no_override_is_active', () => {
    renderPage({ status: 'ready', files: ['/backgrounds/wbs/a.jpg'] })

    expect(screen.queryByRole('button', { name: /use default/i })).not.toBeInTheDocument()
  })

  it('b4_2_shows_an_empty_preview_and_disables_generate_without_a_selection', () => {
    renderPage({
      status: 'cannot-read',
      reason: `Cannot read background folder: ${DEFAULT_FOLDER}`
    })

    expect(screen.getByText(/select a background to preview/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate thumbnail/i })).toBeDisabled()
  })
})

describe('Posterframe page - selection coherence (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('b4_1_clears_a_selection_the_resolved_listing_no_longer_contains', () => {
    const clearSelection = vi.fn()
    vi.mocked(useBackgroundFolder).mockReturnValue(
      folderState({
        status: 'cannot-read',
        files: [],
        reason: `Cannot read background folder: ${DEFAULT_FOLDER}`
      })
    )
    vi.mocked(useFileSelection).mockReturnValue({
      ...selectionState('/backgrounds/wbs/gone.jpg'),
      clearSelection
    } as unknown as ReturnType<typeof useFileSelection>)
    vi.mocked(usePosterframeTemplate).mockReturnValue(templateState())

    render(<Posterframe />)

    // Rendering a preview from a folder the page is simultaneously warning it
    // cannot read is exactly the mixed message this issue exists to remove.
    expect(clearSelection).toHaveBeenCalled()
  })
})

describe('Posterframe page - rebrand template (#189)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canvasHook.canvasRef.current = null
    canvasHook.offAspect = false
    canvasHook.draw.mockResolvedValue(undefined)
  })

  it('b3_1_offers_the_template_choice', () => {
    renderPage({ status: 'ready', files: ['/backgrounds/wbs/a.jpg'] })

    expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument()
  })

  it('b3_1_choosing_a_template_reaches_the_shared_setter', async () => {
    // The full chain: open the Radix select, pick Rebrand, and the shared
    // setter is called. Asserting only the displayed value left the
    // onValueChange wiring unverified (review round, finding 9).
    const user = userEvent.setup()
    const setTemplate = vi.fn()
    vi.mocked(useBackgroundFolder).mockReturnValue(
      folderState({ status: 'ready', files: ['/backgrounds/wbs/a.jpg'] })
    )
    vi.mocked(useFileSelection).mockReturnValue(selectionState(null))
    vi.mocked(usePosterframeTemplate).mockReturnValue(
      templateState('classic', setTemplate)
    )
    render(<Posterframe />)

    await user.click(screen.getByRole('combobox', { name: /template/i }))
    await user.click(await screen.findByRole('option', { name: /rebrand/i }))

    expect(setTemplate).toHaveBeenCalledWith('rebrand')
  })

  it('b3_1_hands_the_selected_template_to_the_folder_hook', () => {
    renderPage(
      { status: 'ready', files: ['/backgrounds/rebrand/a.jpg'] },
      null,
      'rebrand'
    )

    expect(vi.mocked(useBackgroundFolder)).toHaveBeenCalledWith('rebrand')
    expect(screen.getByRole('combobox', { name: /template/i })).toHaveTextContent(
      /rebrand/i
    )
  })

  it('b4_2_warns_when_the_background_is_off_aspect', () => {
    canvasHook.offAspect = true

    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/odd.jpg'] },
      '/backgrounds/wbs/odd.jpg'
    )

    expect(screen.getByText(/16:9/)).toBeInTheDocument()
  })

  it('b4_2_shows_no_aspect_warning_for_a_16_9_background', () => {
    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )

    expect(screen.queryByText(/16:9/)).not.toBeInTheDocument()
  })

  it('b5_4_saves_through_the_shared_compression_pipeline', async () => {
    const user = userEvent.setup()
    const bytes = new Uint8Array([1, 2, 3])
    canvasHook.canvasRef.current = {} as HTMLCanvasElement
    vi.mocked(exportCanvasJpegUnder).mockResolvedValue(bytes)
    vi.mocked(openFolderDialog).mockResolvedValue('/exports')

    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )

    await user.type(screen.getByPlaceholderText(/enter video title/i), 'Managing Change')
    await user.click(screen.getByRole('button', { name: /choose save path/i }))
    await user.click(screen.getByRole('button', { name: /generate thumbnail/i }))

    await waitFor(() => expect(saveFile).toHaveBeenCalled())
    expect(exportCanvasJpegUnder).toHaveBeenCalled()
    expect(vi.mocked(saveFile).mock.calls[0][1]).toBe(bytes)
    // Uploading is additive: the local save must never reach Sprout (#142 B5.1)
    expect(setSproutPosterFrame).not.toHaveBeenCalled()
  })

  it('b5_3_writes_no_file_when_even_the_quality_floor_is_too_large', async () => {
    const user = userEvent.setup()
    canvasHook.canvasRef.current = {} as HTMLCanvasElement
    // The real error class, so this exercises the specific-message branch
    // rather than the generic fallback toast (review round, finding 7).
    vi.mocked(exportCanvasJpegUnder).mockRejectedValue(
      new PosterFrameTooLargeError(600 * 1024, 500 * 1024)
    )
    vi.mocked(openFolderDialog).mockResolvedValue('/exports')

    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )

    await user.type(screen.getByPlaceholderText(/enter video title/i), 'Managing Change')
    await user.click(screen.getByRole('button', { name: /choose save path/i }))
    await user.click(screen.getByRole('button', { name: /generate thumbnail/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    // The specific size/limit message reaches the user, not the generic
    // "could not render" fallback.
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/600 KB/)
    expect(saveFile).not.toHaveBeenCalled()
  })
})

describe('Posterframe page - upload to Sprout (#142)', () => {
  const VIDEO_URL = 'https://sproutvideo.com/videos/abc123'
  const DETAILS = {
    id: 'abc123',
    title: 'WBS - MSc - Managing Change',
    duration: 90,
    created_at: '2026-08-01T00:00:00Z',
    assets: { poster_frames: ['https://sproutvideo.com/poster.jpg'] }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    canvasHook.canvasRef.current = {} as HTMLCanvasElement
    canvasHook.fontStatus = 'available'
    canvasHook.offAspect = false
    canvasHook.draw.mockResolvedValue(undefined)
    vi.mocked(exportCanvasJpegUnder).mockResolvedValue(new Uint8Array([1, 2, 3]))
    vi.mocked(fetchSproutVideoDetails).mockResolvedValue(DETAILS)
    vi.mocked(setSproutPosterFrame).mockResolvedValue(undefined)
  })

  /** Renders the page with a usable background and resolves the target video */
  async function renderAndResolve(user: ReturnType<typeof userEvent.setup>) {
    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )
    await user.type(screen.getByLabelText(/sprout video url or id/i), VIDEO_URL)
    await user.click(screen.getByRole('button', { name: /fetch details/i }))
    await waitFor(() => expect(fetchSproutVideoDetails).toHaveBeenCalled())
  }

  it('b1_1_offers_a_video_reference_field_with_the_upload_held_back', () => {
    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )

    expect(screen.getByLabelText(/sprout video url or id/i)).toBeInTheDocument()
    // Nothing to look up and nothing to overwrite until a video is named.
    expect(screen.getByRole('button', { name: /fetch details/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /upload to sprout/i })).toBeDisabled()
  })

  it('b1_2_confirms_the_title_of_the_resolved_video', async () => {
    const user = userEvent.setup()

    await renderAndResolve(user)

    expect(fetchSproutVideoDetails).toHaveBeenCalledWith('abc123', 'sprout-key')
    expect(await screen.findByText('WBS - MSc - Managing Change')).toBeInTheDocument()
  })

  it('b1_9_prefills_an_empty_title_from_the_resolved_video', async () => {
    const user = userEvent.setup()

    await renderAndResolve(user)

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/enter video title/i)).toHaveValue(
        'Managing Change'
      )
    )
  })

  it('b1_9_leaves_a_title_the_user_typed_untouched', async () => {
    const user = userEvent.setup()
    renderPage(
      { status: 'ready', files: ['/backgrounds/wbs/a.jpg'] },
      '/backgrounds/wbs/a.jpg'
    )

    await user.type(screen.getByPlaceholderText(/enter video title/i), 'My own wording')
    await user.type(screen.getByLabelText(/sprout video url or id/i), VIDEO_URL)
    await user.click(screen.getByRole('button', { name: /fetch details/i }))
    await waitFor(() => expect(fetchSproutVideoDetails).toHaveBeenCalled())

    expect(screen.getByPlaceholderText(/enter video title/i)).toHaveValue(
      'My own wording'
    )
  })

  it('b2_1_holds_the_upload_back_without_a_background', async () => {
    const user = userEvent.setup()
    renderPage({ status: 'ready', files: ['/backgrounds/wbs/a.jpg'] }, null)

    await user.type(screen.getByLabelText(/sprout video url or id/i), VIDEO_URL)
    await user.click(screen.getByRole('button', { name: /fetch details/i }))
    await waitFor(() => expect(fetchSproutVideoDetails).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: /upload to sprout/i })).toBeDisabled()
    expect(screen.getByText(/select a background image/i)).toBeInTheDocument()
  })

  it('b2_3_holds_the_upload_back_when_the_posterframe_font_is_missing', async () => {
    canvasHook.fontStatus = 'missing'
    const user = userEvent.setup()

    await renderAndResolve(user)

    expect(screen.getByRole('button', { name: /upload to sprout/i })).toBeDisabled()
    expect(screen.getByText(/Cabrito\.otf/)).toBeInTheDocument()
  })

  it('b3_1_confirms_against_the_resolved_title_before_sending_anything', async () => {
    const user = userEvent.setup()
    await renderAndResolve(user)

    await user.click(screen.getByRole('button', { name: /upload to sprout/i }))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('WBS - MSc - Managing Change')
    expect(setSproutPosterFrame).not.toHaveBeenCalled()
  })

  it('b3_2_sends_nothing_when_the_confirmation_is_cancelled', async () => {
    const user = userEvent.setup()
    await renderAndResolve(user)

    await user.click(screen.getByRole('button', { name: /upload to sprout/i }))
    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(setSproutPosterFrame).not.toHaveBeenCalled()
  })

  it('b3_3_sends_the_frame_once_the_overwrite_is_confirmed', async () => {
    const user = userEvent.setup()
    await renderAndResolve(user)

    await user.click(screen.getByRole('button', { name: /upload to sprout/i }))
    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: /replace poster frame/i }))

    await waitFor(() => expect(setSproutPosterFrame).toHaveBeenCalled())
    expect(vi.mocked(setSproutPosterFrame).mock.calls[0][0]).toBe('abc123')
    // B5.2: uploading writes nothing to disk
    expect(saveFile).not.toHaveBeenCalled()
  })
})
