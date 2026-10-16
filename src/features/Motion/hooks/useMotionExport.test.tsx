/**
 * useMotionExport tests (issue #337)
 *
 * M5.5: Success toast with "Reveal in Finder" action.
 * M5.7: "Copy Claude prompt" calls copyToClipboard synchronously.
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
  startRender: vi.fn(async () => 'render-1'),
  sendRenderFrame: vi.fn(async () => {}),
  finishRender: vi.fn(async () => '/p/Graphics/Motion/test.mov'),
  cancelRender: vi.fn(async () => {}),
  onRenderProgress: vi.fn(async () => () => {})
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

  it('M5.5 - success toast with Reveal in Finder action', async () => {
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

  it('M5.7 - copyPrompt calls copyToClipboard synchronously in the click handler', async () => {
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
