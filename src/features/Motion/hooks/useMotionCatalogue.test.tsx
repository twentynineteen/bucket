/**
 * useMotionCatalogue hook tests (issue #333)
 *
 * Covers behaviours L3.1 - L3.3: catalogue hook returns entries + issues,
 * rescan reloads, and folder pref change triggers reload.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { listFolder, readText } from '../api'
import { useMotionCatalogue } from './useMotionCatalogue'

// Mock the api module
vi.mock('../api', () => ({
  listFolder: vi.fn(),
  readText: vi.fn(),
  readMotionPrefsText: vi.fn(),
  writeMotionPrefsText: vi.fn()
}))

const mockedListFolder = vi.mocked(listFolder)
const mockedReadText = vi.mocked(readText)

/** Minimal valid template JSON. */
function makeTemplateJson(id: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    id,
    version: '1.0.0',
    name: id,
    description: `Test ${id}`,
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: [],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {},
    layers: [
      {
        kind: 'rect',
        id: 'bg',
        anchor: { x: 0, y: 0 },
        width: 100,
        height: 100,
        fill: '#000000',
        radius: 0
      }
    ]
  })
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// L3.1 - Hook returns built-ins + library + issues + loading + rescan
// ---------------------------------------------------------------------------
describe('L3.1 useMotionCatalogue basic return shape', () => {
  it('returns built-ins plus library template, issues, loading, and rescan', async () => {
    mockedListFolder.mockResolvedValue([{ name: 'user-template.json', isFile: true }])
    mockedReadText.mockResolvedValue(makeTemplateJson('user-template'))

    const { result } = renderHook(() => useMotionCatalogue('/lib'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Should have at least the user template (built-ins may be empty in test)
    const userEntry = result.current.entries.find(e => e.template.id === 'user-template')
    expect(userEntry).toBeDefined()
    expect(Array.isArray(result.current.issues)).toBe(true)
    expect(typeof result.current.rescan).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// L3.2 - rescan() picks up new files
// ---------------------------------------------------------------------------
describe('L3.2 useMotionCatalogue rescan', () => {
  it('adds a new template after rescan', async () => {
    // First call: one file
    mockedListFolder.mockResolvedValueOnce([{ name: 'first.json', isFile: true }])
    mockedReadText.mockResolvedValueOnce(makeTemplateJson('first'))

    const { result } = renderHook(() => useMotionCatalogue('/lib'), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const countBefore = result.current.entries.length

    // Second call: two files
    mockedListFolder.mockResolvedValueOnce([
      { name: 'first.json', isFile: true },
      { name: 'second.json', isFile: true }
    ])
    mockedReadText
      .mockResolvedValueOnce(makeTemplateJson('first'))
      .mockResolvedValueOnce(makeTemplateJson('second'))

    await act(async () => {
      result.current.rescan()
    })

    await waitFor(() =>
      expect(result.current.entries.length).toBeGreaterThan(countBefore)
    )
    const secondEntry = result.current.entries.find(e => e.template.id === 'second')
    expect(secondEntry).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// L3.3 - Folder pref change triggers reload
// ---------------------------------------------------------------------------
describe('L3.3 useMotionCatalogue keyed on folder', () => {
  it('reloads when the library folder changes', async () => {
    mockedListFolder.mockResolvedValue([{ name: 'alpha.json', isFile: true }])
    mockedReadText.mockResolvedValue(makeTemplateJson('alpha'))

    const { result, rerender } = renderHook(
      ({ folder }: { folder: string | null }) => useMotionCatalogue(folder),
      {
        wrapper: createWrapper(),
        initialProps: { folder: '/old' }
      }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockedListFolder.mockResolvedValue([{ name: 'beta.json', isFile: true }])
    mockedReadText.mockResolvedValue(makeTemplateJson('beta'))

    rerender({ folder: '/new' })

    await waitFor(() =>
      expect(result.current.entries.some(e => e.template.id === 'beta')).toBe(true)
    )
  })
})
