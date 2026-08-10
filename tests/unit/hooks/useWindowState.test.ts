/**
 * useWindowState Hook Tests
 * Purpose: Test window position and size persistence with throttling
 */

import { useWindowState } from '../../../src/shared/hooks/useWindowState'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Issue #144: the hook now no-ops outside the Tauri webview, so these
// in-Tauri behaviours need the bridge reported as present.
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true
}))

// Mock Tauri window API
const mockSetPosition = vi.fn()
const mockSetSize = vi.fn()
const mockOuterPosition = vi.fn()
const mockOuterSize = vi.fn()
const mockOnResized = vi.fn()
const mockOnMoved = vi.fn()

vi.mock('@tauri-apps/api/window', () => {
  // Physical, not Logical: saved geometry is in physical pixels, and restoring
  // it as logical multiplied it by the display scale factor on every launch.
  class MockPhysicalPosition {
    constructor(
      public x: number,
      public y: number
    ) {}
  }

  class MockPhysicalSize {
    constructor(
      public width: number,
      public height: number
    ) {}
  }

  return {
    getCurrentWindow: () => ({
      setPosition: mockSetPosition,
      setSize: mockSetSize,
      outerPosition: mockOuterPosition,
      outerSize: mockOuterSize,
      onResized: mockOnResized,
      onMoved: mockOnMoved
    }),
    PhysicalPosition: MockPhysicalPosition,
    PhysicalSize: MockPhysicalSize,
    // Restore is skipped without monitor bounds, so a display must be reported.
    currentMonitor: () =>
      Promise.resolve({
        position: { x: 0, y: 0 },
        size: { width: 2560, height: 1440 },
        scaleFactor: 2
      })
  }
})

describe('useWindowState', () => {
  const STORAGE_KEY = 'bucket-window-state-v2'

  // Mock localStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })

    // Default mock implementations
    mockOuterPosition.mockResolvedValue({ x: 100, y: 100 })
    mockOuterSize.mockResolvedValue({ width: 800, height: 600 })

    // Mock listeners to return unsubscribe functions
    mockOnResized.mockResolvedValue(vi.fn())
    mockOnMoved.mockResolvedValue(vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================================
  // Initialization and Restore Tests
  // ============================================================================

  describe('initialization', () => {
    it('should restore window position and size from localStorage', async () => {
      const savedState = JSON.stringify({
        x: 50,
        y: 50,
        width: 1024,
        height: 768
      })

      mockLocalStorage.getItem.mockReturnValue(savedState)

      renderHook(() => useWindowState())

      // Wait for async operations
      await vi.runAllTimersAsync()

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
      expect(mockSetPosition).toHaveBeenCalledWith(new PhysicalPosition(50, 50))
      expect(mockSetSize).toHaveBeenCalledWith(new PhysicalSize(1024, 768))
    })

    it('should not restore if no saved state exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
      expect(mockSetPosition).not.toHaveBeenCalled()
      expect(mockSetSize).not.toHaveBeenCalled()
    })

    it('should handle corrupted localStorage data gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockLocalStorage.getItem).toHaveBeenCalled()

      // Should not throw error
      expect(mockSetPosition).not.toHaveBeenCalled()
      expect(mockSetSize).not.toHaveBeenCalled()
    })

    it('should setup resize and move listeners', async () => {
      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnResized).toHaveBeenCalled()
      expect(mockOnMoved).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Performance/Throttling Tests (Critical for drag lag fix)
  // ============================================================================

  describe('throttling and performance', () => {
    it('should throttle saveWindowState calls during rapid moves', async () => {
      let moveCallback: () => void = () => {}

      // Capture the onMoved callback
      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      // Simulate rapid move events (100 in quick succession)
      for (let i = 0; i < 100; i++) {
        moveCallback()
      }

      // Fast-forward time to allow throttled saves
      await vi.runAllTimersAsync()

      // With throttling, should save WAY less than 100 times
      // Target: maximum 1 save per 500ms = ~10 saves in 5 seconds
      const saveCalls = mockLocalStorage.setItem.mock.calls.length
      expect(saveCalls).toBeLessThan(20)
    })

    it('should throttle saveWindowState calls during rapid resizes', async () => {
      let resizeCallback: () => void = () => {}

      mockOnResized.mockImplementation((callback: () => void) => {
        resizeCallback = callback
        return Promise.resolve(vi.fn())
      })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnResized).toHaveBeenCalled()

      // Simulate rapid resize events
      for (let i = 0; i < 100; i++) {
        resizeCallback()
      }

      await vi.runAllTimersAsync()

      const saveCalls = mockLocalStorage.setItem.mock.calls.length
      expect(saveCalls).toBeLessThan(20)
    })

    it('should use debouncing to save only after movement stops', async () => {
      let moveCallback: () => void = () => {}

      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      // Simulate continuous movement with short pauses
      moveCallback()
      await vi.advanceTimersByTimeAsync(100)
      moveCallback()
      await vi.advanceTimersByTimeAsync(100)
      moveCallback()

      // Now stop moving and wait for debounce to complete
      await vi.advanceTimersByTimeAsync(600)

      // Should have saved at least once after movement stopped
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should not trigger excessive IPC calls during drag', async () => {
      let moveCallback: () => void = () => {}

      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      const initialCalls = mockOuterPosition.mock.calls.length

      // Simulate drag (rapid movement)
      for (let i = 0; i < 50; i++) {
        moveCallback()
      }

      await vi.advanceTimersByTimeAsync(100)

      // Should throttle IPC calls (not 50 additional calls)
      const finalCalls = mockOuterPosition.mock.calls.length
      const additionalCalls = finalCalls - initialCalls

      expect(additionalCalls).toBeLessThan(10)
    })
  })

  // ============================================================================
  // Save Functionality Tests
  // ============================================================================

  describe('saving window state', () => {
    it('should save current position and size to localStorage', async () => {
      let moveCallback: () => void = () => {}

      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      mockOuterPosition.mockResolvedValue({ x: 200, y: 150 })
      mockOuterSize.mockResolvedValue({ width: 900, height: 700 })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      // Trigger save
      moveCallback()

      await vi.runAllTimersAsync()

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({
          x: 200,
          y: 150,
          width: 900,
          height: 700
        })
      )
    })

    it('should handle save errors gracefully', async () => {
      let moveCallback: () => void = () => {}

      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      mockOuterPosition.mockRejectedValue(new Error('Window error'))

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      // Trigger save - should not throw
      moveCallback()

      await vi.runAllTimersAsync()

      // Should fail silently
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('cleanup', () => {
    it('should unsubscribe from listeners on unmount', async () => {
      const unlistenResize = vi.fn()
      const unlistenMove = vi.fn()

      mockOnResized.mockResolvedValue(unlistenResize)
      mockOnMoved.mockResolvedValue(unlistenMove)

      const { unmount } = renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnResized).toHaveBeenCalled()
      expect(mockOnMoved).toHaveBeenCalled()

      unmount()

      await vi.runAllTimersAsync()

      expect(unlistenResize).toHaveBeenCalled()
      expect(unlistenMove).toHaveBeenCalled()
    })

    it('should handle cleanup if listeners not yet set up', () => {
      const { unmount } = renderHook(() => useWindowState())

      // Unmount immediately before listeners are set up
      expect(() => unmount()).not.toThrow()
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle zero values in window state', async () => {
      const savedState = JSON.stringify({
        x: 0,
        y: 0,
        width: 800,
        height: 600
      })

      mockLocalStorage.getItem.mockReturnValue(savedState)

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockSetPosition).toHaveBeenCalledWith(new PhysicalPosition(0, 0))
    })

    it('clamps a negative y so the title bar stays reachable', async () => {
      // A negative y hides the title bar behind the menu bar, leaving the
      // window impossible to drag back into view. x may stay negative as long
      // as part of the window remains grabbable.
      const savedState = JSON.stringify({
        x: -100,
        y: -50,
        width: 800,
        height: 600
      })

      mockLocalStorage.getItem.mockReturnValue(savedState)

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockSetPosition).toHaveBeenCalledWith(new PhysicalPosition(-100, 0))
    })

    it('should handle very large window dimensions', async () => {
      mockOuterPosition.mockResolvedValue({ x: 100, y: 100 })
      mockOuterSize.mockResolvedValue({ width: 5000, height: 3000 })

      let moveCallback: () => void = () => {}

      mockOnMoved.mockImplementation((callback: () => void) => {
        moveCallback = callback
        return Promise.resolve(vi.fn())
      })

      renderHook(() => useWindowState())

      await vi.runAllTimersAsync()

      expect(mockOnMoved).toHaveBeenCalled()

      moveCallback()
      await vi.runAllTimersAsync()

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"width":5000')
      )
    })
  })
})
