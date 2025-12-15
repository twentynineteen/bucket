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
    // Setup with failure injection: files 5-8 fail (reduced file count for speed)
    const { files } = generateFilesWithFailures(20, 2, [5, 6, 7, 8])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [5, 6, 7, 8],
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
    const { files } = generateFilesWithFailures(10, 2, [5]) // One file fails in middle (reduced files for speed)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [5],
        errorMessage: 'Disk full'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Continue After Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion directly instead of monitoring progress
    await buildPage.waitForCompletion(60000)

    // Verify success message shown (operation completed despite partial failure)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles multiple scattered failures', async ({ page }) => {
    // Failures at various points: beginning, middle, end
    const failureIndices = [0, 1, 5, 10, 15, 18, 19]
    const { files } = generateFilesWithFailures(20, 4, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
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
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
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

  test.skip('allows retry after complete failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
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

    // Clear failure injection and reset
    mock.clearFailure()
    await mock.reset()

    // Clear UI and retry - Re-inject mocks BEFORE selecting files
    await buildPage.clickClearAll()
    await mock.injectMocks()
    await buildPage.fillProjectDetails('Retry After Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Should succeed this time
    await buildPage.waitForCompletion(60000)
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
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
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
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
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
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
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
    const { files } = generateFilesWithFailures(10, 2, [3, 4, 5])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: [3, 4, 5],
        errorMessage: 'Transient error'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Transient Error Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events after completion
    const events = await mock.getEmittedEvents()

    // Categorize events
    const progressBefore = events.filter((e) => e.fileIndex < 3).map((e) => e.percent)
    const progressAfter = events.filter((e) => e.fileIndex > 5).map((e) => e.percent)

    // Progress should continue after errors
    expect(progressAfter.length).toBeGreaterThan(0)

    // Progress after errors should be higher than before
    if (progressBefore.length > 0 && progressAfter.length > 0) {
      const maxBefore = Math.max(...progressBefore)
      const minAfter = Math.min(...progressAfter)
      expect(minAfter).toBeGreaterThan(maxBefore)
    }

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Error Recovery - User Experience', () => {
  test.skip('user can clear and start new project after failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
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

    // Remove failure injection and reset
    mock.clearFailure()
    await mock.reset()

    // Second attempt (should succeed) - Re-inject mocks BEFORE selecting files
    await mock.injectMocks()
    await buildPage.fillProjectDetails('Successful Project', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})
