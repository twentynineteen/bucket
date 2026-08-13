/**
 * Tests for BackgroundsSection - flagging a saved folder that cannot be read.
 * Issue #166 (B7.1-B7.4)
 *
 * Settings is the one screen a user checks to answer "is this configured?".
 * Before this fix it answered "yes" for a path that returns os error 2.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '@shared/store'

import BackgroundsSection from './BackgroundsSection'
import * as api from '../api'

vi.mock('../api', () => ({
  openFolderPicker: vi.fn(),
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined),
  directoryExists: vi.fn()
}))

const FOLDER = '/backgrounds/wbs'

function renderSection(
  apiKeys = { defaultBackgroundFolder: FOLDER },
  settingsUnavailable = false
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BackgroundsSection apiKeys={apiKeys} settingsUnavailable={settingsUnavailable} />
    </QueryClientProvider>
  )
}

describe('BackgroundsSection - dead path warning (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ defaultBackgroundFolder: FOLDER })
  })

  it('b7_1_shows_the_path_with_no_warning_when_it_exists', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(true)

    renderSection()

    expect(await screen.findByText(FOLDER)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(/cannot read this folder/i)).not.toBeInTheDocument()
    )
  })

  it('b7_2_warns_beside_the_path_when_it_no_longer_exists', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    expect(await screen.findByText(FOLDER)).toBeInTheDocument()
    expect(await screen.findByText(/bucket cannot read this folder/i)).toBeInTheDocument()
  })

  it('b7_3_does_not_modify_or_clear_the_stored_value_when_it_warns', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    await screen.findByText(/cannot read this folder/i)
    expect(useAppStore.getState().defaultBackgroundFolder).toBe(FOLDER)
    expect(api.saveSettingsApiKeys).not.toHaveBeenCalled()
  })

  it('b7_4_still_allows_saving_a_path_that_does_not_exist', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    await screen.findByText(/cannot read this folder/i)
    // The folder may be on an unmounted volume; saving must not be blocked.
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })

  it('b8_4_disables_saving_while_the_settings_read_is_failing', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(true)

    // A file that failed to parse may still hold recoverable credentials, and
    // every section writes {...apiKeys, ...newKeys} over the {} fallback, so one
    // Save would overwrite them permanently.
    renderSection({ defaultBackgroundFolder: FOLDER }, true)

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})

describe('BackgroundsSection - two template folders (#189)', () => {
  const REBRAND_FOLDER = '/backgrounds/rebrand'

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      defaultBackgroundFolder: FOLDER,
      rebrandBackgroundFolder: REBRAND_FOLDER
    })
    vi.mocked(api.directoryExists).mockResolvedValue(true)
    vi.mocked(api.saveSettingsApiKeys).mockResolvedValue(undefined)
  })

  it('b2_2_shows_a_labelled_field_per_template', () => {
    renderSection()

    expect(screen.getByText(/classic background folder/i)).toBeInTheDocument()
    expect(screen.getByText(/rebrand background folder/i)).toBeInTheDocument()
    expect(screen.getByText(FOLDER)).toBeInTheDocument()
    expect(screen.getByText(REBRAND_FOLDER)).toBeInTheDocument()
  })

  it('b2_2_saving_preserves_the_other_folder_and_the_remaining_keys', async () => {
    const user = userEvent.setup()
    const picked = '/Volumes/Design/rebrand-backgrounds'
    vi.mocked(api.openFolderPicker).mockResolvedValue(picked)

    renderSection({
      defaultBackgroundFolder: FOLDER,
      sproutVideo: 'sprout-key'
    })

    await user.click(screen.getByRole('button', { name: /choose rebrand folder/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(api.saveSettingsApiKeys).toHaveBeenCalled())
    expect(api.saveSettingsApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        sproutVideo: 'sprout-key',
        defaultBackgroundFolder: FOLDER,
        rebrandBackgroundFolder: picked
      })
    )
  })

  it('b2_3_warns_against_the_rebrand_field_only_when_only_it_is_dead', async () => {
    vi.mocked(api.directoryExists).mockImplementation(
      async (path: string) => path !== REBRAND_FOLDER
    )

    renderSection()

    expect(await screen.findByText(/bucket cannot read this folder/i)).toBeInTheDocument()
    // One warning, not two: the classic folder is fine.
    expect(screen.getAllByText(/bucket cannot read this folder/i)).toHaveLength(1)
  })
})
