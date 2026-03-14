/**
 * Premiere Contract Tests
 *
 * Verifies the shape and behavior of the Premiere feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Premiere I/O)
vi.mock('../api', () => ({
  getAvailablePlugins: vi.fn().mockResolvedValue([]),
  installPlugin: vi.fn().mockResolvedValue({
    success: true,
    message: 'ok',
    pluginName: 'test',
    installedPath: '/path'
  }),
  openCepFolder: vi.fn().mockResolvedValue(undefined),
  showConfirmationDialog: vi.fn().mockResolvedValue(undefined),
  copyPremiereProject: vi.fn().mockResolvedValue('/path/to/project')
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

vi.mock('@shared/hooks', () => ({
  useBreadcrumb: vi.fn()
}))

// Mock React Query (for PremierePluginManager component)
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    variables: null
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn()
  })
}))

import * as premiereBarrel from '../index'

// --- Shape Tests ---

describe('Premiere Barrel Exports - Shape', () => {
  it('exports PremierePluginManager as a function', () => {
    expect(typeof premiereBarrel.PremierePluginManager).toBe('function')
  })

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(premiereBarrel)
    expect(exportNames.sort()).toEqual(['PremierePluginManager'])
  })

  it('exports exactly 1 member', () => {
    expect(Object.keys(premiereBarrel)).toHaveLength(1)
  })
})

// --- No-Bypass Tests ---

describe('Premiere Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/Premiere')

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
      expect(tauriImports).toEqual([])
    }
  })
})
