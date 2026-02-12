/**
 * Partial Copy Failure Tests
 *
 * Tests the NEW behavior where partial file copy failures result in an error state.
 * The state machine now validates that movedFiles.length matches expected file count
 * and transitions to error state with a descriptive message if they don't match.
 *
 * Related tasks: td-429d2e, td-6202a8
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS, generateFilesWithFailures } from '../fixtures/mock-file-data'

test.describe('Partial Copy Failures - Error Detection', () => {
  test('detects partial failure when 7 of 10 files copy successfully', async ({ page }) => {
    // Setup: 10 files, files 7-9 will fail (indices 7, 8, 9)
    const failureIndices = [7, 8, 9]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'Permission denied'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Partial Failure Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for error state (partial failure should now trigger error)
    await buildPage.waitForError(60000)

    // Verify error is visible
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(true)

    // Verify success is NOT shown
    const isSuccess = await buildPage.isComplete()
    expect(isSuccess).toBe(false)

    // Verify error message mentions the file count
    const errorText = await buildPage.getErrorText()
    expect(errorText).toContain('7')
    expect(errorText).toContain('10')
  })

  test('detects complete failure when all files fail to copy', async ({ page }) => {
    // Setup: All 10 files will fail
    const failureIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'Disk full'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Complete Failure Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for error state
    await buildPage.waitForError(60000)

    // Verify error is visible
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(true)

    // Verify success is NOT shown
    const isSuccess = await buildPage.isComplete()
    expect(isSuccess).toBe(false)

    // Verify error message indicates 0 files copied
    const errorText = await buildPage.getErrorText()
    expect(errorText).toContain('0')
    expect(errorText).toContain('10')
  })

  test('succeeds when all files copy successfully', async ({ page }) => {
    // Setup: No failures, all files should copy
    const files = generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
    // No failure injection
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Success Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for success
    await buildPage.waitForCompletion(60000)

    // Verify success is shown
    const isSuccess = await buildPage.isComplete()
    expect(isSuccess).toBe(true)

    // Verify error is NOT shown
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(false)
  })
})

test.describe('Partial Copy Failures - Edge Cases', () => {
  test('detects failure when only first file fails', async ({ page }) => {
    // Setup: Only first file fails (9 of 10 succeed)
    const failureIndices = [0]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
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

    // Wait for error state (even single file failure should trigger error)
    await buildPage.waitForError(60000)

    // Verify error is visible
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(true)

    // Verify error message mentions 9 of 10
    const errorText = await buildPage.getErrorText()
    expect(errorText).toContain('9')
    expect(errorText).toContain('10')
  })

  test('detects failure when only last file fails', async ({ page }) => {
    // Setup: Only last file fails (9 of 10 succeed)
    const failureIndices = [9]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
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

    // Wait for error state
    await buildPage.waitForError(60000)

    // Verify error is visible
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(true)

    // Verify error message mentions 9 of 10
    const errorText = await buildPage.getErrorText()
    expect(errorText).toContain('9')
    expect(errorText).toContain('10')
  })

  test('detects scattered failures across copy operation', async ({ page }) => {
    // Setup: Failures at various points (5 of 10 succeed)
    const failureIndices = [1, 3, 5, 7, 9]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'Various errors'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Scattered Failures', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for error state
    await buildPage.waitForError(60000)

    // Verify error is visible
    const isError = await buildPage.isErrorVisible()
    expect(isError).toBe(true)

    // Verify error message mentions 5 of 10
    const errorText = await buildPage.getErrorText()
    expect(errorText).toContain('5')
    expect(errorText).toContain('10')
  })
})

test.describe('Partial Copy Failures - Moved Files Validation', () => {
  test('moved files array contains only successful files', async ({ page }) => {
    // Setup: Files 5-7 will fail (7 of 10 succeed)
    const failureIndices = [5, 6, 7]
    const { files } = generateFilesWithFailures(10, 2, failureIndices)

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(files)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
      .injectFailure({
        type: 'partial',
        failingFileIndices: failureIndices,
        errorMessage: 'File locked'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Moved Files Validation', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for error state
    await buildPage.waitForError(60000)

    // Get emitted events to verify progress continued for non-failing files
    const events = await mock.getEmittedEvents()

    // Should have events for files 0-4 and 8-9 (7 successful files)
    const uniqueFileIndices = Array.from(new Set(events.map((e) => e.fileIndex)))

    // Verify we got progress events for non-failing files
    expect(uniqueFileIndices).not.toContain(5)
    expect(uniqueFileIndices).not.toContain(6)
    expect(uniqueFileIndices).not.toContain(7)

    // Verify progress reached the files after the failures
    expect(uniqueFileIndices).toContain(8)
    expect(uniqueFileIndices).toContain(9)
  })
})
