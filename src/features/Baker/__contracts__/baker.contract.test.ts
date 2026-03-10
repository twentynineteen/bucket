/**
 * Baker Contract Tests
 *
 * Verifies the shape and behavior of the Baker feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Baker I/O)
vi.mock('../api', () => ({
  bakerStartScan: vi.fn().mockResolvedValue('scan-id'),
  bakerCancelScan: vi.fn().mockResolvedValue(undefined),
  bakerReadBreadcrumbs: vi.fn().mockResolvedValue(null),
  bakerReadRawBreadcrumbs: vi.fn().mockResolvedValue(null),
  bakerScanCurrentFiles: vi.fn().mockResolvedValue([]),
  bakerUpdateBreadcrumbs: vi.fn().mockResolvedValue({}),
  bakerGetVideoLinks: vi.fn().mockResolvedValue([]),
  bakerAssociateVideoLink: vi.fn().mockResolvedValue({}),
  bakerRemoveVideoLink: vi.fn().mockResolvedValue({}),
  bakerUpdateVideoLink: vi.fn().mockResolvedValue({}),
  bakerReorderVideoLinks: vi.fn().mockResolvedValue({}),
  getFolderSize: vi.fn().mockResolvedValue(0),
  listenScanProgress: vi.fn().mockResolvedValue(() => {}),
  listenScanComplete: vi.fn().mockResolvedValue(() => {}),
  listenScanError: vi.fn().mockResolvedValue(() => {}),
  openFolderDialog: vi.fn().mockResolvedValue(null),
  openJsonFileDialog: vi.fn().mockResolvedValue(null),
  askDialog: vi.fn().mockResolvedValue(true),
  confirmDialog: vi.fn().mockResolvedValue(true),
  openInShell: vi.fn().mockResolvedValue(undefined),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  readTextFileContents: vi.fn().mockResolvedValue(''),
  writeTextFileContents: vi.fn().mockResolvedValue(undefined),
  updateTrelloCardDesc: vi.fn().mockResolvedValue(new Response()),
  addTrelloCardComment: vi.fn().mockResolvedValue(new Response())
}))

// Mock shared dependencies
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

vi.mock('@shared/store', () => ({
  appStore: {
    getState: () => ({
      breadcrumbs: null,
      setBreadcrumbs: vi.fn()
    })
  },
  useAppStore: vi.fn()
}))

vi.mock('@shared/utils/breadcrumbs', () => ({
  compareBreadcrumbsMeaningful: vi.fn().mockReturnValue(false),
  generateBreadcrumbsPreview: vi.fn().mockReturnValue(null)
}))

// Mock React Query
const mockRefetch = vi.fn()
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn().mockResolvedValue(undefined)

const mockUseQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: mockRefetch
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
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn()
  })
}))

vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    baker: {
      videoLinks: (path: string) => ['baker', 'videoLinks', path]
    }
  }
}))

import * as bakerBarrel from '../index'
import * as bakerApi from '../api'

// --- Shape Tests (Barrel Exports) ---

describe('Baker Barrel Exports - Shape', () => {
  const expectedExports = [
    // Page
    'BakerPage',
    // Hooks (consumed by Trello module)
    'generateBreadcrumbsBlock',
    'useAppendBreadcrumbs',
    'updateTrelloCardWithBreadcrumbs',
    'useProjectBreadcrumbs',
    'useBreadcrumbsReader',
    'useBreadcrumbsVideoLinks'
  ].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    // Filter out type-only exports (not visible at runtime)
    const exportNames = Object.keys(bakerBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('exports exactly 7 runtime members', () => {
    expect(Object.keys(bakerBarrel)).toHaveLength(7)
  })

  it('exports BakerPage as a function (React component)', () => {
    expect(typeof bakerBarrel.BakerPage).toBe('function')
  })

  // Hook shape checks
  const hookNames = [
    'useAppendBreadcrumbs',
    'useProjectBreadcrumbs',
    'useBreadcrumbsReader',
    'useBreadcrumbsVideoLinks'
  ] as const

  for (const name of hookNames) {
    it(`exports ${name} as a function`, () => {
      expect(typeof bakerBarrel[name]).toBe('function')
    })
  }

  // Utility function checks
  it('exports generateBreadcrumbsBlock as a function', () => {
    expect(typeof bakerBarrel.generateBreadcrumbsBlock).toBe('function')
  })

  it('exports updateTrelloCardWithBreadcrumbs as a function', () => {
    expect(typeof bakerBarrel.updateTrelloCardWithBreadcrumbs).toBe('function')
  })

  it('does NOT export internal hooks (useBakerScan, useBakerPreferences, etc.)', () => {
    const exportNames = Object.keys(bakerBarrel)
    expect(exportNames).not.toContain('useBakerScan')
    expect(exportNames).not.toContain('useBakerPreferences')
    expect(exportNames).not.toContain('useBreadcrumbsManager')
    expect(exportNames).not.toContain('useBreadcrumbsPreview')
    expect(exportNames).not.toContain('useLiveBreadcrumbsReader')
  })

  it('does NOT export api layer functions directly', () => {
    const exportNames = Object.keys(bakerBarrel)
    expect(exportNames).not.toContain('bakerStartScan')
    expect(exportNames).not.toContain('bakerReadBreadcrumbs')
    expect(exportNames).not.toContain('openFolderDialog')
    expect(exportNames).not.toContain('listenScanProgress')
    expect(exportNames).not.toContain('getFolderSize')
  })

  it('does NOT export internal components', () => {
    const exportNames = Object.keys(bakerBarrel)
    expect(exportNames).not.toContain('FolderSelector')
    expect(exportNames).not.toContain('ProjectDetailPanel')
    expect(exportNames).not.toContain('VideoLinksManager')
    expect(exportNames).not.toContain('BatchUpdateConfirmationDialog')
  })

  it('does NOT export internal utilities', () => {
    const exportNames = Object.keys(bakerBarrel)
    expect(exportNames).not.toContain('batchUpdateSummary')
    expect(exportNames).not.toContain('generateBatchSummary')
  })
})

// --- Shape Tests (api.ts Exports) ---

describe('Baker api.ts Exports - Shape', () => {
  const expectedApiExports = [
    // Tauri Commands (12)
    'bakerStartScan',
    'bakerCancelScan',
    'bakerReadBreadcrumbs',
    'bakerReadRawBreadcrumbs',
    'bakerScanCurrentFiles',
    'bakerUpdateBreadcrumbs',
    'bakerGetVideoLinks',
    'bakerAssociateVideoLink',
    'bakerRemoveVideoLink',
    'bakerUpdateVideoLink',
    'bakerReorderVideoLinks',
    'getFolderSize',
    // Event Listeners (3)
    'listenScanProgress',
    'listenScanComplete',
    'listenScanError',
    // Dialog (4)
    'openFolderDialog',
    'openJsonFileDialog',
    'askDialog',
    'confirmDialog',
    // Shell/Opener (2)
    'openInShell',
    'openExternalUrl',
    // File System (2)
    'readTextFileContents',
    'writeTextFileContents',
    // External API (2)
    'updateTrelloCardDesc',
    'addTrelloCardComment'
  ].sort()

  it('exports exactly 25 I/O wrapper functions', () => {
    const exportNames = Object.keys(bakerApi).sort()
    expect(exportNames).toEqual(expectedApiExports)
  })

  it('exports exactly 25 members', () => {
    expect(Object.keys(bakerApi)).toHaveLength(25)
  })

  for (const name of expectedApiExports) {
    it(`exports ${name} as a function`, () => {
      expect(typeof (bakerApi as Record<string, unknown>)[name]).toBe('function')
    })
  }
})

// --- Behavioral Tests ---

describe('useBreadcrumbsReader - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => bakerBarrel.useBreadcrumbsReader())

    expect(result.current).toHaveProperty('breadcrumbs')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('readBreadcrumbs')
    expect(result.current).toHaveProperty('clearBreadcrumbs')
    expect(typeof result.current.readBreadcrumbs).toBe('function')
    expect(typeof result.current.clearBreadcrumbs).toBe('function')
  })

  it('initializes with null breadcrumbs and no error', () => {
    const { result } = renderHook(() => bakerBarrel.useBreadcrumbsReader())

    expect(result.current.breadcrumbs).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('useProjectBreadcrumbs - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() => bakerBarrel.useProjectBreadcrumbs())

    expect(result.current).toHaveProperty('calculateFolderSize')
    expect(result.current).toHaveProperty('createBreadcrumbsData')
    expect(result.current).toHaveProperty('writeBreadcrumbsFile')
    expect(result.current).toHaveProperty('updateAppStore')
    expect(result.current).toHaveProperty('createAndSaveBreadcrumbs')
    expect(typeof result.current.calculateFolderSize).toBe('function')
    expect(typeof result.current.createBreadcrumbsData).toBe('function')
    expect(typeof result.current.writeBreadcrumbsFile).toBe('function')
    expect(typeof result.current.updateAppStore).toBe('function')
    expect(typeof result.current.createAndSaveBreadcrumbs).toBe('function')
  })
})

describe('useAppendBreadcrumbs - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() =>
      bakerBarrel.useAppendBreadcrumbs('test-key', 'test-token')
    )

    expect(result.current).toHaveProperty('getBreadcrumbsBlock')
    expect(result.current).toHaveProperty('applyBreadcrumbsToCard')
    expect(typeof result.current.getBreadcrumbsBlock).toBe('function')
    expect(typeof result.current.applyBreadcrumbsToCard).toBe('function')
  })
})

describe('useBreadcrumbsVideoLinks - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() =>
      bakerBarrel.useBreadcrumbsVideoLinks({ projectPath: '/test/path' })
    )

    expect(result.current).toHaveProperty('videoLinks')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('addVideoLink')
    expect(result.current).toHaveProperty('removeVideoLink')
    expect(result.current).toHaveProperty('reorderVideoLinks')
    expect(result.current).toHaveProperty('isUpdating')
  })
})

// --- No-Bypass Tests ---

describe('Baker Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/Baker')

  function getFilesRecursive(dir: string, extensions: string[]): string[] {
    const files: string[] = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__contracts__' || entry.name === 'node_modules') continue
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
      const tauriImports = lines.filter((line) => line.includes("from '@tauri-apps"))
      expect(tauriImports, `Found @tauri-apps import in ${file}`).toEqual([])
    }
  })

  it('no alert() calls in Baker module', () => {
    const allFiles = getFilesRecursive(modulePath, ['.ts', '.tsx'])
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const alertCalls = lines.filter(
        (line) =>
          line.includes('alert(') &&
          !line.includes('AlertCircle') &&
          !line.includes('AlertDescription') &&
          !line.includes('alert-') &&
          !line.includes('Alert,') &&
          !line.includes('Alert }')
      )
      expect(alertCalls, `Found alert() call in ${file}`).toEqual([])
    }
  })
})
