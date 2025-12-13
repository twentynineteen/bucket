/**
 * BuildProject E2E Tests - Main Workflow
 *
 * Tests the complete BuildProject workflow from start to finish,
 * simulating a user creating a project with files.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS, TEST_FILE_SETS } from '../fixtures/mock-file-data'

test.describe('BuildProject E2E Workflow', () => {
  let tauriMock: ReturnType<typeof createTauriMock>

  test.beforeEach(async ({ page }) => {
    // Setup Tauri mocks with smoke test scenario
    tauriMock = createTauriMock(page)
    tauriMock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(TEST_FILE_SETS.SMOKE)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(10) // Speed up for tests
    await tauriMock.setup()

    // Navigate to page first, then inject mocks after Tauri APIs are loaded
    await page.goto('/ingest/build')
    await page.waitForLoadState('networkidle')
    await tauriMock.injectMocks()
  })

  test('displays BuildProject page correctly', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    // Verify page elements are present
    await expect(buildPage.pageTitle).toBeVisible()
    await expect(buildPage.titleInput).toBeVisible()
    await expect(buildPage.camerasInput).toBeVisible()
    await expect(buildPage.selectFilesButton).toBeVisible()
    await expect(buildPage.createProjectButton).toBeVisible()
  })

  test('allows entering project title and camera count', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    await buildPage.fillProjectDetails('Test Project', 4)

    expect(await buildPage.getTitle()).toBe('Test Project')
    expect(await buildPage.getNumCameras()).toBe(4)
  })

  test('sanitizes special characters in project title', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    // Enter title with special characters
    await buildPage.fillProjectDetails(TEST_PROJECTS.SPECIAL_CHARS.title, 2)

    // Title should be sanitized
    const sanitizedTitle = await buildPage.getTitle()
    expect(sanitizedTitle).not.toContain('/')
    expect(sanitizedTitle).not.toContain(':')
    expect(sanitizedTitle).not.toContain('*')
    expect(sanitizedTitle).not.toContain('?')

    // Sanitization warning should be visible
    await expect(buildPage.sanitizationWarning).toBeVisible()
  })

  test('clears all fields when Clear All is clicked', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    // Fill in details
    await buildPage.fillProjectDetails('Test Project', 4)

    // Click Clear All
    await buildPage.clickClearAll()

    // Fields should be reset
    expect(await buildPage.getTitle()).toBe('')
    expect(await buildPage.getNumCameras()).toBe(2) // Default value
  })

  test('complete workflow with smoke test data', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    // Fill project details
    await buildPage.fillProjectDetails(TEST_PROJECTS.BASIC.title, TEST_PROJECTS.BASIC.numCameras)

    // Select destination folder (mocked)
    await buildPage.clickSelectDestination()

    // Select files (mocked)
    await buildPage.clickSelectFiles()

    // Start project creation
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Verify success
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('shows progress bar during file operation', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    await buildPage.fillProjectDetails('Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Progress bar should become visible during operation
    // Wait a bit for operation to start
    await page.waitForTimeout(500)

    // Check that progress updates (or completes quickly due to speed multiplier)
    const isComplete = await buildPage.isComplete()
    if (!isComplete) {
      // If not complete yet, progress should be visible
      const progress = await buildPage.getProgress()
      expect(progress).toBeGreaterThanOrEqual(0)
    }

    await buildPage.waitForCompletion(60000)
  })

  test('shows Trello section after completion', async ({ page }) => {
    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()

    await buildPage.createProjectFlow(TEST_PROJECTS.BASIC.title, TEST_PROJECTS.BASIC.numCameras)

    // Trello section should be visible
    await expect(buildPage.trelloSection).toBeVisible()
  })
})

test.describe('BuildProject with Large Files (250GB Simulation)', () => {
  test('handles 500 files @ 500MB simulation', async ({ page }) => {
    // Setup with large file scenario
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.LARGE_FILES)
      .setMockFiles(generateMockFiles(500, 4, SCENARIOS.LARGE_FILES))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(500) // Speed up significantly for test - real delay ~1ms per event
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails(TEST_PROJECTS.PROFESSIONAL.title, 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion with extended timeout
    await buildPage.waitForCompletion(120000)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles 2500 files @ 100MB simulation', async ({ page }) => {
    // Setup with many files scenario
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MANY_FILES)
      .setMockFiles(generateMockFiles(2500, 4, SCENARIOS.MANY_FILES))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(1000) // Very fast for this large test - ~1ms per event
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Large Project 2500', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion with extended timeout
    await buildPage.waitForCompletion(180000)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('BuildProject Edge Cases', () => {
  test('handles empty title gracefully', async ({ page }) => {
    const mock = createTauriMock(page)
    mock.setScenario(SCENARIOS.SMOKE_TEST).setMockFiles(TEST_FILE_SETS.SMOKE)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // Leave title empty
    await buildPage.fillProjectDetails('', 2)
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Should show validation error or dialog
    // The exact behavior depends on implementation
    // At minimum, success message should NOT appear
    await page.waitForTimeout(1000)
    const isComplete = await buildPage.isComplete()
    expect(isComplete).toBe(false)
  })

  test('handles many cameras (8 cameras)', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(TEST_FILE_SETS.SMOKE)
      .setSelectedFolder(TEST_PROJECTS.MANY_CAMERAS.folder)
      .setSpeedMultiplier(10)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails(TEST_PROJECTS.MANY_CAMERAS.title, 8)

    expect(await buildPage.getNumCameras()).toBe(8)

    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    await expect(buildPage.successMessage).toBeVisible()
  })
})
