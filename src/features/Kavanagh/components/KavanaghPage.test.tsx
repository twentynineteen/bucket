/**
 * Kavanagh page (issue #180, B8, B10, B13)
 *
 * Only the I/O boundary is mocked - `api.ts`, which owns every Tauri call, and the
 * availability hook, which owns the prerequisite ones. Everything the assertions
 * touch is the real component and the real run hook, so a broken page fails these
 * tests rather than a mock reporting itself present.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseKavanaghAvailabilityResult } from '../hooks/useKavanaghAvailability'
import type {
  KavanaghCheckReport,
  KavanaghProgressEvent,
  KavanaghStingReport,
  KavanaghTailAnalysis,
  KavanaghWatermarkReport
} from '../types'

const mockAvailability = vi.fn<() => UseKavanaghAvailabilityResult>()

vi.mock('../hooks/useKavanaghAvailability', () => ({
  useKavanaghAvailability: () => mockAvailability()
}))

// The single I/O boundary. Mocking it and nothing else is what keeps the real page,
// the real run hook and the real report rendering under test.
const runKavanaghCheck = vi.fn()
const cancelKavanaghRun = vi.fn()
const saveKavanaghEvidence = vi.fn()
const pickVideoFile = vi.fn()
const pickEvidenceFolder = vi.fn()
let emitProgress: ((event: KavanaghProgressEvent) => void) | null = null

vi.mock('../api', () => ({
  runKavanaghCheck: (...args: unknown[]) => runKavanaghCheck(...args),
  cancelKavanaghRun: () => cancelKavanaghRun(),
  saveKavanaghEvidence: (...args: unknown[]) => saveKavanaghEvidence(...args),
  pickVideoFile: () => pickVideoFile(),
  pickEvidenceFolder: () => pickEvidenceFolder(),
  listenKavanaghProgress: (
    callback: (event: { payload: KavanaghProgressEvent }) => void
  ) => {
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
  useApiKeys: () => ({ data: { kavanaghMatchThreshold: undefined }, isPending: false })
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) }
}))

import KavanaghPage from './KavanaghPage'

const READY: UseKavanaghAvailabilityResult = {
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

const PASSING_WATERMARK: KavanaghWatermarkReport = {
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
  notes: []
}

const SOUND_TAIL: KavanaghTailAnalysis = {
  peakAtSeconds: 139.0,
  rampSeconds: 0.4,
  stingSeconds: 5.0,
  trailingSeconds: 0.04,
  problems: []
}

const MATCHED_STING: KavanaghStingReport = {
  outcome: 'matched',
  matchedReference: 'WBS_Sting_2024.jpg',
  bestReference: 'WBS_Sting_2024.jpg',
  bestConfidence: 0.9989,
  freezeMad: 0.0,
  framesCompared: 9,
  threshold: 0.95
}

const FAILING_WATERMARK: KavanaghWatermarkReport = {
  ...PASSING_WATERMARK,
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

const PASSING_REPORT: KavanaghCheckReport = {
  verdict: 'pass',
  watermark: PASSING_WATERMARK,
  tail: SOUND_TAIL,
  sting: MATCHED_STING,
  problemMessages: [],
  notes: []
}

const FAILING_REPORT: KavanaghCheckReport = {
  ...PASSING_REPORT,
  verdict: 'fail',
  watermark: FAILING_WATERMARK,
  problemMessages: []
}

/** A report whose watermark half differs, the rest held steady. */
function withWatermark(
  base: KavanaghCheckReport,
  overrides: Partial<KavanaghWatermarkReport>
): KavanaghCheckReport {
  return { ...base, watermark: { ...base.watermark, ...overrides } }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return render(
    <QueryClientProvider client={client}>
      <KavanaghPage />
    </QueryClientProvider>
  )
}

describe('KavanaghPage prerequisites', () => {
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

describe('KavanaghPage watermark run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAvailability.mockReturnValue(READY)
    pickVideoFile.mockResolvedValue('/Volumes/Renders/module.mp4')
  })

  it('B8.1 shows progress with its phase, then renders the report', async () => {
    let settle: (report: KavanaghWatermarkReport) => void = () => {}
    runKavanaghCheck.mockImplementation(
      () => new Promise<KavanaghWatermarkReport>((resolve) => (settle = resolve))
    )

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() => expect(runKavanaghCheck).toHaveBeenCalled())
    // The first argument only: React Query hands a mutation context along as a
    // second one, which is not part of the request.
    expect(runKavanaghCheck.mock.calls[0][0]).toMatchObject({
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
      expect(screen.getByText(/present throughout, top-right/i)).toBeInTheDocument()
    )
    expect(
      screen.getByText(/WBS_Watermark_BlackRight\.png/, { exact: false })
    ).toBeInTheDocument()
  })

  it('B8.6 disables a second start while a run is in flight', async () => {
    runKavanaghCheck.mockImplementation(() => new Promise<KavanaghCheckReport>(() => {}))

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run quality control/i })).toBeDisabled()
    )
    expect(runKavanaghCheck).toHaveBeenCalledTimes(1)
  })

  it('B8.6 surfaces the backend rejection when a run is already in flight', async () => {
    // The page's own guard can be bypassed - a second page, or a run started from
    // the upload flow in stage 4 - so the backend's rejection has to be shown.
    runKavanaghCheck.mockRejectedValue({
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
    runKavanaghCheck.mockImplementation(
      () => new Promise<KavanaghWatermarkReport>((_, r) => (reject = r))
    )
    cancelKavanaghRun.mockResolvedValue(true)

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(cancelKavanaghRun).toHaveBeenCalled()

    reject({ kind: 'cancelled', message: 'The quality control run was cancelled.' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /run quality control/i })).toBeEnabled()
    )
    // Cancelling is not a fault. Showing it as one reads as a bug in the app.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it('B11.3 shows ffmpeg stderr rather than a generic failure', async () => {
    runKavanaghCheck.mockRejectedValue({
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
    runKavanaghCheck.mockRejectedValue({
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

  it('B7.4 shows a run that could not judge the video as an error, not a failure', async () => {
    // "Not judged" and "judged bad" send an operator to different places: one is
    // a file or toolchain to fix, the other is a render to re-export.
    runKavanaghCheck.mockRejectedValue({
      kind: 'probe',
      message: 'This file has no video stream, so there is nothing to check.'
    })

    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    // No verdict at all, rather than a verdict of "failed".
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/^failed\.$/i)).not.toBeInTheDocument()
  })
})

describe('KavanaghPage report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAvailability.mockReturnValue(READY)
    pickVideoFile.mockResolvedValue('/Volumes/Renders/module.mp4')
  })

  async function runWith(report: KavanaghCheckReport) {
    runKavanaghCheck.mockResolvedValue(report)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /choose video/i }))
    await userEvent.click(screen.getByRole('button', { name: /run quality control/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /^report$/i })).toBeInTheDocument()
    )
  }

  it('B4.2 reports a gap as a time range rather than one timestamp', async () => {
    await runWith(FAILING_REPORT)

    expect(screen.getByText(/missing for part of the render/i)).toBeInTheDocument()
    expect(screen.getByText(/4:12\.0 to 4:31\.0/)).toBeInTheDocument()
  })

  it('B7.1 leads with a pass covering both checks, not just the watermark', async () => {
    await runWith(PASSING_REPORT)

    expect(screen.getByRole('status')).toHaveTextContent(
      /passed\. the watermark and the closing sting are both correct/i
    )
  })

  it('B7.3 renders a warning as neither a pass nor a failure', async () => {
    // An unrecognised sting means the references folder needs a new variant.
    // Rendering it as a failure is how people learn to ignore failures (D8).
    await runWith({
      ...PASSING_REPORT,
      verdict: 'warning',
      sting: {
        ...MATCHED_STING,
        outcome: 'unrecognised',
        matchedReference: null,
        bestConfidence: 0.7869
      },
      problemMessages: [
        'The tail is a held still, but it matches nothing in the stings folder - closest was WBS_Sting_2024.jpg at 0.787, below 0.95. If this is a new sting, add it to the folder.'
      ]
    })

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/passed with a warning/i)
    expect(banner).not.toHaveTextContent(/^failed/i)
    expect(banner).toHaveTextContent(/matches nothing in the stings folder/i)
  })

  it('B7.2 shows what the tail measured even when the watermark is what failed', async () => {
    // Fixing one fault only to discover the next is the failure mode D9 exists
    // to avoid, so both halves are always on screen.
    await runWith(FAILING_REPORT)

    expect(screen.getByText(/missing for part of the render/i)).toBeInTheDocument()
    expect(screen.getByText(/peaks at 2:19\.0/)).toBeInTheDocument()
    expect(screen.getByText(/WBS_Sting_2024\.jpg/)).toBeInTheDocument()
  })

  it('shows the tail measurements a disputed verdict is argued with', async () => {
    // The tolerances are tight by design, so a verdict is only answerable next
    // to the numbers that produced it.
    await runWith(PASSING_REPORT)

    expect(screen.getByText(/over 0\.40s/)).toBeInTheDocument()
    expect(screen.getByText(/5\.00s/)).toBeInTheDocument()
    expect(screen.getByText(/9 frames, mean difference 0\.00/)).toBeInTheDocument()
  })

  it('names the fault the tail found, with the measurement behind it', async () => {
    await runWith({
      ...FAILING_REPORT,
      tail: { ...SOUND_TAIL, rampSeconds: 0.25 },
      problemMessages: [
        'The dip to white takes 0.25s, expected 0.40s (0.32-0.48s). A ramp this short is a hard cut rather than a dissolve.'
      ]
    })

    expect(screen.getByRole('status')).toHaveTextContent(/takes 0\.25s, expected 0\.40s/i)
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
    await runWith(
      withWatermark(FAILING_REPORT, {
        corner: null,
        matchedSamples: 0,
        matchedReference: null,
        bestReference: 'WBS_Watermark_BlackRight_4K.png',
        bestConfidence: 0.389,
        weakestConfidence: -0.1483
      })
    )

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
    await runWith(
      withWatermark(FAILING_REPORT, {
        gaps: [],
        cornerChanges: [{ atSeconds: 30, expected: 'topRight', found: 'topLeft' }]
      })
    )

    expect(screen.getByText(/expected top-right, found top-left/i)).toBeInTheDocument()
    expect(screen.getByText(/0:30\.0/, { exact: false })).toBeInTheDocument()
  })

  it('B5.10 states that the checked span was approximated when no dip was found', async () => {
    // Both faults are reported rather than one hiding the other (D9): the tail
    // says there is no dip, and the watermark result says its span was a guess.
    await runWith({
      ...FAILING_REPORT,
      tail: {
        peakAtSeconds: null,
        rampSeconds: null,
        stingSeconds: null,
        trailingSeconds: null,
        problems: [{ kind: 'noWhitePeak' }]
      },
      sting: null,
      problemMessages: ['No dip to white found in the closing section.'],
      notes: ['No dip to white was found, so the watermark was checked over the first…']
    })

    expect(screen.getByText(/no dip to white found/i)).toBeInTheDocument()
    expect(
      screen.getByText(/the span is approximate|checked over the first/i)
    ).toBeInTheDocument()
  })

  it('B13.2 says when a non-default threshold was applied', async () => {
    await runWith(
      withWatermark(PASSING_REPORT, { threshold: 0.92, thresholdIsDefault: false })
    )

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
    saveKavanaghEvidence.mockResolvedValue([
      '/Volumes/Evidence/kavanagh-module-watermark-missing.jpg'
    ])

    await runWith(FAILING_REPORT)
    await userEvent.click(screen.getByRole('button', { name: /save evidence/i }))

    await waitFor(() =>
      expect(saveKavanaghEvidence).toHaveBeenCalledWith(
        '/Volumes/Evidence',
        'kavanagh-module',
        FAILING_REPORT.watermark.thumbnails
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

    expect(saveKavanaghEvidence).not.toHaveBeenCalled()
  })

  it('reports a save that failed rather than claiming success', async () => {
    pickEvidenceFolder.mockResolvedValue('/Volumes/Gone')
    saveKavanaghEvidence.mockRejectedValue({
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
      expect(screen.queryByRole('heading', { name: /^report$/i })).not.toBeInTheDocument()
    )
  })
})
