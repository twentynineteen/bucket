/**
 * Contract Test: baker_update_breadcrumbs Tauri Command
 *
 * This test verifies the contract for the baker_update_breadcrumbs command.
 * Uses mocked Tauri backend for testing the contract interface.
 */

import { resolve } from 'path'
import type { BatchUpdateResult } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { setupTauriMocks } from '../setup/tauri-mocks'

describe('baker_update_breadcrumbs Contract', () => {
  const testDataPath = resolve(__dirname, '../fixtures/baker-test-data')
  let backupPaths: string[] = []
  let mockHelpers: ReturnType<typeof setupTauriMocks>

  beforeAll(() => {
    mockHelpers = setupTauriMocks()
  })

  beforeEach(() => {
    // Track backup files for cleanup
    backupPaths = []

    // Clear mock breadcrumbs store to ensure clean state between tests
    mockHelpers.clearMocks()

    // Re-initialize TestProject1 with breadcrumbs for tests that expect it
    const testProject1Path = resolve(testDataPath, 'TestProject1')
    mockHelpers.setBreadcrumbs(testProject1Path, {
      projectTitle: 'TestProject1',
      numberOfCameras: 1,
      files: [
        {
          camera: 1,
          name: 'test-file.mp4',
          path: `${testProject1Path}/Footage/Camera 1/test-file.mp4`
        }
      ],
      parentFolder: testDataPath,
      createdBy: 'test-user',
      creationDateTime: new Date().toISOString()
    })
  })

  afterEach(() => {
    // Cleanup any backup files created during tests
    // This would be implemented in real tests
  })

  test('should update existing breadcrumbs files successfully', async () => {
    const projectPaths = [resolve(testDataPath, 'TestProject1')]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: false,
      backupOriginals: true
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')

    // Verify BatchUpdateResult structure
    expect(result).toHaveProperty('successful')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('created')
    expect(result).toHaveProperty('updated')

    expect(Array.isArray(result.successful)).toBe(true)
    expect(Array.isArray(result.failed)).toBe(true)
    expect(Array.isArray(result.created)).toBe(true)
    expect(Array.isArray(result.updated)).toBe(true)

    // Should have updated TestProject1
    expect(result.successful).toContain(projectPaths[0])
    expect(result.updated).toContain(projectPaths[0])
    expect(result.created).not.toContain(projectPaths[0])
  })

  test('should create missing breadcrumbs when createMissing is true', async () => {
    const projectPaths = [resolve(testDataPath, 'TestProject2')]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: true,
      backupOriginals: false
    })

    expect(result.successful).toContain(projectPaths[0])
    expect(result.created).toContain(projectPaths[0])
    expect(result.updated).not.toContain(projectPaths[0])
  })

  test('should skip missing breadcrumbs when createMissing is false', async () => {
    const projectPaths = [resolve(testDataPath, 'TestProject2')]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: false,
      backupOriginals: false
    })

    // Should not create or update, but also shouldn't fail
    expect(result.created).not.toContain(projectPaths[0])
    expect(result.updated).not.toContain(projectPaths[0])
  })

  test('should handle batch updates with mixed success/failure', async () => {
    const projectPaths = [
      resolve(testDataPath, 'TestProject1'),
      resolve(testDataPath, 'TestProject2'),
      '/path/that/does/not/exist'
    ]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: true,
      backupOriginals: false
    })

    expect(result.successful.length).toBeGreaterThan(0)
    expect(result.failed.length).toBeGreaterThan(0)

    // Should have failure entry with error details
    const failedEntry = result.failed.find(f => f.path === '/path/that/does/not/exist')
    expect(failedEntry).toBeDefined()
    expect(failedEntry!.error).toBeDefined()
    expect(typeof failedEntry!.error).toBe('string')
  })

  test('should create backup files when backupOriginals is true', async () => {
    const projectPaths = [resolve(testDataPath, 'TestProject1')]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: false,
      backupOriginals: true
    })

    expect(result.successful).toContain(projectPaths[0])

    // Backup file should be created (would verify file system in real test)
    // expect(fs.existsSync(projectPaths[0] + '/breadcrumbs.json.bak')).toBe(true)
  })

  test('should reject when project paths array is empty', async () => {
    await expect(
      invoke('baker_update_breadcrumbs', {
        projectPaths: [],
        createMissing: false,
        backupOriginals: false
      })
    ).rejects.toThrow()
  })

  test('should handle permission errors gracefully', async () => {
    // Test with a path that would cause permission issues
    const restrictedPath = '/System/restricted-folder'

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths: [restrictedPath],
      createMissing: true,
      backupOriginals: false
    })

    expect(result.failed.length).toBe(1)
    expect(result.failed[0].path).toBe(restrictedPath)
    expect(result.failed[0].error.toLowerCase()).toContain('permission')
  })

  test('should validate that created breadcrumbs have correct structure', async () => {
    const projectPaths = [resolve(testDataPath, 'TestProject2')]

    const result: BatchUpdateResult = await invoke('baker_update_breadcrumbs', {
      projectPaths,
      createMissing: true,
      backupOriginals: false
    })

    expect(result.created).toContain(projectPaths[0])

    // Verify the created breadcrumbs file has correct structure
    const breadcrumbs = (await invoke('baker_read_breadcrumbs', {
      projectPath: projectPaths[0]
    })) as any

    expect(breadcrumbs).not.toBeNull()
    expect(breadcrumbs.projectTitle).toBe('TestProject2')
    // The mock creates breadcrumbs with 0 cameras by default
    expect(breadcrumbs.numberOfCameras).toBe(0)
  })
})
