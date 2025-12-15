/**
 * Contract Test: baker_validate_folder Tauri Command
 *
 * This test verifies the contract for the baker_validate_folder command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import { resolve } from 'path'
import type { ProjectFolder } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { beforeAll, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_validate_folder Contract', () => {
  const testDataPath = resolve(__dirname, '../fixtures/baker-test-data')

  beforeAll(() => {
    setupTauriMocks()
  })

  test('should validate folder with correct BuildProject structure', async () => {
    const validProjectPath = resolve(testDataPath, 'TestProject1')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: validProjectPath
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')

    // Verify ProjectFolder structure
    expect(result).toHaveProperty('path', validProjectPath)
    expect(result).toHaveProperty('name', 'TestProject1')
    expect(result).toHaveProperty('isValid', true)
    expect(result).toHaveProperty('hasBreadcrumbs', true)
    expect(result).toHaveProperty('lastScanned')
    expect(result).toHaveProperty('cameraCount', 1)
    expect(result).toHaveProperty('validationErrors')

    expect(Array.isArray(result.validationErrors)).toBe(true)
    expect(result.validationErrors.length).toBe(0) // Should have no errors
  })

  test('should identify folder without breadcrumbs', async () => {
    const projectPath = resolve(testDataPath, 'TestProject2')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: projectPath
    })

    expect(result.isValid).toBe(true)
    expect(result.hasBreadcrumbs).toBe(false)
    expect(result.cameraCount).toBe(2) // Has Camera 1 and Camera 2
    expect(result.validationErrors.length).toBe(0)
  })

  test('should reject invalid folder structure', async () => {
    const invalidPath = resolve(testDataPath, 'InvalidFolder')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: invalidPath
    })

    expect(result.isValid).toBe(false)
    expect(result.validationErrors.length).toBeGreaterThan(0)
    expect(result.validationErrors.some(err => err.includes('required subfolder'))).toBe(
      true
    )
  })

  test('should reject when folder does not exist', async () => {
    const nonExistentPath = '/path/that/does/not/exist'

    await expect(
      invoke('baker_validate_folder', {
        folderPath: nonExistentPath
      })
    ).rejects.toThrow()
  })

  test('should reject when path is empty', async () => {
    await expect(
      invoke('baker_validate_folder', {
        folderPath: ''
      })
    ).rejects.toThrow()
  })

  test('should handle folder with corrupted breadcrumbs', async () => {
    const corruptedPath = resolve(testDataPath, 'CorruptedProject')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: corruptedPath
    })

    // Folder structure might be valid, but breadcrumbs are corrupted
    expect(result.hasBreadcrumbs).toBe(false) // Should detect corruption
    expect(result.validationErrors.some(err => err.includes('corrupted'))).toBe(true)
  })

  test('should count camera folders correctly', async () => {
    const multiCameraPath = resolve(testDataPath, 'TestProject2')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: multiCameraPath
    })

    expect(result.cameraCount).toBe(2)
    expect(result.isValid).toBe(true)
  })

  test('should validate timestamp format in lastScanned', async () => {
    const validProjectPath = resolve(testDataPath, 'TestProject1')

    const result: ProjectFolder = await invoke('baker_validate_folder', {
      folderPath: validProjectPath
    })

    expect(result.lastScanned).toBeDefined()
    expect(typeof result.lastScanned).toBe('string')
    expect(() => new Date(result.lastScanned)).not.toThrow()
    expect(new Date(result.lastScanned).getTime()).not.toBeNaN()
  })
})
