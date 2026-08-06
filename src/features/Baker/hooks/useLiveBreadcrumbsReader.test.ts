/**
 * useLiveBreadcrumbsReader Tests
 *
 * B2.2 — a legitimate numberOfCameras of 0 (podcast/audio-only project) must
 * round-trip through the live reader without being clamped up to 1.
 */

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BreadcrumbsFile, FileInfo } from '../types'

vi.mock('../api', () => ({
  bakerReadBreadcrumbs: vi.fn(),
  bakerReadRawBreadcrumbs: vi.fn(),
  bakerScanCurrentFiles: vi.fn()
}))

import { bakerReadBreadcrumbs, bakerScanCurrentFiles } from '../api'
import { useLiveBreadcrumbsReader } from './useLiveBreadcrumbsReader'

const breadcrumbs = (overrides: Partial<BreadcrumbsFile> = {}): BreadcrumbsFile => ({
  projectTitle: 'Podcast Ep 1',
  numberOfCameras: 0,
  files: [],
  parentFolder: '/Volumes/Media',
  createdBy: 'Baker',
  creationDateTime: '2026-07-01T00:00:00Z',
  ...overrides
})

const file = (camera: number, name: string): FileInfo => ({
  camera,
  name,
  path: `Footage/Camera ${camera}/${name}`
})

describe('useLiveBreadcrumbsReader camera count (B2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves numberOfCameras 0 when no camera files exist on disk', async () => {
    vi.mocked(bakerReadBreadcrumbs).mockResolvedValue(breadcrumbs({ numberOfCameras: 0 }))
    vi.mocked(bakerScanCurrentFiles).mockResolvedValue([])

    const { result } = renderHook(() => useLiveBreadcrumbsReader())
    await act(async () => {
      await result.current.readLiveBreadcrumbs('/Volumes/Media/Podcast Ep 1')
    })

    expect(result.current.breadcrumbs?.numberOfCameras).toBe(0)
  })

  it('preserves the recorded camera count when camera folders are empty', async () => {
    vi.mocked(bakerReadBreadcrumbs).mockResolvedValue(breadcrumbs({ numberOfCameras: 2 }))
    vi.mocked(bakerScanCurrentFiles).mockResolvedValue([])

    const { result } = renderHook(() => useLiveBreadcrumbsReader())
    await act(async () => {
      await result.current.readLiveBreadcrumbs('/Volumes/Media/Show A')
    })

    expect(result.current.breadcrumbs?.numberOfCameras).toBe(2)
  })

  it('derives the camera count from live files when files exist', async () => {
    vi.mocked(bakerReadBreadcrumbs).mockResolvedValue(breadcrumbs({ numberOfCameras: 1 }))
    vi.mocked(bakerScanCurrentFiles).mockResolvedValue([
      file(1, 'a.mp4'),
      file(3, 'c.mp4')
    ])

    const { result } = renderHook(() => useLiveBreadcrumbsReader())
    await act(async () => {
      await result.current.readLiveBreadcrumbs('/Volumes/Media/Show B')
    })

    expect(result.current.breadcrumbs?.numberOfCameras).toBe(3)
  })
})
