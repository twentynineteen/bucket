/**
 * Hooks Contract Tests
 *
 * Verifies the shape and behavior of the shared hooks barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import * as hooksBarrel from '../index'

// Mock Tauri core for useUsername (it calls invoke)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('test-user')
}))

// Mock storage for useApiKeys
vi.mock('@shared/utils/storage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({
    sproutVideo: 'sv-key',
    trello: 'tr-key',
    trelloToken: 'tr-token'
  })
}))

// Mock @shared/store for useBreadcrumb
const mockSetBreadcrumbs = vi.fn()
vi.mock('@shared/store', () => ({
  useBreadcrumbStore: vi.fn((selector: (state: { setBreadcrumbs: typeof mockSetBreadcrumbs }) => unknown) =>
    selector({ setBreadcrumbs: mockSetBreadcrumbs })
  )
}))

// Mock query infrastructure
vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    user: {
      breadcrumb: () => ['breadcrumb']
    }
  }
}))

vi.mock('@shared/lib/query-utils', () => ({
  createQueryOptions: (
    queryKey: string[],
    queryFn: () => Promise<unknown>,
    _type: string,
    opts: Record<string, unknown>
  ) => ({
    queryKey,
    queryFn,
    ...opts
  })
}))

vi.mock('@shared/constants/timing', () => ({
  CACHE: {
    STANDARD: 300000,
    GC_MEDIUM: 600000
  }
}))

// --- Shape Tests ---

describe('Hooks Barrel Exports - Shape', () => {
  it('exports useBreadcrumb as a function', () => {
    expect(typeof hooksBarrel.useBreadcrumb).toBe('function')
  })

  it('exports useReducedMotion as a function', () => {
    expect(typeof hooksBarrel.useReducedMotion).toBe('function')
  })

  it('exports useFuzzySearch as a function', () => {
    expect(typeof hooksBarrel.useFuzzySearch).toBe('function')
  })

  it('exports useUsername as a function', () => {
    expect(typeof hooksBarrel.useUsername).toBe('function')
  })

  it('exports useApiKeys as a function', () => {
    expect(typeof hooksBarrel.useApiKeys).toBe('function')
  })

  it('exports useSproutVideoApiKey as a function', () => {
    expect(typeof hooksBarrel.useSproutVideoApiKey).toBe('function')
  })

  it('exports useTrelloApiKeys as a function', () => {
    expect(typeof hooksBarrel.useTrelloApiKeys).toBe('function')
  })

  it('exports exactly the expected number of named exports', () => {
    const exportNames = Object.keys(hooksBarrel)
    expect(exportNames).toHaveLength(7)
    expect(exportNames.sort()).toEqual([
      'useApiKeys',
      'useBreadcrumb',
      'useFuzzySearch',
      'useReducedMotion',
      'useSproutVideoApiKey',
      'useTrelloApiKeys',
      'useUsername'
    ])
  })
})

// --- Behavioral Tests ---

describe('useReducedMotion - Behavior', () => {
  it('returns a boolean value', () => {
    const { result } = renderHook(() => hooksBarrel.useReducedMotion())
    expect(typeof result.current).toBe('boolean')
  })

  it('defaults to false when matchMedia returns no match', () => {
    // jsdom matchMedia mock returns matches: false by default
    const { result } = renderHook(() => hooksBarrel.useReducedMotion())
    expect(result.current).toBe(false)
  })
})

describe('useFuzzySearch - Behavior', () => {
  const sampleItems = [
    { name: 'Apple', category: 'fruit' },
    { name: 'Banana', category: 'fruit' },
    { name: 'Carrot', category: 'vegetable' }
  ]

  it('returns all items when search term is empty', () => {
    const { result } = renderHook(() =>
      hooksBarrel.useFuzzySearch(sampleItems, { keys: ['name'] })
    )
    expect(result.current.results).toEqual(sampleItems)
    expect(result.current.searchTerm).toBe('')
  })

  it('provides setSearchTerm function', () => {
    const { result } = renderHook(() =>
      hooksBarrel.useFuzzySearch(sampleItems, { keys: ['name'] })
    )
    expect(typeof result.current.setSearchTerm).toBe('function')
  })

  it('filters results when search term is set', () => {
    const { result } = renderHook(() =>
      hooksBarrel.useFuzzySearch(sampleItems, { keys: ['name'] })
    )

    act(() => {
      result.current.setSearchTerm('Apple')
    })

    expect(result.current.results.length).toBe(1)
    expect(result.current.results[0].name).toBe('Apple')
  })

  it('returns empty array when no matches found', () => {
    const { result } = renderHook(() =>
      hooksBarrel.useFuzzySearch(sampleItems, { keys: ['name'] })
    )

    act(() => {
      result.current.setSearchTerm('zzzznotfound')
    })

    expect(result.current.results).toHaveLength(0)
  })
})
