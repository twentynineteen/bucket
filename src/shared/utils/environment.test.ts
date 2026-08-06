/**
 * Tests for the Tauri runtime detection helper.
 * Issue #144 (B1.1, B1.2, B4.1-B4.3)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const isTauriMock = vi.fn()
const warnMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock()
}))

vi.mock('./logger', () => ({
  logger: {
    warn: (...args: unknown[]) => warnMock(...args),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  },
  createNamespacedLogger: () => ({
    warn: (...args: unknown[]) => warnMock(...args),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

/** Fresh module each time so the once-only warning flag starts unset. */
async function loadEnvironment() {
  vi.resetModules()
  return import('./environment')
}

beforeEach(() => {
  isTauriMock.mockReset()
  warnMock.mockReset()
})

describe('isTauriRuntime', () => {
  it('b1_1_is_true_inside_the_tauri_webview', async () => {
    isTauriMock.mockReturnValue(true)
    const { isTauriRuntime } = await loadEnvironment()

    expect(isTauriRuntime()).toBe(true)
  })

  it('b1_2_is_false_in_a_plain_browser', async () => {
    isTauriMock.mockReturnValue(false)
    const { isTauriRuntime } = await loadEnvironment()

    expect(isTauriRuntime()).toBe(false)
  })

  it('b1_2_is_false_when_the_detection_call_itself_throws', async () => {
    isTauriMock.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'metadata')")
    })
    const { isTauriRuntime } = await loadEnvironment()

    expect(isTauriRuntime()).toBe(false)
  })
})

describe('missing-runtime notice', () => {
  it('b4_1_warns_once_and_names_the_desktop_app', async () => {
    isTauriMock.mockReturnValue(false)
    const { isTauriRuntime } = await loadEnvironment()

    isTauriRuntime()

    expect(warnMock).toHaveBeenCalledTimes(1)
    expect(String(warnMock.mock.calls[0][0])).toMatch(/dev:tauri/)
  })

  it('b4_2_does_not_warn_again_on_later_calls', async () => {
    isTauriMock.mockReturnValue(false)
    const { isTauriRuntime } = await loadEnvironment()

    isTauriRuntime()
    isTauriRuntime()
    isTauriRuntime()

    expect(warnMock).toHaveBeenCalledTimes(1)
  })

  it('b4_3_never_warns_inside_the_desktop_app', async () => {
    isTauriMock.mockReturnValue(true)
    const { isTauriRuntime } = await loadEnvironment()

    isTauriRuntime()
    isTauriRuntime()

    expect(warnMock).not.toHaveBeenCalled()
  })
})
