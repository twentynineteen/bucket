/**
 * Contract Test: baker_read_breadcrumbs Tauri Command
 *
 * This test verifies the contract for the baker_read_breadcrumbs command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import { resolve } from 'path'
import type { BreadcrumbsFile } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { beforeAll, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_read_breadcrumbs Contract', () => {
  const testDataPath = resolve(__dirname, '../fixtures/baker-test-data')

  beforeAll(() => {
    setupTauriMocks()
  })

  test('should read valid breadcrumbs.json file', async () => {
    const projectPath = resolve(testDataPath, 'TestProject1')

    const result: BreadcrumbsFile = await invoke('baker_read_breadcrumbs', {
      projectPath
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')

    // Verify BreadcrumbsFile structure
    expect(result).toHaveProperty('projectTitle', 'TestProject1')
    expect(result).toHaveProperty('numberOfCameras', 1)
    expect(result).toHaveProperty('files')
    expect(result).toHaveProperty('parentFolder')
    expect(result).toHaveProperty('createdBy', 'test-user')
    expect(result).toHaveProperty('creationDateTime')

    // Verify files array structure
    expect(Array.isArray(result.files)).toBe(true)
    expect(result.files.length).toBeGreaterThan(0)

    const fileInfo = result.files[0]
    expect(fileInfo).toHaveProperty('camera')
    expect(fileInfo).toHaveProperty('name')
    expect(fileInfo).toHaveProperty('path')
    expect(typeof fileInfo.camera).toBe('number')
    expect(typeof fileInfo.name).toBe('string')
    expect(typeof fileInfo.path).toBe('string')
  })

  test('should return null when breadcrumbs.json does not exist', async () => {
    const projectPath = resolve(testDataPath, 'TestProject2')

    const result = await invoke('baker_read_breadcrumbs', {
      projectPath
    })

    expect(result).toBeNull()
  })

  test('should handle corrupted breadcrumbs.json file', async () => {
    const corruptedPath = resolve(testDataPath, 'CorruptedProject')

    await expect(
      invoke('baker_read_breadcrumbs', {
        projectPath: corruptedPath
      })
    ).rejects.toThrow()
  })

  test('should reject when project path does not exist', async () => {
    const nonExistentPath = '/path/that/does/not/exist'

    await expect(
      invoke('baker_read_breadcrumbs', {
        projectPath: nonExistentPath
      })
    ).rejects.toThrow()
  })

  test('should reject when project path is empty', async () => {
    await expect(
      invoke('baker_read_breadcrumbs', {
        projectPath: ''
      })
    ).rejects.toThrow()
  })

  test('should validate timestamp formats in breadcrumbs data', async () => {
    const projectPath = resolve(testDataPath, 'TestProject1')

    const result: BreadcrumbsFile = await invoke('baker_read_breadcrumbs', {
      projectPath
    })

    expect(result.creationDateTime).toBeDefined()
    expect(() => new Date(result.creationDateTime)).not.toThrow()
    expect(new Date(result.creationDateTime).getTime()).not.toBeNaN()

    // Optional fields should be valid if present
    if (result.lastModified) {
      expect(() => new Date(result.lastModified)).not.toThrow()
    }
  })

  test('should handle breadcrumbs with Baker-added fields', async () => {
    // This test assumes a breadcrumbs file with Baker's optional fields
    const projectPath = resolve(testDataPath, 'TestProject1')

    const result: BreadcrumbsFile = await invoke('baker_read_breadcrumbs', {
      projectPath
    })

    // Optional Baker fields should be properly typed if present
    if (result.lastModified) {
      expect(typeof result.lastModified).toBe('string')
    }
    if (result.scannedBy) {
      expect(typeof result.scannedBy).toBe('string')
    }
  })

  test('should validate camera number ranges', async () => {
    const projectPath = resolve(testDataPath, 'TestProject1')

    const result: BreadcrumbsFile = await invoke('baker_read_breadcrumbs', {
      projectPath
    })

    // All camera numbers should be within valid range
    result.files.forEach(file => {
      expect(file.camera).toBeGreaterThan(0)
      expect(file.camera).toBeLessThanOrEqual(result.numberOfCameras)
    })
  })
})
