/**
 * Regression tests for usePosterframeCanvas.
 *
 * The two behaviours under test are the ones that produced the
 * "saved thumbnail has no text" report from a user on a fresh-cache machine:
 *
 * 1. `draw()` must `await` the Image's onload before resolving its returned
 *    promise. Previously `draw()` was `async` but registered `img.onload` as
 *    a callback, so `await draw(...)` resolved immediately. `Posterframe.tsx`
 *    then called `canvas.toBlob()` against a canvas that hadn't been painted
 *    yet.
 *
 * 2. `fontStatus` must transition to `'missing'` when `loadFont()` returns
 *    null, so the page component can surface the silent-failure path
 *    (Cabrito.otf not present on the user's machine) to the user.
 *
 * Moved here from tests/unit/hooks/ per the testing policy (colocated units),
 * updated for the template parameter (issue #189).
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { usePosterframeCanvas } from './usePosterframeCanvas'

vi.mock('../internal/loadFont', () => ({
  loadFont: vi.fn()
}))
import { loadFont } from '../internal/loadFont'

// ============================================================================
// Image + Canvas2D mocks
// ============================================================================

interface PendingImage {
  src: string
  fireOnload: () => void
  fireOnerror: (err?: Error) => void
}

let pendingImages: PendingImage[] = []
// Dimensions the next MockImage reports; tests needing a specific canvas size
// (e.g. the Classic reference resolution) set this before drawing.
let mockImageSize = { width: 1024, height: 768 }

function installImageMock() {
  // Replace the global Image constructor with a version that captures each
  // instance so the test can decide when (or whether) onload fires.
  class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = mockImageSize.width
    height = mockImageSize.height
    private _src = ''
    get src(): string {
      return this._src
    }
    set src(v: string) {
      this._src = v
      pendingImages.push({
        src: v,
        fireOnload: () => this.onload?.(),
        fireOnerror: () => this.onerror?.()
      })
    }
  }
  // @ts-expect-error - replacing the global Image in tests
  globalThis.Image = MockImage
}

function installCanvas2dStub(canvas: HTMLCanvasElement) {
  // jsdom returns null from getContext('2d'); the hook bails out without a
  // context. Provide just enough of the API the draw function uses so the
  // code path executes and we can observe its async behaviour.
  const ctx: Partial<CanvasRenderingContext2D> = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn()
  }
  // @ts-expect-error - returning a partial stub for the test
  canvas.getContext = vi.fn(() => ctx)
}

// ============================================================================
// Tests
// ============================================================================

describe('usePosterframeCanvas', () => {
  beforeEach(() => {
    pendingImages = []
    mockImageSize = { width: 1024, height: 768 }
    installImageMock()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('draw() promise does NOT resolve until the Image fires onload', async () => {
    // Font is irrelevant to the race; null skips the text branch and keeps
    // the test focused on image-load awaiting.
    vi.mocked(loadFont).mockResolvedValue(null)

    const { result } = renderHook(() => usePosterframeCanvas())
    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas

    let resolved = false
    const drawPromise = result.current.draw('/some-image.jpg', 'Title', 'classic')
    drawPromise.then(() => {
      resolved = true
    })

    // Microtask flush — promise must still be pending because onload hasn't
    // fired. This is the regression check: previous implementation would
    // already be resolved at this point.
    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false)
    expect(pendingImages).toHaveLength(1)
    expect(pendingImages[0].src).toBe('/some-image.jpg')

    // Fire onload — now draw should be able to finish.
    await act(async () => {
      pendingImages[0].fireOnload()
      await drawPromise
    })
    expect(resolved).toBe(true)
  })

  test('draw() rejects when image fails to load', async () => {
    vi.mocked(loadFont).mockResolvedValue(null)

    const { result } = renderHook(() => usePosterframeCanvas())
    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas

    const drawPromise = result.current.draw('/bad-image.jpg', 'Title', 'classic')
    // Catch upfront so an unhandled rejection doesn't bubble in the test.
    const caught = drawPromise.catch((e: Error) => e)

    pendingImages[0].fireOnerror()
    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('failed to load')
  })

  test("fontStatus transitions to 'missing' when loadFont returns null", async () => {
    vi.mocked(loadFont).mockResolvedValue(null)

    const { result } = renderHook(() => usePosterframeCanvas())
    expect(result.current.fontStatus).toBe('unknown')

    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas

    await act(async () => {
      const p = result.current.draw('/image.jpg', 'Title', 'classic')
      pendingImages[0].fireOnload()
      await p
    })

    expect(result.current.fontStatus).toBe('missing')
  })

  test("fontStatus transitions to 'loaded' when loadFont returns a font", async () => {
    // Minimal opentype.Font stub — stringToGlyphs, unitsPerEm and ascender
    // are all the layout pass touches.
    const fakeFont = {
      unitsPerEm: 1000,
      ascender: 800,
      stringToGlyphs: vi.fn(() => [])
    }
    // @ts-expect-error - partial Font stub is enough for the loaded branch
    vi.mocked(loadFont).mockResolvedValue(fakeFont)

    const { result } = renderHook(() => usePosterframeCanvas())
    expect(result.current.fontStatus).toBe('unknown')

    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas

    await act(async () => {
      const p = result.current.draw('/image.jpg', 'Title', 'classic')
      pendingImages[0].fireOnload()
      await p
    })

    expect(result.current.fontStatus).toBe('loaded')
  })

  test('reports a non-16:9 background through offAspect (#189 B4.2)', async () => {
    // The mock Image is 1024x768 - 4:3, comfortably outside the tolerance.
    vi.mocked(loadFont).mockResolvedValue(null)

    const { result } = renderHook(() => usePosterframeCanvas())
    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas

    expect(result.current.offAspect).toBe(false)

    await act(async () => {
      const p = result.current.draw('/image.jpg', '', 'classic')
      pendingImages[0].fireOnload()
      await p
    })

    expect(result.current.offAspect).toBe(true)
  })
})

describe('usePosterframeCanvas - classic paint geometry (#189 B4.1, B1.5)', () => {
  beforeEach(() => {
    pendingImages = []
    installImageMock()
    vi.clearAllMocks()
  })

  /**
   * A font whose every glyph advances 400 units at 1000/em with a recordable
   * getPath, so the paint coordinates are a pure function of the layout.
   * Glyph width at 37px classic = 400/1000*37 + 1.5 spacing = 16.3px.
   */
  function paintRecordingFont() {
    const getPathCalls: [number, number, number][] = []
    const font = {
      unitsPerEm: 1000,
      ascender: 800,
      stringToGlyphs: (text: string) =>
        Array.from(text, () => ({
          advanceWidth: 400,
          getPath: (x: number, y: number, size: number) => {
            getPathCalls.push([x, y, size])
            return { fill: null, stroke: null, draw: vi.fn() }
          }
        }))
    }
    return { font, getPathCalls }
  }

  async function drawClassic(title: string) {
    const { font, getPathCalls } = paintRecordingFont()
    // @ts-expect-error - partial Font stub is enough for the paint pass
    vi.mocked(loadFont).mockResolvedValue(font)
    // Classic's reference resolution: the size the production backgrounds
    // actually are, where output must be pixel-identical to the old code.
    mockImageSize = { width: 1920, height: 1080 }

    const { result } = renderHook(() => usePosterframeCanvas())
    const canvas = document.createElement('canvas')
    installCanvas2dStub(canvas)
    // @ts-expect-error - assigning to RefObject.current in a test
    result.current.canvasRef.current = canvas
    const ctx = canvas.getContext('2d') as unknown as { rect: ReturnType<typeof vi.fn> }

    await act(async () => {
      const p = result.current.draw('/image.jpg', title, 'classic')
      pendingImages[0].fireOnload()
      await p
    })

    return { rect: ctx.rect, getPathCalls }
  }

  test('b4_1_classic_clip_rect_and_first_baseline_are_unchanged_at_1920x1080', async () => {
    // 'Title ' = 6 glyphs = 97.8px, one line. The historic clip rect is
    // (x=292, top=baseline-fontSize=430, w=380, h=lines*45) and the first
    // glyph paints at the 467px baseline with the 37px font. Deriving the
    // clip top from font metrics instead (ascent = 29.6 -> top 437.4) fails
    // this test - exactly the drift the review round flagged.
    const { rect, getPathCalls } = await drawClassic('Title')

    expect(rect).toHaveBeenCalledWith(292, 430, 380, 45)
    expect(getPathCalls[0]).toEqual([292, 467, 37])
  })

  test('b1_5_the_clip_region_grows_with_the_wrapped_line_count', async () => {
    // Four 10-glyph words wrap into two lines at 380px (22 glyphs = 358.6px
    // per line) - the clip height must follow the content, not the design
    // box.
    const { rect } = await drawClassic('Aaaaaaaaaa Bbbbbbbbbb Cccccccccc Dddddddddd')

    expect(rect).toHaveBeenCalledWith(292, 430, 380, 90)
  })
})
