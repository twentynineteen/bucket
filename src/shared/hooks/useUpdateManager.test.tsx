/**
 * Characterisation tests for useUpdateManager's restart flow.
 * Issue #164 (B1.3, B2.1, B2.2)
 *
 * These lock EXISTING frontend behaviour -- the TypeScript layer was never
 * the bug (the Rust side lacked the process plugin and capability, which the
 * updater-relaunch contract test now pins). If the restart flow regresses,
 * these fail; they were green before the Rust fix and must stay green after.
 *
 * Imported directly, not via the barrel: Tauri-dependent hooks are
 * deliberately excluded from @shared/hooks.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const askMock = vi.fn()
const messageMock = vi.fn()
const openUrlMock = vi.fn()
const relaunchMock = vi.fn()
const checkMock = vi.fn()
const downloadAndInstallMock = vi.fn()

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: (...args: unknown[]) => askMock(...args),
  message: (...args: unknown[]) => messageMock(...args)
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args)
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args)
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => checkMock(...args)
}))

vi.mock('./useVersionCheck', () => ({
  useVersionCheck: () => ({ refetch: vi.fn() })
}))

import { useUpdateManager } from './useUpdateManager'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  askMock.mockReset()
  messageMock.mockReset().mockResolvedValue(undefined)
  openUrlMock.mockReset().mockResolvedValue(undefined)
  relaunchMock.mockReset().mockResolvedValue(undefined)
  downloadAndInstallMock.mockReset().mockResolvedValue(undefined)
  checkMock.mockReset().mockResolvedValue({
    version: '9.9.9',
    date: '2026-08-10',
    body: 'notes',
    downloadAndInstall: (...args: unknown[]) => downloadAndInstallMock(...args)
  })
})

describe('useUpdateManager restart flow (characterisation)', () => {
  it('b1_3_confirming_restart_now_calls_relaunch', async () => {
    askMock.mockResolvedValue(true) // user clicks "Restart Now"

    const { result } = renderHook(() => useUpdateManager(), {
      wrapper: createWrapper()
    })
    await result.current.onUpdate()

    expect(downloadAndInstallMock).toHaveBeenCalled()
    await waitFor(() => expect(relaunchMock).toHaveBeenCalledTimes(1))
  })

  it('b2_1_successful_relaunch_shows_no_manual_restart_warning', async () => {
    askMock.mockResolvedValue(true)
    relaunchMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUpdateManager(), {
      wrapper: createWrapper()
    })
    await result.current.onUpdate()

    // Guard against vacuous passes: the restart path must actually run
    expect(relaunchMock).toHaveBeenCalled()
    const manualRestartCalls = messageMock.mock.calls.filter(
      ([, options]) =>
        (options as { title?: string } | undefined)?.title === 'Manual Restart Required'
    )
    expect(manualRestartCalls).toEqual([])
  })

  it('b2_2_failed_relaunch_falls_back_to_manual_restart_warning', async () => {
    askMock.mockResolvedValue(true)
    relaunchMock.mockRejectedValue(new Error('plugin process not found'))

    const { result } = renderHook(() => useUpdateManager(), {
      wrapper: createWrapper()
    })
    await result.current.onUpdate()

    await waitFor(() => {
      const manualRestartCalls = messageMock.mock.calls.filter(
        ([, options]) =>
          (options as { title?: string } | undefined)?.title === 'Manual Restart Required'
      )
      expect(manualRestartCalls).toHaveLength(1)
    })
  })

  it('b2_2b_restart_later_never_calls_relaunch', async () => {
    askMock.mockResolvedValue(false) // user clicks "Restart Later"

    const { result } = renderHook(() => useUpdateManager(), {
      wrapper: createWrapper()
    })
    await result.current.onUpdate()

    expect(relaunchMock).not.toHaveBeenCalled()
  })
})
