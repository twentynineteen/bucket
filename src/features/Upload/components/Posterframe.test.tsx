/**
 * Tests for the Posterframe page - saying which folder is in use, and why it
 * cannot be used.
 * Issue #166 (B4.1, B4.2, B5.1-B5.6)
 *
 * The page previously gated the whole background picker on files.length > 0 and
 * never printed the folder, so a dead configured path looked identical to a
 * first-run app.
 */

import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Posterframe from './Posterframe'
import { useBackgroundFolder } from '../hooks/useBackgroundFolder'
import { useFileSelection } from '../hooks/useFileSelection'

vi.mock('../hooks/useBackgroundFolder', () => ({ useBackgroundFolder: vi.fn() }))
vi.mock('../hooks/useFileSelection', () => ({ useFileSelection: vi.fn() }))

// Canvas work cannot run in jsdom; the page's rendering decisions are what
// these tests are about.
vi.mock('../hooks/usePosterframeCanvas', () => ({
  usePosterframeCanvas: () => ({
    canvasRef: { current: null },
    draw: vi.fn(),
    fontStatus: 'available'
  })
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

function renderPage(state: FolderState = {}, selected: string | null = null) {
  vi.mocked(useBackgroundFolder).mockReturnValue(folderState(state))
  vi.mocked(useFileSelection).mockReturnValue(selectionState(selected))
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

    render(<Posterframe />)

    // Rendering a preview from a folder the page is simultaneously warning it
    // cannot read is exactly the mixed message this issue exists to remove.
    expect(clearSelection).toHaveBeenCalled()
  })
})
