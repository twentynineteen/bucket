/**
 * Error Recovery Tests
 *
 * Validates that the application surfaces file transfer failures.
 *
 * The native transfer backend (#112) aborts the WHOLE transfer when any file
 * fails and reports it via a failed `file-transfer-complete` event - there is
 * no skip-and-continue mode. The mock mirrors those semantics, so a failure
 * part-way through must end in an error state, never a success message.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS, generateFilesWithFailures } from '../fixtures/mock-file-data'

/** The constant description shown on every BuildProject error toast */
const ERROR_TOAST_TEXT = 'Please try again or contact support if the issue persists.'

test.describe('Error Recovery - Mid-Transfer Failures', () => {
  test('aborts and surfaces an error when a file fails mid-transfer', async ({
    page
  }) => {
    const { files } = generateFilesWithFailures(20, 2, [5])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        errorMessage: 'Permission denied',
        failAtFileIndex: 5
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Mid-Transfer Failure Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // The transfer aborts, so the error toast must appear...
    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })

    // ...and the success message must never appear
    expect(await buildPage.isComplete()).toBe(false)

    // Progress was made before the failure, but never reached 100%
    const events = await mock.getEmittedEvents()
    expect(events.length).toBeGreaterThan(0)
    const maxPercent = Math.max(...events.map((e) => e.percent))
    expect(maxPercent).toBeLessThan(100)
  })

  test('progress events stop at the failure point', async ({ page }) => {
    const failAt = 5
    const totalFiles = 10
    const { files } = generateFilesWithFailures(totalFiles, 2, [failAt])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        errorMessage: 'Disk full',
        failAtFileIndex: failAt
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Abort Point Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })

    // No events may come from files at or beyond the failure index
    const events = await mock.getDetailedEvents()
    const beyondFailure = events.filter((e) => e.fileIndex >= failAt)
    expect(beyondFailure).toEqual([])

    // The mock's operation flag must be cleared (transfer ended)
    expect(await mock.isOperationActive()).toBe(false)
  })
})

test.describe('Error Recovery - Complete Failure', () => {
  test('handles failure of the very first file (immediate abort)', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
      .injectFailure({
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

    // Error surfaces without any progress having been made
    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })
    expect(await buildPage.isComplete()).toBe(false)

    const events = await mock.getEmittedEvents()
    expect(events).toEqual([])
  })

  test('aborts at the last file without reporting success', async ({ page }) => {
    const totalFiles = 10
    const { files } = generateFilesWithFailures(totalFiles, 2, [totalFiles - 1])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
      .injectFailure({
        errorMessage: 'Write failed',
        failAtFileIndex: totalFiles - 1
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Last File Failure', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Even 90% of the way through, a failed transfer is a failed project
    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })
    expect(await buildPage.isComplete()).toBe(false)

    // Progress got close to, but never reached, 100%
    const events = await mock.getEmittedEvents()
    expect(events.length).toBeGreaterThan(0)
    const maxPercent = Math.max(...events.map((e) => e.percent))
    expect(maxPercent).toBeGreaterThan(50)
    expect(maxPercent).toBeLessThan(100)
  })
})

test.describe('Error Recovery - User Experience', () => {
  test.skip('allows retry after complete failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
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
    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })

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

  test.skip('user can clear and start new project after failure', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
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
    await expect(page.getByText(ERROR_TOAST_TEXT)).toBeVisible({ timeout: 30000 })

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
