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
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { usePosterframeCanvas } from '@features/Upload/hooks/usePosterframeCanvas'

vi.mock('@features/Upload/internal/loadFont', () => ({
  loadFont: vi.fn()
}))
import { loadFont } from '@features/Upload/internal/loadFont'

// ============================================================================
// Image + Canvas2D mocks
// ============================================================================

interface PendingImage {
  src: string
  fireOnload: () => void
  fireOnerror: (err?: Error) => void
}

let pendingImages: PendingImage[] = []

function installImageMock() {
  // Replace the global Image constructor with a version that captures each
  // instance so the test can decide when (or whether) onload fires.
  class MockImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 1024
    height = 768
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
    const drawPromise = result.current.draw('/some-image.jpg', 'Title')
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

    const drawPromise = result.current.draw('/bad-image.jpg', 'Title')
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
      const p = result.current.draw('/image.jpg', 'Title')
      pendingImages[0].fireOnload()
      await p
    })

    expect(result.current.fontStatus).toBe('missing')
  })

  test("fontStatus transitions to 'loaded' when loadFont returns a font", async () => {
    // Minimal opentype.Font stub — we only need stringToGlyphs to not throw
    // and unitsPerEm to be defined for the layout pass.
    const fakeFont = {
      unitsPerEm: 1000,
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
      const p = result.current.draw('/image.jpg', 'Title')
      pendingImages[0].fireOnload()
      await p
    })

    expect(result.current.fontStatus).toBe('loaded')
  })
})
