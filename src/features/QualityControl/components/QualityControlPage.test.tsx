/**
 * Quality Control page (issue #180, B8, B10, B13)
 *
 * Only the I/O boundary is mocked — `api.ts`, which owns every Tauri call, and the
 * availability hook, which owns the prerequisite ones. Everything the assertions
 * touch is the real component and the real run hook, so a broken page fails these
 * tests rather than a mock reporting itself present.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseQcAvailabilityResult } from '../hooks/useQcAvailability'
import type { QcProgressEvent, QcWatermarkReport } from '../types'

const mockAvailability = vi.fn<() => UseQcAvailabilityResult>()

vi.mock('../hooks/useQcAvailability', () => ({
  useQcAvailability: () => mockAvailability()
}))

// The single I/O boundary. Mocking it and nothing else is what keeps the real page,
// the real run hook and the real report rendering under test.
const runWatermarkCheck = vi.fn()
const cancelQcRun = vi.fn()
const saveQcEvidence = vi.fn()
const pickVideoFile = vi.fn()
const pickEvidenceFolder = vi.fn()
let emitProgress: ((event: QcProgressEvent) => void) | null = null

vi.mock('../api', () => ({
  runWatermarkCheck: (...args: unknown[]) => runWatermarkCheck(...args),
  cancelQcRun: () => cancelQcRun(),
  saveQcEvidence: (...args: unknown[]) => saveQcEvidence(...args),
  pickVideoFile: () => pickVideoFile(),
  pickEvidenceFolder: () => pickEvidenceFolder(),
  listenQcProgress: (callback: (event: { payload: QcProgressEvent }) => void) => {
    emitProgress = (payload) => callback({ payload })
    return Promise.resolve(() => {
      emitProgress = null
    })
  }
}))

// Spread the real module: Button reaches for useReducedMotion from here too, and
// replacing the whole module wholesale breaks every component that renders one.
vi.mock('@shared/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/hooks')>()),
  useBreadcrumb: vi.fn(),
  useApiKeys: () => ({ data: { qcMatchThreshold: undefined }, isPending: false })
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) }
}))

import QualityControlPage from './QualityControlPage'

const READY: UseQcAvailabilityResult = {
  available: true,
  reason: null,
  pending: false,
  referenceFolder: '/Volumes/Brand/QC references',
  pools: {
    watermarks: { status: 'ready', reason: null },
    stings: { status: 'ready', reason: null }
  },
  poolFiles: {
    watermarks: ['/Volumes/Brand/QC references/Watermarks/right.png'],
    stings: ['/Volumes/Brand/QC references/Stings/end.jpg']
  }
}

const PASSING_REPORT: QcWatermarkReport = {
  outcome: 'pass',
  corner: 'topRight',
  span: { startSeconds: 0, endSeconds: 132, approximated: true },
  gaps: [],
  cornerChanges: [],
  coarseSamples: 14,
  matchedSamples: 14,
  bestConfidence: 0.9828,
  weakestConfidence: 0.9826,
  bestReference: 'WBS_Watermark_BlackRight.png',
  matchedReference: 'WBS_Watermark_BlackRight.png',
  threshold: 0.85,
  thresholdIsDefault: true,
  referencesUsed: 4,
  video: { width: 3840, height: 2160, durationSeconds: 144 },
  thumbnails: [],
  notes: ['The dip to white has not been located, so the watermark was checked over…']
}

const FAILING_REPORT: QcWatermarkReport = {
  ...PASSING_REPORT,
  outcome: 'fail',
  gaps: [
    {
      startSeconds: 252,
      endSeconds: 271,
      bestConfidence: 0.0135,
      bestReference: 'WBS_Watermark_BlackRight.png'
    }
  ],
  matchedSamples: 12,
  thumbnails: [
    { label: 'watermark-missing-252.0s', atSeconds: 252, jpeg: [255, 216, 255, 217] }
  ],
  notes: []
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={client}>
      <QualityControlPage />
    </QueryClientProvider>
  )
}

describe('QualityControlPage prerequisites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAvailability.mockReturnValue(READY)
    pickVideoFile.mockResolvedValue('/Volumes/Renders/module.mp4')
  })

  it('B8.5 shows the specific reason and disables the run action when unavailable', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: 'Video QC needs ffprobe, which could not be found.'
    })

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(/ffprobe/)
    expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
  })

  it('B8.5 claims nothing while the prerequisite checks are in flight', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: null,
      pending: true
    })

    renderPage()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
  })

  it('B8.5 reports both pools, so a second fault is visible without fixing the first', () => {
    mockAvailability.mockReturnValue({
      ...READY,
      available: false,
      reason: 'The watermarks folder contains no reference images.',
      pools: {
        watermarks: {
          status: 'empty',
          reason: 'The watermarks folder contains no reference images.'
        },
        stings: {
          status: 'cannot-read',
          reason: 'Cannot read the stings folder: /Volumes/Brand/QC references/stings'
        }
      }
    })

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      /watermarks folder contains no reference images/i
    )
    expect(screen.getByText(/cannot read the stings folder/i)).toBeInTheDocument()
  })

  it('B8.1 will not start a run until a render has been chosen', () => {
    renderPage()

    // Every prerequisite is ready, but there is nothing to check yet.
    expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
  })
})

describe('QualityControlPage watermark run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAvailability.mockReturnValue(READY)
    pickVideoFile.mockResolvedValue('/Volumes/Renders/module.mp4')
  })

  it('B8.1 shows progress with its phase, then renders the report', async () => {
    let settle: (report: QcWatermarkReport) => void = () => {}
    runWatermarkCheck.mockImplementation(
      () => new Promise<QcWatermarkReport>((resolve) => (settle = resolve))
    )

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() => expect(runWatermarkCheck).toHaveBeenCalled())
    // The first argument only: React Query hands a mutation context along as a
    // second one, which is not part of the request.
    expect(runWatermarkCheck.mock.calls[0][0]).toMatchObject({
      videoPath: '/Volumes/Renders/module.mp4',
      referenceFiles: ['/Volumes/Brand/QC references/Watermarks/right.png']
    })

    emitProgress?.({
      operationId: 'op-1',
      phase: 'watermark',
      percentage: 42,
      detail: 'Checking the watermark'
    })

    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    )
    expect(screen.getByRole('status')).toHaveTextContent(/checking the watermark/i)

    settle(PASSING_REPORT)

    await waitFor(() =>
      expect(
        screen.getByText(/watermark present throughout, top-right/i)
      ).toBeInTheDocument()
    )
    expect(
      screen.getByText(/WBS_Watermark_BlackRight\.png/, { exact: false })
    ).toBeInTheDocument()
  })

  it('B8.6 disables a second start while a run is in flight', async () => {
    runWatermarkCheck.mockImplementation(() => new Promise<QcWatermarkReport>(() => {}))

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
    )
    expect(runWatermarkCheck).toHaveBeenCalledTimes(1)
  })

  it('B8.6 surfaces the backend rejection when a run is already in flight', async () => {
    // The page's own guard can be bypassed — a second page, or a run started from
    // the upload flow in stage 4 — so the backend's rejection has to be shown.
    runWatermarkCheck.mockRejectedValue({
      kind: 'busy',
      message: 'A quality control run is already in progress.'
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/already in progress/i)
    )
  })

  it('B8.2 cancels the run and returns the page to idle without showing a failure', async () => {
    let reject: (error: unknown) => void = () => {}
    runWatermarkCheck.mockImplementation(
      () => new Promise<QcWatermarkReport>((_, r) => (reject = r))
    )
    cancelQcRun.mockResolvedValue(true)

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(cancelQcRun).toHaveBeenCalled()

    reject({ kind: 'cancelled', message: 'The quality control run was cancelled.' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run quality control/i })).toBeEnabled()
    )
    // Cancelling is not a fault. Showing it as one reads as a bug in the app.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it('B11.3 shows ffmpeg stderr rather than a generic failure', async () => {
    runWatermarkCheck.mockRejectedValue({
      kind: 'ffmpeg',
      message: 'ffmpeg could not decode this video for the watermark check.',
      stderr: "Unknown decoder 'hevc'"
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not decode/i)
    )
    // Naming the codec is the whole point: "could not decode" tells nobody what to
    // install.
    expect(screen.getByText(/Unknown decoder 'hevc'/)).toBeInTheDocument()
  })

  it('B12.1 shows a probe failure as its own specific reason', async () => {
    runWatermarkCheck.mockRejectedValue({
      kind: 'probe',
      message: 'This file has no video stream, so there is nothing to check.'
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no video stream/i)
    )
  })
})

describe('QualityControlPage report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAvailability.mockReturnValue(READY)
    pickVideoFile.mockResolvedValue('/Volumes/Renders/module.mp4')
  })

  async function runWith(report: QcWatermarkReport) {
    runWatermarkCheck.mockResolvedValue(report)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))
    await waitFor(() => expect(screen.getByText(/watermark report/i)).toBeInTheDocument())
  }

  it('B4.2 reports a gap as a time range rather than one timestamp', async () => {
    await runWith(FAILING_REPORT)

    expect(screen.getByText(/watermark check failed/i)).toBeInTheDocument()
    expect(screen.getByText(/4:12\.0 to 4:31\.0/)).toBeInTheDocument()
  })

  it('shows the score range and threshold on a pass, not just a green tick', async () => {
    // Two real renders with equally visible watermarks score 0.983 and 0.389 through
    // the same code, so a bare pass or fail turns a threshold argument into an
    // unanswerable one.
    await runWith(PASSING_REPORT)

    expect(screen.getByText(/0\.9826 to 0\.9828/)).toBeInTheDocument()
    expect(screen.getByText(/threshold of 0\.850/)).toBeInTheDocument()
  })

  it('names the closest reference and its score when nothing matched at all', async () => {
    // How a wrong-resolution watermark is told apart from a missing one: one comes
    // close and names an asset, the other does not.
    await runWith({
      ...FAILING_REPORT,
      corner: null,
      matchedSamples: 0,
      matchedReference: null,
      bestReference: 'WBS_Watermark_BlackRight_4K.png',
      bestConfidence: 0.389,
      weakestConfidence: -0.1483
    })

    expect(
      screen.getByText(/closest reference WBS_Watermark_BlackRight_4K\.png/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/-0\.1483 to 0\.3890/)).toBeInTheDocument()
  })

  it('shows the best score inside each gap, so a near miss is visible', async () => {
    await runWith(FAILING_REPORT)

    expect(screen.getByText(/best score 0\.0135/)).toBeInTheDocument()
  })

  it('B3.7 names the corner change and when it happened', async () => {
    await runWith({
      ...FAILING_REPORT,
      gaps: [],
      cornerChanges: [{ atSeconds: 30, expected: 'topRight', found: 'topLeft' }]
    })

    expect(screen.getByText(/expected top-right, found top-left/i)).toBeInTheDocument()
    expect(screen.getByText(/0:30\.0/, { exact: false })).toBeInTheDocument()
  })

  it('B5.10 states that the checked span was approximated', async () => {
    await runWith(PASSING_REPORT)

    expect(screen.getByText(/dip to white has not been located/i)).toBeInTheDocument()
  })

  it('B13.2 says when a non-default threshold was applied', async () => {
    await runWith({
      ...PASSING_REPORT,
      threshold: 0.92,
      thresholdIsDefault: false
    })

    expect(screen.getByText(/0\.920 \(overridden\)/)).toBeInTheDocument()
  })

  it('B10.1 shows failure thumbnails and says nothing was written to disk', async () => {
    await runWith(FAILING_REPORT)

    expect(
      screen.getByRole('img', {
        name: /frame at 4:12\.0 where the watermark check failed/i
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/nothing is written to disk until you save it/i)
    ).toBeInTheDocument()
  })

  it('B8.4 shows no evidence at all for a passing run', async () => {
    await runWith(PASSING_REPORT)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /save evidence/i })
    ).not.toBeInTheDocument()
  })

  it('B10.2 writes the thumbnails to a folder the operator picks', async () => {
    pickEvidenceFolder.mockResolvedValue('/Volumes/Evidence')
    saveQcEvidence.mockResolvedValue([
      '/Volumes/Evidence/qc-module-watermark-missing.jpg'
    ])

    await runWith(FAILING_REPORT)
    await userEvent.click(screen.getByRole('button', { name: /save evidence/i }))

    await waitFor(() =>
      expect(saveQcEvidence).toHaveBeenCalledWith(
        '/Volumes/Evidence',
        'qc-module',
        FAILING_REPORT.thumbnails
      )
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('/Volumes/Evidence')
    )
  })

  it('B10.2 writes nothing when the folder picker is dismissed', async () => {
    pickEvidenceFolder.mockResolvedValue(null)

    await runWith(FAILING_REPORT)
    await userEvent.click(screen.getByRole('button', { name: /save evidence/i }))

    expect(saveQcEvidence).not.toHaveBeenCalled()
  })

  it('reports a save that failed rather than claiming success', async () => {
    pickEvidenceFolder.mockResolvedValue('/Volumes/Gone')
    saveQcEvidence.mockRejectedValue({
      kind: 'io',
      message: '/Volumes/Gone is not a folder that can be written to.'
    })

    await runWith(FAILING_REPORT)
    await userEvent.click(screen.getByRole('button', { name: /save evidence/i }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('/Volumes/Gone'))
    )
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('drops the previous report when a different render is chosen', async () => {
    // Leaving an old verdict on screen beside a new filename is how someone signs
    // off the wrong render.
    await runWith(FAILING_REPORT)

    pickVideoFile.mockResolvedValue('/Volumes/Renders/other.mp4')
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))

    await waitFor(() =>
      expect(screen.queryByText(/watermark report/i)).not.toBeInTheDocument()
    )
  })
})
