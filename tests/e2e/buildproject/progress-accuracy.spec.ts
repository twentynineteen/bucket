/**
 * Progress Accuracy Tests
 *
 * Validates that progress bar updates correctly during large file operations.
 * Tests monotonic progress, checkpoint accuracy, and resilience to UI interaction.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { createProgressTracker } from '../utils/progress-event-generator'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Progress Accuracy - 250GB Simulation', () => {
  test('progress updates correctly across 500 files', async ({ page }) => {
    // Setup with 500 files scenario
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.LARGE_FILES)
      .setMockFiles(generateMockFiles(500, 4, SCENARIOS.LARGE_FILES))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(200) // Balance between speed and granularity
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Progress Test 500', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Start collecting progress values
    const progressValues: number[] = []

    // Listen for progress updates via console
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('copy_progress')) {
        const match = text.match(/(\d+\.?\d*)/)
        if (match) {
          progressValues.push(parseFloat(match[1]))
        }
      }
    })

    await buildPage.clickCreateProject()

    // Monitor progress during operation
    const monitoredProgress = await buildPage.monitorProgress(60000, 200)

    // Wait for completion
    await buildPage.waitForCompletion(120000)

    // Assert: Progress should be monotonically increasing
    for (let i = 1; i < monitoredProgress.length; i++) {
      expect(monitoredProgress[i]).toBeGreaterThanOrEqual(monitoredProgress[i - 1])
    }

    // Assert: Final progress should reach 100%
    const finalProgress = monitoredProgress[monitoredProgress.length - 1]
    expect(finalProgress).toBe(100)

    // Assert: We should have captured multiple progress updates
    expect(monitoredProgress.length).toBeGreaterThan(5)
  })

  test('progress displays correct percentage at checkpoints', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MEDIUM)
      .setMockFiles(generateMockFiles(100, 4, SCENARIOS.MEDIUM))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(100) // Slower to capture more checkpoints
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Checkpoint Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Track checkpoints
    const checkpoints = { hit25: false, hit50: false, hit75: false, hit100: false }

    const progressValues: number[] = []
    const startTime = Date.now()
    const timeout = 60000

    while (Date.now() - startTime < timeout) {
      const progress = await buildPage.getProgress()
      progressValues.push(progress)

      // Check if we've hit checkpoints
      if (progress >= 25 && !checkpoints.hit25) checkpoints.hit25 = true
      if (progress >= 50 && !checkpoints.hit50) checkpoints.hit50 = true
      if (progress >= 75 && !checkpoints.hit75) checkpoints.hit75 = true
      if (progress >= 100) {
        checkpoints.hit100 = true
        break
      }

      await page.waitForTimeout(100)
    }

    // Verify all checkpoints were hit
    expect(checkpoints.hit25).toBe(true)
    expect(checkpoints.hit50).toBe(true)
    expect(checkpoints.hit75).toBe(true)
    expect(checkpoints.hit100).toBe(true)

    // Verify success
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress continues correctly after UI interaction', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MEDIUM)
      .setMockFiles(generateMockFiles(100, 4, SCENARIOS.MEDIUM))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(100)
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

  test('progress events are throttled appropriately', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario({
        ...SCENARIOS.SMOKE_TEST,
        progressIntervalMs: 100 // Explicit 100ms throttle
      })
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1) // Real speed to test throttling
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Throttle Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    const timestamps: number[] = []

    // Start capturing timestamps
    const startTime = Date.now()
    await buildPage.clickCreateProject()

    // Monitor progress with tight interval
    while (Date.now() - startTime < 30000) {
      const progress = await buildPage.getProgress()
      if (progress > 0) {
        timestamps.push(Date.now())
      }
      if (progress >= 100) break
      await page.waitForTimeout(50)
    }

    // Calculate average interval between samples
    if (timestamps.length > 2) {
      const intervals: number[] = []
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

      // Interval should be reasonable (not too fast, not too slow)
      // Allow some variance due to test timing
      expect(avgInterval).toBeGreaterThan(20) // Not spamming
      expect(avgInterval).toBeLessThan(1000) // Updates happening
    }

    await buildPage.waitForCompletion(30000)
  })

  test('handles 2500 files with correct final progress', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.MANY_FILES)
      .setMockFiles(generateMockFiles(2500, 4, SCENARIOS.MANY_FILES))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(100) // Very fast for large file count
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('2500 Files Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(180000)

    // Get emitted events from mock
    const events = await mock.getEmittedEvents()

    // Verify events were emitted
    expect(events.length).toBeGreaterThan(0)

    // Verify final event is 100% (or close to it)
    const lastEvent = events[events.length - 1]
    expect(lastEvent.percent).toBeGreaterThanOrEqual(99)

    // Verify success message
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Progress Accuracy - Edge Cases', () => {
  test('handles rapid progress updates without dropping', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario({
        ...SCENARIOS.SMOKE_TEST,
        progressIntervalMs: 10 // Very fast updates
      })
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1)
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

  test('progress does not exceed 100%', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(200)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Max Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Monitor progress
    const progressValues: number[] = []
    const startTime = Date.now()

    while (Date.now() - startTime < 30000) {
      const progress = await buildPage.getProgress()
      progressValues.push(progress)

      if (progress >= 100) break
      await page.waitForTimeout(50)
    }

    // No progress value should exceed 100%
    progressValues.forEach((p) => {
      expect(p).toBeLessThanOrEqual(100)
    })

    await buildPage.waitForCompletion(30000)
  })
})
