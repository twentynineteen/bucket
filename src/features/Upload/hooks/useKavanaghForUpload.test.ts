/**
 * Kavanagh gating for the Sprout upload flow (issue #180, stage 4, B9)
 *
 * The behaviour under test is a policy, not a calculation: what may go to
 * Sprout, and what has to be confirmed first. Only the Kavanagh module is
 * mocked - the run hook and the availability hook - so the preference, the
 * gate's decisions and the block state are the real thing.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KavanaghCheckReport } from '@features/Kavanagh'

const run = vi.fn()
const resetRun = vi.fn()
let runningState = false
let reportState: KavanaghCheckReport | null = null
let availabilityState = {
  available: true,
  reason: null as string | null,
  poolFiles: {
    watermarks: ['/refs/Watermarks/right.png'],
    stings: ['/refs/Stings/current.jpg']
  }
}

vi.mock('@features/Kavanagh', () => ({
  useKavanaghCheck: () => ({
    isRunning: runningState,
    report: reportState,
    run,
    reset: resetRun,
    progress: null,
    error: null,
    cancel: vi.fn()
  }),
  useKavanaghAvailability: () => availabilityState
}))

vi.mock('@shared/hooks', () => ({
  useApiKeys: () => ({
    data: { ffmpegDirectory: '/opt/homebrew/bin', kavanaghMatchThreshold: undefined }
  })
}))

vi.mock('@shared/utils', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}))

const { useKavanaghForUpload } = await import('./useKavanaghForUpload')

const PASSING: KavanaghCheckReport = {
  verdict: 'pass',
  watermark: {
    outcome: 'pass',
    corner: 'topRight',
    span: { startSeconds: 0, endSeconds: 139, approximated: false },
    gaps: [],
    cornerChanges: [],
    coarseSamples: 70,
    matchedSamples: 70,
    bestConfidence: 0.9973,
    weakestConfidence: 0.9803,
    bestReference: 'right.png',
    matchedReference: 'right.png',
    threshold: 0.85,
    thresholdIsDefault: true,
    referencesUsed: 2,
    video: { width: 3840, height: 2160, durationSeconds: 144 },
    thumbnails: [],
    notes: []
  },
  tail: {
    peakAtSeconds: 139,
    rampSeconds: 0.4,
    stingSeconds: 5,
    trailingSeconds: 0,
    problems: []
  },
  sting: {
    outcome: 'matched',
    matchedReference: 'current.jpg',
    bestReference: 'current.jpg',
    bestConfidence: 0.9989,
    freezeMad: 0,
    framesCompared: 9,
    threshold: 0.95
  },
  problemMessages: [],
  notes: []
}

const FAILING: KavanaghCheckReport = {
  ...PASSING,
  verdict: 'fail',
  watermark: { ...PASSING.watermark, outcome: 'fail' },
  problemMessages: ['The watermark is missing from 4:12 to 4:31.']
}

const WARNING: KavanaghCheckReport = {
  ...PASSING,
  verdict: 'warning',
  sting: { ...PASSING.sting!, outcome: 'unrecognised', matchedReference: null },
  problemMessages: ['The tail is a held still, but it matches nothing in the folder.']
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  runningState = false
  reportState = null
  availabilityState = {
    available: true,
    reason: null,
    poolFiles: {
      watermarks: ['/refs/Watermarks/right.png'],
      stings: ['/refs/Stings/current.jpg']
    }
  }
})

describe('Kavanagh upload preference', () => {
  it('B9.1 is off when the preference has never been set', () => {
    const { result } = renderHook(() => useKavanaghForUpload())

    expect(result.current.enabled).toBe(false)
  })

  it('B9.8 remembers the choice across a reload', async () => {
    const first = renderHook(() => useKavanaghForUpload())
    act(() => first.result.current.setEnabled(true))
    await waitFor(() => expect(first.result.current.enabled).toBe(true))

    // A second mount is what a reload looks like from here.
    const second = renderHook(() => useKavanaghForUpload())

    expect(second.result.current.enabled).toBe(true)
  })

  it('does not turn itself on for a stored value that merely looks truthy', () => {
    localStorage.setItem(
      'kavanagh-upload-preferences',
      JSON.stringify({ enabled: 'yes' })
    )

    const { result } = renderHook(() => useKavanaghForUpload())

    expect(result.current.enabled).toBe(false)
  })

  it('stays off rather than throwing when the stored preference is corrupt', () => {
    localStorage.setItem('kavanagh-upload-preferences', 'not json')

    const { result } = renderHook(() => useKavanaghForUpload())

    expect(result.current.enabled).toBe(false)
  })
})

describe('Kavanagh upload gating', () => {
  it('B9.7 spawns nothing at all when the check is switched off', async () => {
    const { result } = renderHook(() => useKavanaghForUpload())

    let proceed = false
    await act(async () => {
      proceed = await result.current.gate('/Volumes/Renders/module.mp4')
    })

    expect(proceed).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })

  it('B9.2 lets a passing render upload without interruption', async () => {
    run.mockResolvedValue(PASSING)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))

    let proceed = false
    await act(async () => {
      proceed = await result.current.gate('/Volumes/Renders/module.mp4')
    })

    expect(proceed).toBe(true)
    expect(result.current.block).toBeNull()
    // Both pools travel with the request, or the sting could not be identified.
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        videoPath: '/Volumes/Renders/module.mp4',
        referenceFiles: ['/refs/Watermarks/right.png'],
        stingReferenceFiles: ['/refs/Stings/current.jpg']
      })
    )
  })

  it('B9.3 blocks a failing render before anything reaches Sprout', async () => {
    run.mockResolvedValue(FAILING)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))

    let proceed = true
    await act(async () => {
      proceed = await result.current.gate('/Volumes/Renders/module.mp4')
    })

    expect(proceed).toBe(false)
    expect(result.current.block?.report).toEqual(FAILING)
  })

  it('B9.6 lets a warning through without an override', async () => {
    // An unrecognised sting is the references folder being out of date, not a
    // broken render. Blocking here would train people to click through (D8).
    run.mockResolvedValue(WARNING)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))

    let proceed = false
    await act(async () => {
      proceed = await result.current.gate('/Volumes/Renders/module.mp4')
    })

    expect(proceed).toBe(true)
    expect(result.current.block).toBeNull()
  })

  it('B9.4 clears the block when the operator overrides it', async () => {
    run.mockResolvedValue(FAILING)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))
    await act(async () => {
      await result.current.gate('/a.mp4')
    })

    act(() => result.current.override())

    expect(result.current.block).toBeNull()
  })

  it('B9.5 clears the block when the operator dismisses it', async () => {
    run.mockResolvedValue(FAILING)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))
    await act(async () => {
      await result.current.gate('/a.mp4')
    })

    act(() => result.current.dismiss())

    expect(result.current.block).toBeNull()
  })

  it('blocks rather than waving through a render it could not check', async () => {
    // Beyond B9, which does not say. The operator asked for a check; uploading
    // unchecked without saying so is the one outcome nobody chose.
    run.mockResolvedValue(null)
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))

    let proceed = true
    await act(async () => {
      proceed = await result.current.gate('/a.mp4')
    })

    expect(proceed).toBe(false)
    expect(result.current.block?.error?.message).toMatch(/could not be checked/i)
  })

  it('blocks when the check is switched on but cannot run', async () => {
    availabilityState = {
      available: false,
      reason: 'Kavanagh needs ffprobe, which could not be found.',
      poolFiles: { watermarks: [], stings: [] }
    }
    const { result } = renderHook(() => useKavanaghForUpload())
    act(() => result.current.setEnabled(true))

    let proceed = true
    await act(async () => {
      proceed = await result.current.gate('/a.mp4')
    })

    expect(proceed).toBe(false)
    expect(result.current.block?.error?.message).toMatch(/ffprobe/i)
    expect(run).not.toHaveBeenCalled()
  })
})
