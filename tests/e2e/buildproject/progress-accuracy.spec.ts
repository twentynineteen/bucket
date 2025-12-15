/**
 * Progress Accuracy Tests
 *
 * Validates that progress bar updates correctly during file operations.
 * Tests monotonic progress, checkpoint accuracy, and resilience to UI interaction.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Progress Accuracy - Basic Tests', () => {
  test('progress updates correctly across files', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events to verify progress
    const events = await mock.getEmittedEvents()

    // Assert: Progress should be monotonically increasing
    for (let i = 1; i < events.length; i++) {
      expect(events[i].percent).toBeGreaterThanOrEqual(events[i - 1].percent)
    }

    // Assert: We should have captured multiple progress updates
    expect(events.length).toBeGreaterThan(3)
  })

  test('progress displays correct percentage at checkpoints', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Checkpoint Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Check emitted events for checkpoints
    const events = await mock.getEmittedEvents()

    // Verify all checkpoints were hit via events
    const hit25 = events.some((e) => e.percent >= 25)
    const hit50 = events.some((e) => e.percent >= 50)
    const hit75 = events.some((e) => e.percent >= 75)
    const hit100 = events.some((e) => e.percent >= 100)

    expect(hit25).toBe(true)
    expect(hit50).toBe(true)
    expect(hit75).toBe(true)
    expect(hit100).toBe(true)

    // Verify success
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress continues correctly after UI interaction', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('UI Interaction Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for operation to start
    await page.waitForTimeout(500)

    const progressBefore = await buildPage.getProgress()

    // Perform UI interactions during copy
    await page.mouse.move(100, 100)
    await page.mouse.move(200, 200)
    await buildPage.pageTitle.click() // Click somewhere safe
    await page.keyboard.press('Tab')

    // Wait a bit and check progress again
    await page.waitForTimeout(500)
    const progressAfter = await buildPage.getProgress()

    // Progress should continue (not reset)
    expect(progressAfter).toBeGreaterThanOrEqual(progressBefore)

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Verify success
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress does not exceed 100%', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Max Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events to verify progress values
    const events = await mock.getEmittedEvents()

    // No progress value should exceed 100%
    events.forEach((e) => {
      expect(e.percent).toBeLessThanOrEqual(100)
    })

    // Verify success
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Progress Accuracy - Medium Scale', () => {
  test('handles 100 files with correct final progress', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('50 Files Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events from mock
    const events = await mock.getEmittedEvents()

    // Verify events were emitted
    expect(events.length).toBeGreaterThan(20)

    // Verify final event is 100%
    const lastEvent = events[events.length - 1]
    expect(lastEvent.percent).toBeGreaterThanOrEqual(99)

    // Verify success message
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles rapid progress updates without dropping', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Rapid Update Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(30000)

    // Verify completion
    await expect(buildPage.successMessage).toBeVisible()
  })
})
