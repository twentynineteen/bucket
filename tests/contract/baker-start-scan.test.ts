/**
 * Contract Test: baker_start_scan Tauri Command
 *
 * This test verifies the contract for the baker_start_scan command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import type { ScanOptions } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { beforeAll, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_start_scan Contract', () => {
  beforeAll(() => {
    setupTauriMocks()
  })
  const mockRootPath = '/Users/test/Documents/TestProjects'
  const mockScanOptions: ScanOptions = {
    maxDepth: 5,
    includeHidden: false,
    createMissing: true,
    backupOriginals: true
  }

  beforeAll(() => {
    // This test requires the Tauri app to be running
    // In a real environment, this would be handled by test setup
  })

  test('should return scan ID when valid parameters are provided', async () => {
    const result = await invoke('baker_start_scan', {
      rootPath: mockRootPath,
      options: mockScanOptions
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // Scan ID should be a UUID or similar identifier
    expect(result).toMatch(/^[a-f0-9-]+$/i)
  })

  test('should reject when root path is empty', async () => {
    await expect(
      invoke('baker_start_scan', {
        rootPath: '',
        options: mockScanOptions
      })
    ).rejects.toThrow()
  })

  test('should reject when root path does not exist', async () => {
    await expect(
      invoke('baker_start_scan', {
        rootPath: '/non/existent/path',
        options: mockScanOptions
      })
    ).rejects.toThrow()
  })

  test('should reject when options are invalid', async () => {
    const invalidOptions = {
      maxDepth: -1,
      includeHidden: false,
      createMissing: true,
      backupOriginals: true
    }

    await expect(
      invoke('baker_start_scan', {
        rootPath: mockRootPath,
        options: invalidOptions
      })
    ).rejects.toThrow()
  })

  test('should handle permission denied gracefully', async () => {
    // Test with a system directory that requires elevated permissions
    const restrictedPath = '/System'

    const result = await invoke('baker_start_scan', {
      rootPath: restrictedPath,
      options: mockScanOptions
    })

    // Should still return a scan ID even if some folders are inaccessible
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })
})
