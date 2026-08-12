/**
 * Quality Control settings section (issue #180, B14)
 *
 * Mocks follow the shape BackgroundsSection.test.tsx already uses: `vi.fn()`
 * directly in the factory, driven through `vi.mocked(api.x)`. The config sets
 * `mockReset`, so implementations declared outside the factory and reached
 * through a wrapper get wiped between tests.
 *
 * The behaviour that matters most here is B14.3. Every settings section writes
 * `{...apiKeys, ...newKeys}`, so saving while the settings file is unreadable
 * would overwrite a merely-unparseable file and destroy the credentials still in
 * it — the defect #166 B8.4 already fixed for the other sections.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import QualityControlSection from './QualityControlSection'
import * as api from '../api'

vi.mock('../api', () => ({
  openFolderPicker: vi.fn(),
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined),
  directoryExists: vi.fn()
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }))

vi.mock('@features/QualityControl', () => ({ useQcAvailability: vi.fn() }))

const READY_AVAILABILITY = {
  available: true,
  reason: null,
  pending: false,
  referenceFolder: null,
  pools: {
    watermarks: { status: 'ready', reason: null },
    stings: { status: 'ready', reason: null }
  },
  poolFiles: { watermarks: [], stings: [] }
}

/** Existing credentials a save must never drop. */
const EXISTING_KEYS = { sproutVideo: 'sprout-secret', trello: 'trello-key' }

const FOLDER = '/Volumes/Brand/QC references'

function renderSection(apiKeys: object = EXISTING_KEYS, settingsUnavailable = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <QualityControlSection
        apiKeys={apiKeys}
        settingsUnavailable={settingsUnavailable}
      />
    </QueryClientProvider>
  )
}

/**
 * Waits for the folder-present query to settle before interacting.
 *
 * Without this, the query resolving after mount re-renders the buttons and the
 * first click is swallowed — a jsdom/userEvent artifact rather than a product
 * bug, since a real browser does not lose a click mid-repaint. Waiting on the
 * folder text alone is not enough: that renders straight from props and says
 * nothing about whether the query has resolved.
 */
async function settleFolderCheck() {
  await waitFor(() => expect(api.directoryExists).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve, 50))
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(api.directoryExists).mockResolvedValue(true)
  vi.mocked(api.saveSettingsApiKeys).mockResolvedValue(undefined)
  const qc = await import('@features/QualityControl')
  vi.mocked(qc.useQcAvailability).mockReturnValue(READY_AVAILABILITY as never)
})

describe('QualityControlSection', () => {
  it('B14.1 offers a reference folder picker when nothing is configured', () => {
    renderSection()

    expect(
      screen.getByRole('button', { name: /choose reference folder/i })
    ).toBeInTheDocument()
    expect(screen.queryByText(FOLDER)).not.toBeInTheDocument()
  })

  it('B14.2 saves the reference folder without dropping existing keys', async () => {
    const user = userEvent.setup()
    renderSection({ ...EXISTING_KEYS, qcReferenceFolder: FOLDER })

    await settleFolderCheck()
    await user.click(screen.getByRole('button', { name: /^save reference folder$/i }))

    await waitFor(() => expect(api.saveSettingsApiKeys).toHaveBeenCalled())
    // The whole object is rewritten on save, so anything missing here is
    // destroyed on disk.
    expect(api.saveSettingsApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        sproutVideo: 'sprout-secret',
        trello: 'trello-key',
        qcReferenceFolder: FOLDER
      })
    )
  })

  it('B14.2 shows the folder the picker returned', async () => {
    vi.mocked(api.openFolderPicker).mockResolvedValue(FOLDER)
    const user = userEvent.setup()
    renderSection()

    await user.click(screen.getByRole('button', { name: /choose reference folder/i }))

    expect(await screen.findByText(FOLDER)).toBeInTheDocument()
  })

  it('B14.3 refuses to save while the settings file is unreadable', () => {
    renderSection({ ...EXISTING_KEYS, qcReferenceFolder: FOLDER }, true)

    // Saving here would write the empty fallback over a file that is merely
    // unparseable, taking the Sprout and Trello credentials with it.
    expect(
      screen.getByRole('button', { name: /^save reference folder$/i })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /^save ffmpeg folder$/i })).toBeDisabled()
    expect(api.saveSettingsApiKeys).not.toHaveBeenCalled()
  })

  it('B14.4 warns when the configured reference folder cannot be read', async () => {
    vi.mocked(api.directoryExists).mockResolvedValue(false)

    renderSection({ ...EXISTING_KEYS, qcReferenceFolder: '/Volumes/Gone/refs' })

    // Worded for absent-or-unreadable: a TCC denial makes the probe fail without
    // the folder having moved, so asserting absence would misattribute it.
    expect(await screen.findByText(/cannot read this folder/i)).toBeInTheDocument()
  })

  it('B14.4 shows no warning when the folder is present', async () => {
    renderSection({ ...EXISTING_KEYS, qcReferenceFolder: FOLDER })

    expect(await screen.findByText(FOLDER)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(/cannot read this folder/i)).not.toBeInTheDocument()
    )
  })

  it('B14.5 surfaces the live ffmpeg detection reason', async () => {
    const qc = await import('@features/QualityControl')
    vi.mocked(qc.useQcAvailability).mockReturnValue({
      ...READY_AVAILABILITY,
      available: false,
      reason: 'Video QC needs ffprobe, which could not be found.'
    } as never)

    renderSection()

    // Settings is where someone comes to fix this, so the reason belongs here
    // and not only on the QC page.
    expect(screen.getByRole('alert')).toHaveTextContent(/ffprobe/)
  })

  it('B14.5 says nothing about prerequisites while the checks are in flight', async () => {
    const qc = await import('@features/QualityControl')
    vi.mocked(qc.useQcAvailability).mockReturnValue({
      ...READY_AVAILABILITY,
      available: false,
      reason: null,
      pending: true
    } as never)

    renderSection()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/ready to run/i)).not.toBeInTheDocument()
  })

  it('B14.6 reports a failed save rather than showing a false success', async () => {
    vi.mocked(api.saveSettingsApiKeys).mockRejectedValue(new Error('disk full'))
    const user = userEvent.setup()
    renderSection({ ...EXISTING_KEYS, qcReferenceFolder: FOLDER })

    await settleFolderCheck()
    await user.click(screen.getByRole('button', { name: /^save reference folder$/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
  })

  it('B14.7 saves an ffmpeg directory override independently', async () => {
    const user = userEvent.setup()
    renderSection({ ...EXISTING_KEYS, ffmpegDirectory: '/custom/tools' })

    await user.click(screen.getByRole('button', { name: /^save ffmpeg folder$/i }))

    await waitFor(() => expect(api.saveSettingsApiKeys).toHaveBeenCalled())
    expect(api.saveSettingsApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({ ffmpegDirectory: '/custom/tools' })
    )
  })

  it('B13.2 saves a valid match confidence override', async () => {
    const user = userEvent.setup()
    renderSection(EXISTING_KEYS)

    await user.type(screen.getByLabelText(/watermark match confidence/i), '0.35')
    await user.click(screen.getByRole('button', { name: /^save threshold$/i }))

    await waitFor(() => expect(api.saveSettingsApiKeys).toHaveBeenCalled())
    expect(api.saveSettingsApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({ qcMatchThreshold: 0.35 })
    )
  })

  it('B13.3 refuses to save an out-of-range override rather than clamping it', async () => {
    const user = userEvent.setup()
    renderSection(EXISTING_KEYS)

    await user.type(screen.getByLabelText(/watermark match confidence/i), '1.5')

    // Rejected, and visibly so. Silently storing 0.999 would leave someone
    // believing they had set something they had not.
    expect(screen.getByRole('alert')).toHaveTextContent(/rejected rather than adjusted/i)
    expect(screen.getByRole('button', { name: /^save threshold$/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^save threshold$/i }))
    expect(api.saveSettingsApiKeys).not.toHaveBeenCalled()
  })

  it('B13.1 clears the override back to the default when the field is emptied', async () => {
    const user = userEvent.setup()
    renderSection({ ...EXISTING_KEYS, qcMatchThreshold: 0.35 })

    await user.clear(screen.getByLabelText(/watermark match confidence/i))
    await user.click(screen.getByRole('button', { name: /^save threshold$/i }))

    await waitFor(() => expect(api.saveSettingsApiKeys).toHaveBeenCalled())
    // Undefined rather than 0, which would be an override meaning "pass everything".
    expect(api.saveSettingsApiKeys).toHaveBeenCalledWith(
      expect.objectContaining({ qcMatchThreshold: undefined })
    )
  })
})
