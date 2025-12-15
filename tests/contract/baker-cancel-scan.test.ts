/**
 * Contract Test: baker_cancel_scan Tauri Command
 *
 * This test verifies the contract for the baker_cancel_scan command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_cancel_scan Contract', () => {
  let scanId: string

  beforeEach(async () => {
    // Initialize Tauri mocks
    setupTauriMocks()

    // Start a scan for each test
    scanId = await invoke('baker_start_scan', {
      rootPath: '/Users/test/Documents',
      options: {
        maxDepth: 10,
        includeHidden: false,
        createMissing: false,
        backupOriginals: false
      }
    })
  })

  test('should successfully cancel an ongoing scan', async () => {
    const result = await invoke('baker_cancel_scan', {
      scanId
    })

    // Command should complete without error
    expect(result).toBeUndefined()

    // Verify scan status shows cancelled/stopped
    const status = await invoke('baker_get_scan_status', {
      scanId
    })

    // Should have endTime set when cancelled
    expect(status.endTime).toBeDefined()
  })

  test('should reject when scan ID is invalid', async () => {
    await expect(
      invoke('baker_cancel_scan', {
        scanId: 'invalid-scan-id'
      })
    ).rejects.toThrow()
  })

  test('should reject when scan ID is empty', async () => {
    await expect(
      invoke('baker_cancel_scan', {
        scanId: ''
      })
    ).rejects.toThrow()
  })

  test('should handle cancelling already completed scan', async () => {
    // Let the scan complete naturally first
    await new Promise(resolve => setTimeout(resolve, 50))

    // Then try to cancel
    const result = await invoke('baker_cancel_scan', {
      scanId
    })

    // Should not throw error, just no-op
    expect(result).toBeUndefined()
  })

  test('should handle multiple cancel requests for same scan', async () => {
    // Cancel once
    await invoke('baker_cancel_scan', { scanId })

    // Cancel again - should not throw error
    const result = await invoke('baker_cancel_scan', { scanId })
    expect(result).toBeUndefined()
  })
})
