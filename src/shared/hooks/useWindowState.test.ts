/**
 * Tests for useWindowState's behaviour with and without the Tauri bridge.
 * Issue #144 (B2.1-B2.3)
 */

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const isTauriMock = vi.fn()
const getCurrentWindowMock = vi.fn()
const onResizedMock = vi.fn()
const onMovedMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => getCurrentWindowMock(),
  // Physical, not Logical -- see the note on WindowState in the hook.
  PhysicalPosition: class {
    constructor(
      public x: number,
      public y: number
    ) {}
  },
  PhysicalSize: class {
    constructor(
      public width: number,
      public height: number
    ) {}
  },
  currentMonitor: () =>
    Promise.resolve({
      position: { x: 0, y: 0 },
      size: { width: 2560, height: 1440 },
      scaleFactor: 2
    })
}))

import { useWindowState } from './useWindowState'

beforeEach(() => {
  localStorage.clear()
  isTauriMock.mockReset()
  getCurrentWindowMock.mockReset()
  onResizedMock.mockReset().mockResolvedValue(() => {})
  onMovedMock.mockReset().mockResolvedValue(() => {})
  getCurrentWindowMock.mockReturnValue({
    setPosition: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    onResized: (cb: () => void) => onResizedMock(cb),
    onMoved: (cb: () => void) => onMovedMock(cb)
  })
})

describe('useWindowState outside the Tauri webview', () => {
  it('b2_1_does_not_throw_when_there_is_no_bridge', () => {
    isTauriMock.mockReturnValue(false)

    expect(() => renderHook(() => useWindowState())).not.toThrow()
  })

  it('b2_2_never_asks_for_the_current_window', () => {
    isTauriMock.mockReturnValue(false)

    renderHook(() => useWindowState())

    expect(getCurrentWindowMock).not.toHaveBeenCalled()
  })

  it('b2_2_registers_no_listeners', () => {
    isTauriMock.mockReturnValue(false)

    renderHook(() => useWindowState())

    expect(onResizedMock).not.toHaveBeenCalled()
    expect(onMovedMock).not.toHaveBeenCalled()
  })
})

describe('useWindowState inside the Tauri webview', () => {
  it('b2_3_reads_the_current_window_and_registers_listeners', async () => {
    isTauriMock.mockReturnValue(true)

    renderHook(() => useWindowState())

    expect(getCurrentWindowMock).toHaveBeenCalled()
    await waitFor(() => {
      expect(onResizedMock).toHaveBeenCalled()
      expect(onMovedMock).toHaveBeenCalled()
    })
  })

  it('b2_3_restores_a_saved_window_state', async () => {
    isTauriMock.mockReturnValue(true)
    localStorage.setItem(
      'bucket-window-state-v2',
      JSON.stringify({ x: 10, y: 20, width: 1024, height: 768 })
    )

    renderHook(() => useWindowState())

    const tauriWindow = getCurrentWindowMock.mock.results[0].value
    await waitFor(() => {
      expect(tauriWindow.setPosition).toHaveBeenCalled()
      expect(tauriWindow.setSize).toHaveBeenCalled()
    })
  })
})
