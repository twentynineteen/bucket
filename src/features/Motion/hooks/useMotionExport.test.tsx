/**
 * useMotionExport tests (issue #337)
 *
 * Covers export orchestration, success/error toasts, the stale .tmp-*
 * sweep integration, video render into the bundle temp folder, Rust
 * error extraction and the synchronous clipboard copy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type {
  CatalogueEntry,
  MotionFormat,
  ParamValues,
  ResolvedTemplate
} from '../types'
import { useMotionExport } from './useMotionExport'

// Mock the api module
vi.mock('../api', () => ({
  copyToClipboard: vi.fn(async () => {}),
  revealInFinder: vi.fn(async () => {}),
  joinPath: vi.fn(async (...parts: string[]) => parts.join('/')),
  makeDir: vi.fn(async () => {}),
  writeText: vi.fn(async () => {}),
  writeBytes: vi.fn(async () => {}),
  renamePath: vi.fn(async () => {}),
  removeDirRecursive: vi.fn(async () => {}),
  pathExists: vi.fn(async () => false),
  copyFileTo: vi.fn(async () => {}),
  listFolder: vi.fn(async () => []),
  modifiedTimeMs: vi.fn(async () => Date.now()),
  startRender: vi.fn(async () => 'render-1'),
  sendRenderFrame: vi.fn(async () => {}),
  finishRender: vi.fn(async () => '/p/Graphics/Motion/test.mov'),
  cancelRender: vi.fn(async () => {}),
  onRenderProgress: vi.fn(async () => () => {})
}))

vi.mock('../internal/frameRenderer', () => ({
  buildFrameList: vi.fn(() => [0, 0.04, 0.08]),
  renderFrameToPng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function makeEntry(): CatalogueEntry {
  return {
    template: {
      schemaVersion: 1,
      id: 'lower-third-glide',
      version: '1.0.0',
      name: 'Glide',
      description: 'Test',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {
        name: {
          kind: 'text',
          label: 'Name',
          maxLength: 40,
          default: 'Jane Doe',
          required: true
        }
      },
      layers: [],
      primaryTextParam: 'name'
    },
    source: 'builtin'
  }
}

function makeResolved(): ResolvedTemplate {
  const entry = makeEntry()
  return {
    id: entry.template.id,
    name: entry.template.name,
    description: entry.template.description,
    category: entry.template.category,
    status: entry.template.status,
    fonts: entry.template.fonts,
    duration: 4,
    inEnd: 1,
    outStart: 3,
    hasHold: false,
    layers: [],
    originalTemplate: entry.template,
    values: { name: 'Jane Doe' }
  }
}

const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
const values: ParamValues = { name: 'Jane Doe' }

describe('useMotionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('an export sweeps .tmp- folders older than a day from Graphics/Motion, and keeps fresh ones', async () => {
    const api = await import('../api')
    const day = 24 * 60 * 60 * 1000
    vi.mocked(api.listFolder).mockResolvedValueOnce([
      { name: '.tmp-old-abc', isFile: false },
      { name: '.tmp-new-def', isFile: false },
      { name: 'keep-me', isFile: false }
    ])
    vi.mocked(api.modifiedTimeMs).mockImplementation(async (path: string) =>
      path.endsWith('.tmp-old-abc') ? Date.now() - 2 * day : Date.now()
    )
    const { result } = renderHook(() => useMotionExport(), { wrapper })

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['ae', 'prompt'],
        projectFolder: '/p',
        ffmpegDirectory: null
      })
    })

    const removed = vi.mocked(api.removeDirRecursive).mock.calls.map(c => c[0])
    expect(removed).toContain('/p/Graphics/Motion/.tmp-old-abc')
    expect(removed).not.toContain('/p/Graphics/Motion/.tmp-new-def')
    expect(removed).not.toContain('/p/Graphics/Motion/keep-me')
  })

  it('success toast with Reveal in Finder action', async () => {
    const { result } = renderHook(() => useMotionExport(), { wrapper })

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['ae', 'prompt'],
        projectFolder: '/p',
        ffmpegDirectory: null
      })
    })

    // Toast should have been shown with success
    expect(toast.success).toHaveBeenCalled()
    const toastCall = (toast.success as Mock).mock.calls[0]
    // The toast should have an action for "Reveal in Finder"
    expect(toastCall[1]).toBeDefined()
    expect(toastCall[1]).toHaveProperty('action')
  })

  it('video target renders video into bundle temp folder, not directly to Graphics/Motion', async () => {
    // Need to track what path renderVideo.render receives
    const api = await import('../api')
    const { result } = renderHook(() => useMotionExport(), { wrapper })

    // Track the render call's outputPath
    const startRenderMock = api.startRender as Mock
    startRenderMock.mockClear()

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['ae', 'prompt', 'video'],
        projectFolder: '/p',
        ffmpegDirectory: '/usr/local/bin'
      })
    })

    // startRender should have been called
    expect(startRenderMock).toHaveBeenCalledTimes(1)
    const renderRequest = startRenderMock.mock.calls[0][0]
    // The video output path must be inside the bundle's temp folder,
    // not directly under Graphics/Motion/
    expect(renderRequest.outputPath).toMatch(/\.tmp-lower-third-glide-/)
    // And it must NOT be directly /p/Graphics/Motion/<id>.mov
    expect(renderRequest.outputPath).not.toBe('/p/Graphics/Motion/lower-third-glide.mov')
  })

  it('render error surfaces via toast.error', async () => {
    // Make the frame renderer fail on the second frame
    const frameRenderer = await import('../internal/frameRenderer')
    ;(frameRenderer.renderFrameToPng as Mock)
      .mockResolvedValueOnce(new Uint8Array([0x89]))
      .mockRejectedValueOnce(new Error('SVG render failed'))

    const { result } = renderHook(() => useMotionExport(), { wrapper })

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['video'],
        projectFolder: '/p',
        ffmpegDirectory: null
      })
    })

    // toast.error should have been called with the error message
    expect(toast.error).toHaveBeenCalled()
  })

  it('Rust {kind, message} error shows message text in the export toast', async () => {
    // Rust rejects with { kind, message }, not an Error instance
    const api = await import('../api')
    ;(api.startRender as Mock).mockRejectedValueOnce({
      kind: 'encodeFailed',
      message: 'ffmpeg exited with code 1: ...stderr tail'
    })

    const { result } = renderHook(() => useMotionExport(), { wrapper })

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['video'],
        projectFolder: '/p',
        ffmpegDirectory: null
      })
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    const toastMessage = (toast.error as Mock).mock.calls[0][0]
    // Must show the Rust message, not a bare "Export failed"
    expect(toastMessage).toContain('ffmpeg exited with code 1')
  })

  it('Rust {kind} without message falls back to kind in the export toast', async () => {
    const api = await import('../api')
    ;(api.startRender as Mock).mockRejectedValueOnce({
      kind: 'encodeFailed'
    })

    const { result } = renderHook(() => useMotionExport(), { wrapper })

    await act(async () => {
      await result.current.exportToProject({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved(),
        targets: ['video'],
        projectFolder: '/p',
        ffmpegDirectory: null
      })
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    const toastMessage = (toast.error as Mock).mock.calls[0][0]
    expect(toastMessage).toContain('encodeFailed')
  })

  it('copyPrompt calls copyToClipboard synchronously in the click handler', async () => {
    const api = await import('../api')
    const { result } = renderHook(() => useMotionExport(), { wrapper })

    act(() => {
      result.current.copyPrompt({
        entry: makeEntry(),
        values,
        format,
        resolved: makeResolved()
      })
    })

    // copyToClipboard should be called (the first call in the handler, no await before it)
    expect(api.copyToClipboard).toHaveBeenCalledTimes(1)
    const clipboardArg = (api.copyToClipboard as Mock).mock.calls[0][0]
    expect(typeof clipboardArg).toBe('string')
    expect(clipboardArg.length).toBeGreaterThan(0)

    // Toast should say prompt was copied
    expect(toast.success).toHaveBeenCalled()
  })
})
