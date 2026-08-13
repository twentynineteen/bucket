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
import { exportCanvasJpegUnder } from '../internal/posterFrame'
import { openFolderDialog, saveFile } from '../api'
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
  return { ...actual, useBreadcrumb: vi.fn() }
})
vi.mock('../api', () => ({
  openFolder: vi.fn(),
  openFolderDialog: vi.fn(),
  saveFile: vi.fn()
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

  it('b3_1_hands_the_selected_template_to_the_folder_hook', () => {
    renderPage({ status: 'ready', files: ['/backgrounds/rebrand/a.jpg'] }, null, 'rebrand')

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
  })

  it('b5_3_writes_no_file_when_even_the_quality_floor_is_too_large', async () => {
    const user = userEvent.setup()
    canvasHook.canvasRef.current = {} as HTMLCanvasElement
    vi.mocked(exportCanvasJpegUnder).mockRejectedValue(
      new Error('Poster frame is 600 KB even at the lowest quality')
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
    expect(saveFile).not.toHaveBeenCalled()
  })
})
