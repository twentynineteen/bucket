/**
 * useRenderVideo tests (issue #335)
 *
 * Mocks api.ts to verify the render pipeline orchestration.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FontData } from '../internal/frameRenderer'
import type { MotionFormat, MotionRenderProgress, ResolvedTemplate } from '../types'
import { useRenderVideo } from './useRenderVideo'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartRender =
  vi.fn<(req: MotionRenderProgress & Record<string, unknown>) => Promise<string>>()
const mockSendRenderFrame = vi.fn<(id: string, png: Uint8Array) => Promise<void>>()
const mockFinishRender = vi.fn<(id: string) => Promise<string>>()
const mockCancelRender = vi.fn<(id: string) => Promise<void>>()
const mockOnRenderProgress =
  vi.fn<(cb: (p: MotionRenderProgress) => void) => Promise<() => void>>()

vi.mock('../api', () => ({
  startRender: (...args: unknown[]) =>
    mockStartRender(...(args as Parameters<typeof mockStartRender>)),
  sendRenderFrame: (...args: unknown[]) =>
    mockSendRenderFrame(...(args as Parameters<typeof mockSendRenderFrame>)),
  finishRender: (...args: unknown[]) =>
    mockFinishRender(...(args as Parameters<typeof mockFinishRender>)),
  cancelRender: (...args: unknown[]) =>
    mockCancelRender(...(args as Parameters<typeof mockCancelRender>)),
  onRenderProgress: (...args: unknown[]) =>
    mockOnRenderProgress(...(args as Parameters<typeof mockOnRenderProgress>))
}))

const mockBuildFrameList = vi.fn<(d: number, fps: number) => number[]>()
const mockRenderFrameToPng =
  vi.fn<
    (
      rt: ResolvedTemplate,
      t: number,
      f: MotionFormat,
      fd: FontData[]
    ) => Promise<Uint8Array>
  >()

vi.mock('../internal/frameRenderer', () => ({
  buildFrameList: (...args: unknown[]) =>
    mockBuildFrameList(...(args as Parameters<typeof mockBuildFrameList>)),
  renderFrameToPng: (...args: unknown[]) =>
    mockRenderFrameToPng(...(args as Parameters<typeof mockRenderFrameToPng>))
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeResolved(): ResolvedTemplate {
  return {
    id: 'test',
    name: 'Test',
    description: 'Test',
    category: 'lower-third',
    status: 'stable',
    fonts: ['CabritoSemi-NorBol'],
    duration: 0.12, // 3 frames at 25fps
    inEnd: 0.04,
    outStart: 0.08,
    hasHold: false,
    layers: [],
    originalTemplate: {
      schemaVersion: 1,
      id: 'test',
      version: '1.0.0',
      name: 'Test',
      description: 'Test',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 0.12,
      inEnd: 0.04,
      outStart: 0.08,
      params: {},
      layers: []
    },
    values: {}
  }
}

const FORMAT: MotionFormat = { width: 1920, height: 1080, fps: 25 }
const FONT_DATA: FontData[] = [
  { family: 'Cabrito Semi', bytes: new Uint8Array([0x4f, 0x54]) }
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockBuildFrameList.mockReturnValue([0, 0.04, 0.08]) // 3 frames
  mockRenderFrameToPng.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  mockStartRender.mockResolvedValue('render-123')
  mockSendRenderFrame.mockResolvedValue(undefined)
  mockFinishRender.mockResolvedValue('/output/test.mov')
  mockCancelRender.mockResolvedValue(undefined)

  mockOnRenderProgress.mockImplementation(async () => {
    return () => {
      // Cleanup
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRenderVideo', () => {
  // P6.1: render pipeline orchestration with ffmpegDirectory
  it('p6_1_calls_start_send_finish_with_ffmpeg_directory', async () => {
    const { result } = renderHook(() => useRenderVideo())

    expect(result.current.state).toBe('idle')

    let renderPromise: Promise<string | null>
    await act(async () => {
      renderPromise = result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: '/custom/ffmpeg'
      })
    })

    // Wait for the render to complete
    let outputPath: string | null = null
    await act(async () => {
      outputPath = await renderPromise!
    })

    // startRender called once with ffmpegDirectory
    expect(mockStartRender).toHaveBeenCalledTimes(1)
    const startArgs = mockStartRender.mock.calls[0][0]
    expect(startArgs.ffmpegDirectory).toBe('/custom/ffmpeg')
    expect(startArgs.width).toBe(1920)
    expect(startArgs.height).toBe(1080)
    expect(startArgs.fps).toBe(25)

    // sendRenderFrame called 3 times in order
    expect(mockSendRenderFrame).toHaveBeenCalledTimes(3)
    expect(mockSendRenderFrame.mock.calls[0][0]).toBe('render-123')
    expect(mockSendRenderFrame.mock.calls[1][0]).toBe('render-123')
    expect(mockSendRenderFrame.mock.calls[2][0]).toBe('render-123')

    // finishRender called once
    expect(mockFinishRender).toHaveBeenCalledTimes(1)
    expect(mockFinishRender.mock.calls[0][0]).toBe('render-123')

    expect(outputPath).toBe('/output/test.mov')
  })

  it('p6_1_passes_null_ffmpeg_directory_when_unset', async () => {
    const { result } = renderHook(() => useRenderVideo())

    await act(async () => {
      await result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    expect(mockStartRender.mock.calls[0][0].ffmpegDirectory).toBeNull()
  })

  // P6.2: progress events
  it('p6_2_exposes_progress_from_render_events', async () => {
    let progressCb: ((p: MotionRenderProgress) => void) | null = null
    mockOnRenderProgress.mockImplementation(async cb => {
      progressCb = cb
      return () => {
        progressCb = null
      }
    })

    // Block sendRenderFrame on the first call so we can fire progress mid-render
    let resolveFirstFrame: () => void
    const firstFramePromise = new Promise<void>(r => {
      resolveFirstFrame = r
    })
    mockSendRenderFrame
      .mockImplementationOnce(() => firstFramePromise)
      .mockResolvedValue(undefined)

    const { result } = renderHook(() => useRenderVideo())

    // Start render without awaiting (it will block on the first frame)
    let renderPromise: Promise<string | null> | undefined
    act(() => {
      renderPromise = result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    // Let the microtask queue settle so startRender has been called
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    // Simulate progress event for our render id
    await act(async () => {
      progressCb?.({
        renderId: 'render-123',
        framesWritten: 1,
        totalFrames: 3
      })
    })

    expect(result.current.progress).toBeCloseTo(1 / 3)

    // Events from a different render id should be ignored
    await act(async () => {
      progressCb?.({
        renderId: 'other-render',
        framesWritten: 99,
        totalFrames: 100
      })
    })

    expect(result.current.progress).toBeCloseTo(1 / 3)

    // Unblock the first frame and let the render finish
    await act(async () => {
      resolveFirstFrame!()
      await renderPromise
    })
  })

  // P6.3: cancel support
  it('p6_3_cancel_stops_render', async () => {
    // Block sendRenderFrame on the first call
    let resolveFirstFrame: () => void
    const firstFramePromise = new Promise<void>(r => {
      resolveFirstFrame = r
    })
    mockSendRenderFrame.mockImplementationOnce(() => firstFramePromise)

    const { result } = renderHook(() => useRenderVideo())

    // Start render without awaiting
    let renderPromise: Promise<string | null> | undefined
    act(() => {
      renderPromise = result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    // Let microtasks settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    // Cancel while first frame is pending
    await act(async () => {
      result.current.cancel()
    })

    // cancelRender should have been called
    expect(mockCancelRender).toHaveBeenCalledWith('render-123')

    // State should be cancelled
    expect(result.current.state).toBe('cancelled')

    // Resolve pending frame so promise settles
    await act(async () => {
      resolveFirstFrame!()
      await renderPromise
    })

    // Only 1 frame was in flight when cancel was called (the first sendRenderFrame)
    expect(mockSendRenderFrame).toHaveBeenCalledTimes(1)
  })

  // S7: JS failure after startRender must call cancelRender
  it('s7_render_frame_rejection_calls_cancel_render', async () => {
    mockRenderFrameToPng
      .mockResolvedValueOnce(new Uint8Array([0x89])) // frame 0 OK
      .mockRejectedValueOnce(new Error('SVG render failed')) // frame 1 fails

    const { result } = renderHook(() => useRenderVideo())

    await act(async () => {
      try {
        await result.current.render({
          resolved: makeResolved(),
          format: FORMAT,
          outputPath: '/output/test.mov',
          fonts: FONT_DATA,
          ffmpegDirectory: null
        })
      } catch {
        // Expected - render now throws on error so the caller can surface it
      }
    })

    // cancelRender must be called to clean up the ffmpeg process
    expect(mockCancelRender).toHaveBeenCalledWith('render-123')
  })

  // S7: cancel before startRender resolves must still cancel
  it('s7_cancel_before_start_render_resolves_still_cancels', async () => {
    let resolveStart: (id: string) => void
    const startPromise = new Promise<string>(r => {
      resolveStart = r
    })
    mockStartRender.mockReturnValue(startPromise)

    const { result } = renderHook(() => useRenderVideo())

    // Start the render (startRender is pending)
    let renderPromise: Promise<string | null> | undefined
    act(() => {
      renderPromise = result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    // Cancel while startRender is still pending
    await act(async () => {
      result.current.cancel()
    })

    // Now resolve startRender - the render ID becomes available
    await act(async () => {
      resolveStart!('render-456')
      await renderPromise
    })

    // cancelRender should have been called with the new render id
    expect(mockCancelRender).toHaveBeenCalledWith('render-456')
  })

  // P6.4: error handling - render now throws on error so the caller
  // can surface it (S1 requires toast.error in the export hook).
  it('p6_4_encode_error_stops_render', async () => {
    mockSendRenderFrame
      .mockResolvedValueOnce(undefined) // frame 0 OK
      .mockRejectedValueOnce({ kind: 'encodeFailed' }) // frame 1 fails

    const { result } = renderHook(() => useRenderVideo())

    await act(async () => {
      try {
        await result.current.render({
          resolved: makeResolved(),
          format: FORMAT,
          outputPath: '/output/test.mov',
          fonts: FONT_DATA,
          ffmpegDirectory: null
        })
      } catch {
        // Expected - render now throws on error
      }
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toContain('encodeFailed')

    // No further frames after the error
    expect(mockSendRenderFrame).toHaveBeenCalledTimes(2) // frame 0 + frame 1 (failed)
    expect(mockFinishRender).not.toHaveBeenCalled()

    // S7: cancelRender must be called to clean up the ffmpeg process
    expect(mockCancelRender).toHaveBeenCalledWith('render-123')
  })

  // Sk9: Rust errors carry { kind, message } - prefer the message field
  it('sk9_rust_error_message_reaches_hook_error_state', async () => {
    mockSendRenderFrame.mockRejectedValueOnce({
      kind: 'encodeFailed',
      message: 'ffmpeg exited with code 1: ...stderr tail'
    })

    const { result } = renderHook(() => useRenderVideo())

    await act(async () => {
      try {
        await result.current.render({
          resolved: makeResolved(),
          format: FORMAT,
          outputPath: '/output/test.mov',
          fonts: FONT_DATA,
          ffmpegDirectory: null
        })
      } catch {
        // Expected
      }
    })

    expect(result.current.state).toBe('error')
    // Must contain the human-readable message, not just the error kind
    expect(result.current.error).toContain('ffmpeg exited with code 1')
  })

  // Sk9: cancel() wraps the fire-and-forget cancelRender in safeCancelRender
  it('sk9_cancel_uses_safe_cancel_to_swallow_rejection', async () => {
    // Make cancelRender reject (e.g. unknownRender after the registry took it)
    mockCancelRender.mockRejectedValue({ kind: 'unknownRender', message: 'not found' })

    // Block sendRenderFrame so we can cancel mid-render
    let resolveFrame: () => void
    const framePromise = new Promise<void>(r => {
      resolveFrame = r
    })
    mockSendRenderFrame.mockImplementationOnce(() => framePromise)

    const { result } = renderHook(() => useRenderVideo())

    let renderPromise: Promise<string | null> | undefined
    act(() => {
      renderPromise = result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    // Cancel - this fires a void cancelRender that rejects
    // The test will fail with an unhandled rejection if it's not caught
    await act(async () => {
      result.current.cancel()
    })

    await act(async () => {
      resolveFrame!()
      await renderPromise
    })

    // If we get here without an unhandled rejection, the test passes
    expect(mockCancelRender).toHaveBeenCalled()
  })

  // Sk9: cancel that arrives after the last frame is sent treats render
  // as "finishing" rather than reporting it as cancelled
  it('sk9_late_cancel_after_finish_does_not_report_cancelled', async () => {
    const { result } = renderHook(() => useRenderVideo())

    // Complete a full render
    await act(async () => {
      await result.current.render({
        resolved: makeResolved(),
        format: FORMAT,
        outputPath: '/output/test.mov',
        fonts: FONT_DATA,
        ffmpegDirectory: null
      })
    })

    expect(result.current.state).toBe('done')

    // Now cancel after the render has already finished
    await act(async () => {
      result.current.cancel()
    })

    // State should remain 'done', not flip to 'cancelled'
    expect(result.current.state).toBe('done')
  })
})
