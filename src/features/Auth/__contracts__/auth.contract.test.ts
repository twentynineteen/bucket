/**
 * Auth Contract Tests
 *
 * Verifies the shape and behavior of the Auth feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import fs from 'node:fs'
import path from 'node:path'

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Auth I/O)
vi.mock('../api', () => ({
  addToken: vi.fn().mockResolvedValue(undefined),
  checkAuth: vi.fn().mockResolvedValue('authenticated'),
  getStoredToken: vi.fn().mockReturnValue('test-token'),
  getStoredUsername: vi.fn().mockReturnValue('test-user'),
  setStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn()
}))

// Mock shared dependencies
vi.mock('@shared/constants/timing', () => ({
  CACHE: {
    STANDARD: 300000
  }
}))

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
  useQuery: vi.fn().mockReturnValue({
    data: { isAuthenticated: true, username: 'test-user' },
    isLoading: false,
    error: null
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn()
  })
}))

import * as authBarrel from '../index'

// --- Shape Tests ---

describe('Auth Barrel Exports - Shape', () => {
  it('exports AuthProvider as a function', () => {
    expect(typeof authBarrel.AuthProvider).toBe('function')
  })

  it('exports useAuth as a function', () => {
    expect(typeof authBarrel.useAuth).toBe('function')
  })

  it('exports useAuthCheck as a function', () => {
    expect(typeof authBarrel.useAuthCheck).toBe('function')
  })

  it('exports Login as a function', () => {
    expect(typeof authBarrel.Login).toBe('function')
  })

  it('exports Register as a function', () => {
    expect(typeof authBarrel.Register).toBe('function')
  })

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(authBarrel)
    expect(exportNames.sort()).toEqual([
      'AuthProvider',
      'Login',
      'Register',
      'useAuth',
      'useAuthCheck'
    ])
  })
})

// --- Behavioral Tests ---

describe('useAuth - Behavior', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => authBarrel.useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })
})

describe('useAuthCheck - Behavior', () => {
  it('calls useQuery with correct config', async () => {
    const { useQuery } = vi.mocked(await import('@tanstack/react-query'))

    // Clear previous calls
    useQuery.mockClear()

    renderHook(() => authBarrel.useAuthCheck())

    // useQuery was called with correct config
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['authCheck'],
        retry: 1,
        refetchOnWindowFocus: false
      })
    )
  })

  it('passes a queryFn that checks auth status', async () => {
    const { useQuery } = vi.mocked(await import('@tanstack/react-query'))

    useQuery.mockClear()
    renderHook(() => authBarrel.useAuthCheck())

    // Verify queryFn is provided
    const callArgs = useQuery.mock.calls[0]?.[0]
    expect(callArgs).toBeDefined()
    expect(typeof callArgs.queryFn).toBe('function')
  })
})

// --- No-Bypass Tests ---

describe('Auth Module - No Direct Plugin Imports', () => {
  const projectRoot = path.resolve(__dirname, '../../../../')
  const modulePath = path.resolve(projectRoot, 'src/features/Auth')

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
