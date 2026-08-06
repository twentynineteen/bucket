/**
 * Tests for useSystemTheme's behaviour with and without the Tauri bridge.
 * Issue #144 (B3.1-B3.3)
 */

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const isTauriMock = vi.fn()
const getCurrentWindowMock = vi.fn()
const themeMock = vi.fn()
const onThemeChangedMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => getCurrentWindowMock()
}))

import { useSystemTheme } from './useSystemTheme'

beforeEach(() => {
  isTauriMock.mockReset()
  getCurrentWindowMock.mockReset()
  themeMock.mockReset().mockResolvedValue('dark')
  onThemeChangedMock.mockReset().mockResolvedValue(() => {})
  getCurrentWindowMock.mockReturnValue({
    theme: () => themeMock(),
    onThemeChanged: (cb: (event: { payload: string }) => void) => onThemeChangedMock(cb)
  })
})

describe('useSystemTheme outside the Tauri webview', () => {
  it('b3_1_does_not_throw_and_reports_no_theme', () => {
    isTauriMock.mockReturnValue(false)

    const { result } = renderHook(() => useSystemTheme())

    expect(result.current).toBeNull()
  })

  it('b3_2_never_asks_for_the_current_window', () => {
    isTauriMock.mockReturnValue(false)

    renderHook(() => useSystemTheme())

    expect(getCurrentWindowMock).not.toHaveBeenCalled()
    expect(onThemeChangedMock).not.toHaveBeenCalled()
  })
})

describe('useSystemTheme inside the Tauri webview', () => {
  it('b3_3_reads_the_window_theme', async () => {
    isTauriMock.mockReturnValue(true)

    const { result } = renderHook(() => useSystemTheme())

    await waitFor(() => expect(result.current).toBe('dark'))
    expect(themeMock).toHaveBeenCalled()
  })

  it('b3_3_subscribes_to_theme_changes', async () => {
    isTauriMock.mockReturnValue(true)

    renderHook(() => useSystemTheme())

    await waitFor(() => expect(onThemeChangedMock).toHaveBeenCalled())
  })
})
