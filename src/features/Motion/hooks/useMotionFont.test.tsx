/**
 * useMotionFont hook tests (issue #333)
 *
 * Covers behaviours L4.1 and L4.2: font ready/missing states and FontFace
 * registration.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { motionFontAvailable, readMotionFont } from '../api'
import { useMotionFont } from './useMotionFont'

// Mock the api module
vi.mock('../api', () => ({
  motionFontAvailable: vi.fn(),
  readMotionFont: vi.fn()
}))

const mockedAvailable = vi.mocked(motionFontAvailable)
const mockedReadFont = vi.mocked(readMotionFont)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// L4.1 - Font installed: returns ready + registers FontFace
// ---------------------------------------------------------------------------
describe('L4.1 useMotionFont when font is installed', () => {
  it('returns status ready with bytes and registers a FontFace', async () => {
    const fakeBytes = new Uint8Array([0x4f, 0x54, 0x54, 0x4f]) // OTTO header
    mockedAvailable.mockResolvedValue(true)
    mockedReadFont.mockResolvedValue(fakeBytes)

    const addSpy = vi.spyOn(document.fonts, 'add')

    const { result } = renderHook(() => useMotionFont(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.bytes).toEqual(fakeBytes)
    expect(addSpy).toHaveBeenCalled()
    addSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// L4.2 - Font not installed: returns missing, no throw
// ---------------------------------------------------------------------------
describe('L4.2 useMotionFont when font is missing', () => {
  it('returns status missing when font is not installed', async () => {
    mockedAvailable.mockResolvedValue(false)

    const { result } = renderHook(() => useMotionFont(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current.bytes).toBeUndefined()
  })

  it('returns ready without registering when FontFace is absent', async () => {
    const fakeBytes = new Uint8Array([0x4f, 0x54, 0x54, 0x4f])
    mockedAvailable.mockResolvedValue(true)
    mockedReadFont.mockResolvedValue(fakeBytes)

    // Temporarily remove FontFace
    const original = globalThis.FontFace

    ;(globalThis as unknown as Record<string, unknown>).FontFace = undefined

    const { result } = renderHook(() => useMotionFont(), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.bytes).toEqual(fakeBytes)

    // Restore
    ;(globalThis as unknown as Record<string, unknown>).FontFace = original
  })
})
