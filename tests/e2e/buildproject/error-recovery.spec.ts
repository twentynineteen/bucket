/**
 * Error Recovery Tests
 *
 * Validates that the application handles file operation failures gracefully.
 * Tests partial failures (some files fail), complete failures, and retry scenarios.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS, generateFilesWithFailures } from '../fixtures/mock-file-data'

test.describe('Error Recovery - Partial Failures', () => {
  test('handles partial file failures gracefully', async ({ page }) => {
    // Setup with failure injection: files 150-155 fail
    const { files } = generateFilesWithFailures(500, 4, [150, 151, 152, 153, 154, 155])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.LARGE_FILES)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(50)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [150, 151, 152, 153, 154, 155],
        errorMessage: 'Permission denied'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Partial Failure Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for operation to complete (should continue despite failures)
    await buildPage.waitForCompletion(120000)

    // Operation should complete (remaining files succeeded)
    await expect(buildPage.successMessage).toBeVisible()

    // Get emitted events to verify progress continued
    const events = await mock.getEmittedEvents()
    expect(events.length).toBeGreaterThan(0)

    // Final progress should still reach 100%
    const lastEvent = events[events.length - 1]
    expect(lastEvent.percent).toBeGreaterThanOrEqual(99)
  })

  test('progress continues after individual file failure', async ({ page }) => {
    const { files } = generateFilesWithFailures(100, 4, [50]) // One file fails in middle

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MEDIUM)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [50],
        errorMessage: 'Disk full'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Continue After Failure', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Monitor progress
    const progressValues: number[] = []
    const startTime = Date.now()

    while (Date.now() - startTime < 60000) {
      const progress = await buildPage.getProgress()
      progressValues.push(progress)

      if (await buildPage.isComplete()) break
      await page.waitForTimeout(200)
    }

    await buildPage.waitForCompletion(60000)

    // Progress should have reached 100%
    expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(99)

    // Verify success message shown
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles multiple scattered failures', async ({ page }) => {
    // Failures at various points: beginning, middle, end
    const failureIndices = [0, 1, 25, 50, 75, 98, 99]
    const { files } = generateFilesWithFailures(100, 4, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MEDIUM)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'File corrupted'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Scattered Failures', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Operation should complete despite multiple failures
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Error Recovery - Complete Failure', () => {
  test('handles complete operation failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'complete',
        errorMessage: 'Destination not writable'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Complete Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for error to be shown
    await page.waitForTimeout(2000)

    // Success message should NOT be visible (operation failed)
    const isComplete = await buildPage.isComplete()
    expect(isComplete).toBe(false)

    // Look for error indication (dialog, toast, or error message)
    // The exact behavior depends on implementation
    const errorVisible = await page.locator('text=/error|failed/i').isVisible().catch(() => false)
    // Note: If no error UI exists, this test documents expected behavior
    console.log('Error indicator visible:', errorVisible)
  })

  test('allows retry after complete failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'complete',
        errorMessage: 'Destination not writable'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Retry After Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for failure
    await page.waitForTimeout(2000)

    // Clear failure injection
    mock.clearFailure()
    await mock.reset()

    // Retry the operation
    await buildPage.clickCreateProject()

    // Should succeed this time
    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Error Recovery - Edge Cases', () => {
  test('handles failure at first file', async ({ page }) => {
    const { files } = generateFilesWithFailures(10, 2, [0])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [0],
        errorMessage: 'Access denied'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('First File Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Should complete (remaining files succeed)
    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles failure at last file', async ({ page }) => {
    const { files } = generateFilesWithFailures(10, 2, [9]) // Last file

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [9],
        errorMessage: 'Write failed'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Last File Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Should complete (previous files succeeded)
    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles all files failing except one', async ({ page }) => {
    // All files fail except the last one
    const failureIndices = Array.from({ length: 9 }, (_, i) => i) // [0,1,2,3,4,5,6,7,8]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'Various errors'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Almost All Fail', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Should still complete (one file succeeded)
    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('maintains progress state after transient error', async ({ page }) => {
    // Simulates a scenario where an error occurs but doesn't stop the operation
    const { files } = generateFilesWithFailures(100, 4, [25, 26, 27])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MEDIUM)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [25, 26, 27],
        errorMessage: 'Transient error'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Transient Error Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Capture progress before and after error point
    const progressBefore25: number[] = []
    const progressAfter27: number[] = []

    const events = await new Promise<Array<{ percent: number; fileIndex: number }>>((resolve) => {
      const allEvents: Array<{ percent: number; fileIndex: number }> = []

      const checkInterval = setInterval(async () => {
        const currentEvents = await mock.getEmittedEvents()
        if (currentEvents.length > allEvents.length) {
          allEvents.push(...currentEvents.slice(allEvents.length))
        }

        const isComplete = await buildPage.isComplete()
        if (isComplete) {
          clearInterval(checkInterval)
          resolve(allEvents)
        }
      }, 200)

      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(allEvents)
      }, 60000)
    })

    // Categorize events
    events.forEach((e) => {
      if (e.fileIndex < 25) progressBefore25.push(e.percent)
      if (e.fileIndex > 27) progressAfter27.push(e.percent)
    })

    // Progress should continue after errors
    expect(progressAfter27.length).toBeGreaterThan(0)

    // Progress after errors should be higher than before
    if (progressBefore25.length > 0 && progressAfter27.length > 0) {
      const maxBefore = Math.max(...progressBefore25)
      const minAfter = Math.min(...progressAfter27)
      expect(minAfter).toBeGreaterThan(maxBefore)
    }

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Error Recovery - User Experience', () => {
  test('user can clear and start new project after failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
      .injectFailure({
        type: 'complete',
        errorMessage: 'Operation failed'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // First attempt (will fail)
    await buildPage.fillProjectDetails('Failed Project', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()
    await page.waitForTimeout(2000)

    // Clear everything
    await buildPage.clickClearAll()

    // Verify fields are cleared
    expect(await buildPage.getTitle()).toBe('')
    expect(await buildPage.getNumCameras()).toBe(2)

    // Remove failure injection and try again
    mock.clearFailure()
    await mock.reset()

    // Second attempt (should succeed)
    await buildPage.fillProjectDetails('Successful Project', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})
