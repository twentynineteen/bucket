/**
 * Tests for useAutoFileSelection - keeping a file selected as the available
 * list changes.
 * Issue #189 (B3.8, amendment): switching template swaps the background
 * folder, and the preview must repopulate with the new folder's first image
 * rather than sitting empty until the user picks one by hand.
 */

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutoFileSelection } from './useAutoFileSelection'

const CLASSIC_FILES = ['/backgrounds/classic/a.jpg', '/backgrounds/classic/b.jpg']
const REBRAND_FILES = ['/backgrounds/rebrand/panel.jpg']

describe('useAutoFileSelection (#189 B3.8)', () => {
  const selectFile = vi.fn()

  beforeEach(() => {
    selectFile.mockClear()
  })

  function renderSelection(
    files: string[],
    selectedFilePath: string | null,
    criteria: Record<string, unknown> = { preferImage: true }
  ) {
    return renderHook(
      (props: { files: string[]; selectedFilePath: string | null }) =>
        useAutoFileSelection({
          files: props.files,
          selectedFilePath: props.selectedFilePath,
          selectFile,
          criteria
        }),
      { initialProps: { files, selectedFilePath } }
    )
  }

  it('selects_the_first_image_when_nothing_is_selected', () => {
    renderSelection(CLASSIC_FILES, null)

    expect(selectFile).toHaveBeenCalledWith(CLASSIC_FILES[0])
  })

  it('leaves_an_existing_selection_alone', () => {
    renderSelection(CLASSIC_FILES, CLASSIC_FILES[1])

    expect(selectFile).not.toHaveBeenCalled()
  })

  it('selects_nothing_from_an_empty_list', () => {
    renderSelection([], null)

    expect(selectFile).not.toHaveBeenCalled()
  })

  it('b3_8_reselects_when_the_folder_swaps_under_a_cleared_selection', () => {
    // The template-switch sequence: new folder listing arrives, the coherence
    // effect clears the stale selection, and the first image of the NEW
    // folder must then be selected. The old query-based implementation keyed
    // only on criteria, so the swap never re-ran selection and the preview
    // sat empty (field report on #189).
    const { rerender } = renderSelection(CLASSIC_FILES, CLASSIC_FILES[0])
    expect(selectFile).not.toHaveBeenCalled()

    rerender({ files: REBRAND_FILES, selectedFilePath: null })

    expect(selectFile).toHaveBeenCalledWith(REBRAND_FILES[0])
  })

  it('prefers_image_files_when_asked', () => {
    renderSelection(['/bg/clip.mp4', '/bg/frame.png'], null)

    expect(selectFile).toHaveBeenCalledWith('/bg/frame.png')
  })
})
