/**
 * Contract Test: baker_get_scan_status Tauri Command
 *
 * This test verifies the contract for the baker_get_scan_status command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import type { ScanResult } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { beforeAll, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_get_scan_status Contract', () => {
  let mockScanId: string

  beforeAll(async () => {
    // Initialize Tauri mocks
    setupTauriMocks()

    // Start a scan to get a valid scan ID for testing
    mockScanId = await invoke('baker_start_scan', {
      rootPath: '/Users/test/Documents',
      options: {
        maxDepth: 3,
        includeHidden: false,
        createMissing: false,
        backupOriginals: false
      }
    })
  })

  test('should return scan result for valid scan ID', async () => {
    const result: ScanResult = await invoke('baker_get_scan_status', {
      scanId: mockScanId
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')

    // Verify ScanResult structure
    expect(result).toHaveProperty('startTime')
    expect(result).toHaveProperty('rootPath')
    expect(result).toHaveProperty('totalFolders')
    expect(result).toHaveProperty('validProjects')
    expect(result).toHaveProperty('updatedBreadcrumbs')
    expect(result).toHaveProperty('createdBreadcrumbs')
    expect(result).toHaveProperty('errors')
    expect(result).toHaveProperty('projects')

    // Verify data types
    expect(typeof result.startTime).toBe('string')
    expect(typeof result.rootPath).toBe('string')
    expect(typeof result.totalFolders).toBe('number')
    expect(typeof result.validProjects).toBe('number')
    expect(Array.isArray(result.errors)).toBe(true)
    expect(Array.isArray(result.projects)).toBe(true)
  })

  test('should reject when scan ID is invalid', async () => {
    await expect(
      invoke('baker_get_scan_status', {
        scanId: 'invalid-scan-id'
      })
    ).rejects.toThrow()
  })

  test('should reject when scan ID is empty', async () => {
    await expect(
      invoke('baker_get_scan_status', {
        scanId: ''
      })
    ).rejects.toThrow()
  })

  test('should handle completed scan correctly', async () => {
    // Wait for scan to complete (in real implementation)
    await new Promise(resolve => setTimeout(resolve, 100))

    const result: ScanResult = await invoke('baker_get_scan_status', {
      scanId: mockScanId
    })

    // If scan is complete, should have endTime
    if (result.endTime) {
      expect(typeof result.endTime).toBe('string')
      expect(new Date(result.endTime).getTime()).toBeGreaterThan(
        new Date(result.startTime).getTime()
      )
    }
  })

  test('should include error details when scan encounters issues', async () => {
    const result: ScanResult = await invoke('baker_get_scan_status', {
      scanId: mockScanId
    })

    // Verify error structure if errors exist
    if (result.errors.length > 0) {
      const error = result.errors[0]
      expect(error).toHaveProperty('path')
      expect(error).toHaveProperty('type')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('timestamp')

      expect(['permission', 'structure', 'filesystem', 'corruption']).toContain(
        error.type
      )
    }
  })
})
