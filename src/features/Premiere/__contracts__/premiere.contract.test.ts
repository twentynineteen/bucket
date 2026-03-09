/**
 * Premiere Contract Tests
 *
 * Verifies the shape and behavior of the Premiere feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { renderHook } from '@testing-library/react'
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
  }
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
    expect(typeof premiereBarrel.PremierePluginManager).toBe(
      'function'
    )
  })

  it('exports usePremiereIntegration as a function', () => {
    expect(typeof premiereBarrel.usePremiereIntegration).toBe(
      'function'
    )
  })

  it('exports exactly the expected named exports', () => {
    const exportNames = Object.keys(premiereBarrel)
    expect(exportNames.sort()).toEqual([
      'PremierePluginManager',
      'usePremiereIntegration'
    ])
  })
})

// --- Behavioral Tests ---

describe('usePremiereIntegration - Behavior', () => {
  it('returns copyPremiereTemplate function', () => {
    const { result } = renderHook(() =>
      premiereBarrel.usePremiereIntegration()
    )
    expect(typeof result.current.copyPremiereTemplate).toBe(
      'function'
    )
  })

  it('returns showCompletionDialog function', () => {
    const { result } = renderHook(() =>
      premiereBarrel.usePremiereIntegration()
    )
    expect(typeof result.current.showCompletionDialog).toBe(
      'function'
    )
  })

  it('returns handlePostCompletion function', () => {
    const { result } = renderHook(() =>
      premiereBarrel.usePremiereIntegration()
    )
    expect(typeof result.current.handlePostCompletion).toBe(
      'function'
    )
  })

  it('calls copyPremiereProject via api layer', async () => {
    const { copyPremiereProject } = await import('../api')
    const { result } = renderHook(() =>
      premiereBarrel.usePremiereIntegration()
    )

    const setLoading = vi.fn()
    const setMessage = vi.fn()

    await result.current.copyPremiereTemplate({
      projectFolder: '/test',
      projectTitle: 'Test Project',
      setLoading,
      setMessage
    })

    expect(copyPremiereProject).toHaveBeenCalledWith(
      '/test/Projects/',
      'Test Project'
    )
    expect(setLoading).toHaveBeenCalledWith(true)
    expect(setLoading).toHaveBeenCalledWith(false)
  })
})
