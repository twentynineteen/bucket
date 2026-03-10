/**
 * AITools Contract Tests
 *
 * Verifies the shape and behavior of the AITools feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all AITools I/O)
vi.mock('../api', () => ({
  getAllExamples: vi.fn().mockResolvedValue([]),
  uploadExample: vi.fn().mockResolvedValue('new-id'),
  replaceExample: vi.fn().mockResolvedValue(undefined),
  deleteExample: vi.fn().mockResolvedValue(undefined),
  searchSimilarScripts: vi.fn().mockResolvedValue([]),
  openScriptFileDialog: vi.fn().mockResolvedValue(null),
  saveDocxDialog: vi.fn().mockResolvedValue(null),
  readScriptFile: vi.fn().mockResolvedValue(''),
  writeDocxFile: vi.fn().mockResolvedValue(undefined),
  checkOllamaModels: vi.fn().mockResolvedValue({ models: [] }),
  generateOllamaEmbedding: vi.fn().mockResolvedValue([]),
  createAIModel: vi.fn(),
  listAIProviders: vi.fn().mockReturnValue([]),
  getAIProvider: vi.fn().mockReturnValue(undefined),
  openDocxFileDialog: vi.fn().mockResolvedValue(null),
  exportExampleDialog: vi.fn().mockResolvedValue(null),
  readDocxFile: vi.fn().mockResolvedValue(new Uint8Array()),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  writeTextToFile: vi.fn().mockResolvedValue(undefined)
}))

// Mock Tauri plugins (transitive dependencies)
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeTextFile: vi.fn()
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

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null
  }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn()
  })
}))

import * as aitoolsBarrel from '../index'
import * as api from '../api'

// --- Shape Tests: Barrel ---

describe('AITools Barrel Exports - Shape', () => {
  const expectedExports = [
    'ExampleEmbeddings',
    'ScriptFormatter',
    'useExampleManagement',
    'useScriptFileUpload',
    'useScriptFormatterState'
  ].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    const exportNames = Object.keys(aitoolsBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('ExampleEmbeddings is a valid React component', () => {
    expect(typeof aitoolsBarrel.ExampleEmbeddings).toBe('function')
  })

  it('ScriptFormatter is a valid React component', () => {
    expect(typeof aitoolsBarrel.ScriptFormatter).toBe('function')
  })

  it('useExampleManagement is a function', () => {
    expect(typeof aitoolsBarrel.useExampleManagement).toBe('function')
  })

  it('useScriptFileUpload is a function', () => {
    expect(typeof aitoolsBarrel.useScriptFileUpload).toBe('function')
  })

  it('useScriptFormatterState is a function', () => {
    expect(typeof aitoolsBarrel.useScriptFormatterState).toBe('function')
  })

  it('does not leak internal hooks through barrel', () => {
    const exportNames = Object.keys(aitoolsBarrel)
    // These internal hooks should NOT be accessible from the barrel
    const internalHooks = [
      'useScriptProcessor',
      'useEmbedding',
      'useOllamaEmbedding',
      'useScriptRetrieval',
      'useScriptUpload',
      'useScriptDownload',
      'useScriptReview',
      'useScriptWorkflow',
      'useAIModels',
      'useAIProcessing',
      'useDocxParser',
      'useDocxGenerator',
      'useUploadDialogForm'
    ]
    internalHooks.forEach((hookName) => {
      expect(exportNames).not.toContain(hookName)
    })
  })
})

// --- Shape Tests: API Layer ---

describe('AITools API Layer - Shape', () => {
  const expectedFunctions = [
    'getAllExamples',
    'uploadExample',
    'replaceExample',
    'deleteExample',
    'searchSimilarScripts',
    'openScriptFileDialog',
    'openDocxFileDialog',
    'exportExampleDialog',
    'saveDocxDialog',
    'readScriptFile',
    'writeDocxFile',
    'readDocxFile',
    'createDirectory',
    'writeTextToFile',
    'checkOllamaModels',
    'generateOllamaEmbedding',
    'createAIModel',
    'listAIProviders',
    'getAIProvider'
  ]

  it('exports all 19 expected functions', () => {
    expectedFunctions.forEach((name) => {
      expect(typeof (api as Record<string, unknown>)[name]).toBe('function')
    })
  })

  it('exports exactly 19 functions (no extras)', () => {
    const apiExportNames = Object.keys(api).sort()
    expect(apiExportNames).toEqual(expectedFunctions.sort())
  })
})

// --- Behavioral Tests: useExampleManagement ---

describe('AITools useExampleManagement - Behavior', () => {
  it('returns expected hook shape', () => {
    const { result } = renderHook(() => aitoolsBarrel.useExampleManagement())

    expect(result.current).toHaveProperty('examples')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refetch')
    expect(result.current).toHaveProperty('uploadExample')
    expect(result.current).toHaveProperty('replaceExample')
    expect(result.current).toHaveProperty('deleteExample')
  })

  it('examples defaults to an empty array', () => {
    const { result } = renderHook(() => aitoolsBarrel.useExampleManagement())
    expect(Array.isArray(result.current.examples)).toBe(true)
    expect(result.current.examples).toHaveLength(0)
  })

  it('isLoading defaults to false', () => {
    const { result } = renderHook(() => aitoolsBarrel.useExampleManagement())
    expect(result.current.isLoading).toBe(false)
  })

  it('mutations have mutate function', () => {
    const { result } = renderHook(() => aitoolsBarrel.useExampleManagement())
    expect(typeof result.current.uploadExample.mutate).toBe('function')
    expect(typeof result.current.replaceExample.mutate).toBe('function')
    expect(typeof result.current.deleteExample.mutate).toBe('function')
  })
})

// --- Behavioral Tests: useScriptFileUpload ---

describe('AITools useScriptFileUpload - Behavior', () => {
  it('returns expected hook shape', () => {
    const { result } = renderHook(() => aitoolsBarrel.useScriptFileUpload())

    expect(result.current).toHaveProperty('isReading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('selectFile')
    expect(result.current).toHaveProperty('readFileContent')
    expect(result.current).toHaveProperty('validateFile')
  })

  it('isReading defaults to false', () => {
    const { result } = renderHook(() => aitoolsBarrel.useScriptFileUpload())
    expect(result.current.isReading).toBe(false)
  })

  it('error defaults to null', () => {
    const { result } = renderHook(() => aitoolsBarrel.useScriptFileUpload())
    expect(result.current.error).toBeNull()
  })

  it('selectFile is an async function', () => {
    const { result } = renderHook(() => aitoolsBarrel.useScriptFileUpload())
    expect(typeof result.current.selectFile).toBe('function')
  })

  it('validateFile is a function', () => {
    const { result } = renderHook(() => aitoolsBarrel.useScriptFileUpload())
    expect(typeof result.current.validateFile).toBe('function')
  })
})

// --- No-Bypass Tests ---

describe('AITools Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/AITools')

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
