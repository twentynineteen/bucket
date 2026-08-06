/**
 * useCameraAutoRemap Tests
 *
 * B5.3 (issue #138) — with 0 cameras there is no valid camera to remap to, so
 * the hook must leave file assignments untouched instead of clamping them to 1.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { FootageFile } from '../types'
import { useCameraAutoRemap } from './useCameraAutoRemap'

const footage = (camera: number, name: string): FootageFile => ({
  file: { path: `/media/${name}`, name },
  camera
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

describe('useCameraAutoRemap', () => {
  it('remaps out-of-range cameras to 1 when at least one camera exists', async () => {
    const setFiles = vi.fn()
    const files = [footage(3, 'a.mp4')]

    renderHook(() => useCameraAutoRemap(files, 1, setFiles), { wrapper })

    await waitFor(() => {
      expect(setFiles).toHaveBeenCalledWith([{ ...files[0], camera: 1 }])
    })
  })

  it('leaves files untouched when numCameras is 0 (B5.3)', async () => {
    const setFiles = vi.fn()
    const files = [footage(2, 'a.mp4'), footage(1, 'b.mp4')]

    renderHook(() => useCameraAutoRemap(files, 0, setFiles), { wrapper })

    // Give the query a beat to settle, then assert nothing was remapped.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(setFiles).not.toHaveBeenCalled()
  })
})
