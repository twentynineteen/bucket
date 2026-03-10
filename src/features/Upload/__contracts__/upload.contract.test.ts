/**
 * Upload Contract Tests
 *
 * Verifies the shape and behavior of the Upload feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Upload I/O)
vi.mock('../api', () => ({
  uploadVideo: vi.fn().mockResolvedValue(undefined),
  getFolders: vi.fn().mockResolvedValue({ folders: [] }),
  fetchSproutVideoDetails: vi.fn().mockResolvedValue({}),
  openFolder: vi.fn().mockResolvedValue(undefined),
  listenUploadProgress: vi.fn().mockResolvedValue(() => {}),
  listenUploadComplete: vi.fn().mockResolvedValue(() => {}),
  listenUploadError: vi.fn().mockResolvedValue(() => {}),
  openFileDialog: vi.fn().mockResolvedValue(null),
  openFolderDialog: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(undefined),
  readFileAsBytes: vi.fn().mockResolvedValue(new Uint8Array()),
  listDirectory: vi.fn().mockResolvedValue([]),
  getFontDir: vi.fn().mockResolvedValue('/fonts'),
  fileExists: vi.fn().mockResolvedValue(false)
}))

// Mock shared dependencies
vi.mock('@shared/constants/timing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/constants/timing')>()
  return { ...actual }
})

vi.mock('@shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  },
  createNamespacedLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    upload: {
      events: () => ['upload', 'events']
    },
    images: {
      refresh: (id: string) => ['images', 'refresh', id],
      zoomPan: (id: string) => ['images', 'zoomPan', id],
      posterframe: {
        autoRedraw: (key: string) => ['images', 'posterframe', 'autoRedraw', key]
      }
    }
  }
}))

vi.mock('@shared/lib/query-utils', () => ({
  createQueryOptions: (
    queryKey: unknown[],
    queryFn: () => Promise<unknown>,
    _profile: string,
    options?: Record<string, unknown>
  ) => ({
    queryKey,
    queryFn,
    ...options
  }),
  createQueryError: (msg: string) => new Error(msg),
  shouldRetry: () => false
}))

vi.mock('@shared/store', () => ({
  appStore: {
    getState: () => ({
      setLatestSproutUpload: vi.fn()
    })
  },
  useAppStore: vi.fn()
}))

vi.mock('@shared/utils/debounce', () => ({
  debounce: (fn: () => void) => {
    const debounced = fn as unknown as (() => void) & {
      cancel?: () => void
    }
    debounced.cancel = vi.fn()
    return debounced
  }
}))

// Mock React Query
const mockRefetch = vi.fn()
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockSetQueryData = vi.fn()
const mockRemoveQueries = vi.fn()

const mockUseQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: mockRefetch,
  isRefetching: false,
  dataUpdatedAt: 0
}))

const mockUseMutation = vi.fn(() => ({
  mutate: mockMutate,
  mutateAsync: mockMutateAsync,
  isPending: false,
  error: null,
  data: null
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    removeQueries: mockRemoveQueries,
    invalidateQueries: vi.fn()
  })
}))

// Mock internal modules (not exported, but required by hooks)
vi.mock('../internal/parseSproutVideoUrl', () => ({
  parseSproutVideoUrl: vi.fn().mockReturnValue('abc123')
}))

vi.mock('../internal/loadFont', () => ({
  loadFont: vi.fn().mockResolvedValue(null)
}))

// Mock sonner for toast notifications
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

import * as uploadBarrel from '../index'

// --- Shape Tests ---

describe('Upload Barrel Exports - Shape', () => {
  const expectedExports = [
    // Components
    'UploadSprout',
    'Posterframe',
    'UploadOtter',
    'FolderTreeSprout',
    // Hooks
    'useFileUpload',
    'useUploadEvents',
    'useImageRefresh',
    'useSproutVideoApi',
    'useSproutVideoProcessor',
    'usePosterframeCanvas',
    'usePosterframeAutoRedraw',
    'useFileSelection',
    'useZoomPan'
  ].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    const exportNames = Object.keys(uploadBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('exports exactly 13 members (4 components + 9 hooks)', () => {
    expect(Object.keys(uploadBarrel)).toHaveLength(13)
  })

  // Component shape checks
  const componentNames = [
    'UploadSprout',
    'Posterframe',
    'UploadOtter',
    'FolderTreeSprout'
  ] as const

  for (const name of componentNames) {
    it(`exports ${name} as a function`, () => {
      expect(typeof uploadBarrel[name]).toBe('function')
    })
  }

  // Hook shape checks
  const hookNames = [
    'useFileUpload',
    'useUploadEvents',
    'useImageRefresh',
    'useSproutVideoApi',
    'useSproutVideoProcessor',
    'usePosterframeCanvas',
    'usePosterframeAutoRedraw',
    'useFileSelection',
    'useZoomPan'
  ] as const

  for (const name of hookNames) {
    it(`exports ${name} as a function`, () => {
      expect(typeof uploadBarrel[name]).toBe('function')
    })
  }

  it('does NOT export useSproutVideoPlayer (dropped dead code)', () => {
    const exportNames = Object.keys(uploadBarrel)
    expect(exportNames).not.toContain('useSproutVideoPlayer')
  })

  it('does NOT export internal utilities (parseSproutVideoUrl, loadFont)', () => {
    const exportNames = Object.keys(uploadBarrel)
    expect(exportNames).not.toContain('parseSproutVideoUrl')
    expect(exportNames).not.toContain('loadFont')
  })

  it('does NOT export api layer functions directly', () => {
    const exportNames = Object.keys(uploadBarrel)
    expect(exportNames).not.toContain('uploadVideo')
    expect(exportNames).not.toContain('getFolders')
    expect(exportNames).not.toContain('openFileDialog')
    expect(exportNames).not.toContain('listenUploadProgress')
  })
})

// --- Behavioral Tests ---

describe('useFileUpload - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => uploadBarrel.useFileUpload())

    expect(result.current).toHaveProperty('selectedFile')
    expect(result.current).toHaveProperty('uploading')
    expect(result.current).toHaveProperty('response')
    expect(result.current).toHaveProperty('selectFile')
    expect(result.current).toHaveProperty('uploadFile')
    expect(result.current).toHaveProperty('resetUploadState')
    expect(typeof result.current.selectFile).toBe('function')
    expect(typeof result.current.uploadFile).toBe('function')
    expect(typeof result.current.resetUploadState).toBe('function')
  })

  it('initializes with null selectedFile and response', () => {
    const { result } = renderHook(() => uploadBarrel.useFileUpload())

    expect(result.current.selectedFile).toBeNull()
    expect(result.current.response).toBeNull()
    expect(result.current.uploading).toBe(false)
  })
})

describe('useUploadEvents - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => uploadBarrel.useUploadEvents())

    expect(result.current).toHaveProperty('progress')
    expect(result.current).toHaveProperty('uploading')
    expect(result.current).toHaveProperty('message')
    expect(result.current).toHaveProperty('setUploading')
    expect(result.current).toHaveProperty('setProgress')
    expect(result.current).toHaveProperty('setMessage')
    expect(typeof result.current.setUploading).toBe('function')
    expect(typeof result.current.setProgress).toBe('function')
    expect(typeof result.current.setMessage).toBe('function')
  })

  it('initializes with default upload state', () => {
    const { result } = renderHook(() => uploadBarrel.useUploadEvents())

    expect(result.current.progress).toBe(0)
    expect(result.current.uploading).toBe(false)
    expect(result.current.message).toBeNull()
  })
})

describe('useSproutVideoApi - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => uploadBarrel.useSproutVideoApi())

    expect(result.current).toHaveProperty('fetchVideoDetails')
    expect(result.current).toHaveProperty('fetchVideoDetailsAsync')
    expect(result.current).toHaveProperty('isFetching')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('data')
    expect(result.current).toHaveProperty('reset')
    expect(typeof result.current.fetchVideoDetails).toBe('function')
    expect(typeof result.current.fetchVideoDetailsAsync).toBe('function')
  })

  it('initializes with not fetching', () => {
    const { result } = renderHook(() => uploadBarrel.useSproutVideoApi())

    expect(result.current.isFetching).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('usePosterframeCanvas - Behavior', () => {
  it('returns canvasRef and draw function', () => {
    const { result } = renderHook(() => uploadBarrel.usePosterframeCanvas())

    expect(result.current).toHaveProperty('canvasRef')
    expect(result.current).toHaveProperty('draw')
    expect(typeof result.current.draw).toBe('function')
  })
})

describe('useFileSelection - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => uploadBarrel.useFileSelection())

    expect(result.current).toHaveProperty('selectedFilePath')
    expect(result.current).toHaveProperty('selectedFileBlob')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('selectFile')
    expect(result.current).toHaveProperty('clearSelection')
    expect(typeof result.current.selectFile).toBe('function')
    expect(typeof result.current.clearSelection).toBe('function')
  })

  it('initializes with null selection', () => {
    const { result } = renderHook(() => uploadBarrel.useFileSelection())

    expect(result.current.selectedFilePath).toBeNull()
    expect(result.current.selectedFileBlob).toBeNull()
  })
})

describe('useZoomPan - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => uploadBarrel.useZoomPan())

    expect(result.current).toHaveProperty('zoomLevel')
    expect(result.current).toHaveProperty('pan')
    expect(result.current).toHaveProperty('setZoomLevel')
    expect(result.current).toHaveProperty('setPan')
    expect(result.current).toHaveProperty('resetZoomPan')
    expect(typeof result.current.setZoomLevel).toBe('function')
    expect(typeof result.current.setPan).toBe('function')
    expect(typeof result.current.resetZoomPan).toBe('function')
  })

  it('initializes with default zoom level of 1', () => {
    const { result } = renderHook(() => uploadBarrel.useZoomPan())

    expect(result.current.zoomLevel).toBe(1)
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
  })
})

// --- No-Bypass Tests ---

describe('Upload Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/Upload')

  function getFilesRecursive(dir: string, extensions: string[]): string[] {
    const files: string[] = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__contracts__' || entry.name === 'node_modules')
          continue
        files.push(...getFilesRecursive(fullPath, extensions))
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
    return files
  }

  it('all non-api.ts files have zero direct @tauri-apps imports', () => {
    const allFiles = getFilesRecursive(modulePath, ['.ts', '.tsx'])
    const nonApiFiles = allFiles.filter((f) => !f.endsWith('/api.ts'))
    for (const file of nonApiFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const tauriImports = lines.filter((line) =>
        line.includes("from '@tauri-apps")
      )
      expect(tauriImports).toEqual([])
    }
  })
})
