/**
 * Tests for BackgroundsSection - flagging a saved folder that no longer exists.
 * Issue #166 (B7.1-B7.4)
 *
 * Settings is the one screen a user checks to answer "is this configured?".
 * Before this fix it answered "yes" for a path that returns os error 2.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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
      expect(screen.queryByText(/no longer exists/i)).not.toBeInTheDocument()
    )
  })

  it('b7_2_warns_beside_the_path_when_it_no_longer_exists', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    expect(await screen.findByText(FOLDER)).toBeInTheDocument()
    expect(
      await screen.findByText(/this folder no longer exists on this machine/i)
    ).toBeInTheDocument()
  })

  it('b7_3_does_not_modify_or_clear_the_stored_value_when_it_warns', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    await screen.findByText(/no longer exists/i)
    expect(useAppStore.getState().defaultBackgroundFolder).toBe(FOLDER)
    expect(api.saveSettingsApiKeys).not.toHaveBeenCalled()
  })

  it('b7_4_still_allows_saving_a_path_that_does_not_exist', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection()

    await screen.findByText(/no longer exists/i)
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
