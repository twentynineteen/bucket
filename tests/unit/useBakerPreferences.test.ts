/**
 * Unit Test: useBakerPreferences React Hook
 *
 * This test verifies the useBakerPreferences custom hook behavior.
 * It MUST FAIL initially until the hook implementation is complete.
 */

import type { ScanPreferences } from '@/types/baker'
import { useBakerPreferences } from '@hooks/useBakerPreferences'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('useBakerPreferences Hook', () => {
  const defaultPreferences: ScanPreferences = {
    autoUpdate: false,
    createMissing: true,
    backupOriginals: true,
    maxDepth: 10,
    includeHidden: false,
    confirmBulkOperations: true
  }

  const customPreferences: ScanPreferences = {
    autoUpdate: true,
    createMissing: false,
    backupOriginals: false,
    maxDepth: 5,
    includeHidden: true,
    confirmBulkOperations: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should initialize with default preferences when localStorage is empty', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useBakerPreferences())

    expect(result.current.preferences).toEqual(defaultPreferences)
    expect(typeof result.current.updatePreferences).toBe('function')
    expect(typeof result.current.resetToDefaults).toBe('function')
  })

  test('should load preferences from localStorage if available', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(customPreferences))

    const { result } = renderHook(() => useBakerPreferences())

    expect(result.current.preferences).toEqual(customPreferences)
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('baker-preferences')
  })

  test('should handle corrupted localStorage data gracefully', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid json data')

    const { result } = renderHook(() => useBakerPreferences())

    // Should fall back to defaults when JSON parsing fails
    expect(result.current.preferences).toEqual(defaultPreferences)
  })

  test('should update individual preference fields', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        autoUpdate: true,
        maxDepth: 15
      })
    })

    expect(result.current.preferences).toEqual({
      ...defaultPreferences,
      autoUpdate: true,
      maxDepth: 15
    })

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'baker-preferences',
      JSON.stringify({
        ...defaultPreferences,
        autoUpdate: true,
        maxDepth: 15
      })
    )
  })

  test('should validate preference values', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        maxDepth: -5 // Invalid negative depth
      })
    })

    // Should not update with invalid value
    expect(result.current.preferences.maxDepth).toBe(defaultPreferences.maxDepth)
  })

  test('should reset preferences to defaults', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(customPreferences))

    const { result } = renderHook(() => useBakerPreferences())

    // Initially should have custom preferences
    expect(result.current.preferences).toEqual(customPreferences)

    act(() => {
      result.current.resetToDefaults()
    })

    expect(result.current.preferences).toEqual(defaultPreferences)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'baker-preferences',
      JSON.stringify(defaultPreferences)
    )
  })

  test('should handle localStorage errors gracefully', () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded')
    })

    const { result } = renderHook(() => useBakerPreferences())

    // Should not throw error even if localStorage fails
    expect(() => {
      act(() => {
        result.current.updatePreferences({ autoUpdate: true })
      })
    }).not.toThrow()

    // State should still be updated even if persistence fails
    expect(result.current.preferences.autoUpdate).toBe(true)
  })

  test('should merge partial preference updates correctly', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(customPreferences))

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        createMissing: true // Only update this field
      })
    })

    expect(result.current.preferences).toEqual({
      ...customPreferences,
      createMissing: true
    })
  })

  test('should validate boolean preferences', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        autoUpdate: 'invalid' as any,
        createMissing: true
      })
    })

    // Should only update valid boolean value
    expect(result.current.preferences.autoUpdate).toBe(defaultPreferences.autoUpdate)
    expect(result.current.preferences.createMissing).toBe(true)
  })

  test('should validate numeric preferences with ranges', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        maxDepth: 1000 // Very large depth
      })
    })

    // Should cap at reasonable maximum
    expect(result.current.preferences.maxDepth).toBeLessThanOrEqual(100)
  })

  test('should preserve existing preferences not being updated', () => {
    const initialPrefs = {
      ...defaultPreferences,
      autoUpdate: true,
      maxDepth: 20
    }

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialPrefs))

    const { result } = renderHook(() => useBakerPreferences())

    act(() => {
      result.current.updatePreferences({
        createMissing: false
      })
    })

    expect(result.current.preferences).toEqual({
      ...initialPrefs,
      createMissing: false
    })
  })
})
