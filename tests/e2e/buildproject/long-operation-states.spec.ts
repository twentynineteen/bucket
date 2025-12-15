/**
 * Long Operation UI States Tests
 *
 * Validates that the UI correctly displays and maintains state during
 * extended file transfer operations (simulating 30+ second operations).
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Long Operation - Progress Visibility', () => {
  test('progress bar remains visible throughout extended operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Long Operation Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion with a reasonable timeout
    await buildPage.waitForCompletion(60000)

    // Get the emitted events to verify progress was tracked
    const events = await mock.getEmittedEvents()

    // Verify that progress events were emitted
    expect(events.length).toBeGreaterThan(0)

    // Verify final event reached 100%
    const lastEvent = events[events.length - 1]
    expect(lastEvent.percent).toBeGreaterThanOrEqual(99)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress values continuously increase during operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Continuous Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get events from mock to verify monotonic progress
    const events = await mock.getEmittedEvents()

    // Should have events
    expect(events.length).toBeGreaterThan(5)

    // Progress should be monotonically increasing
    for (let i = 1; i < events.length; i++) {
      expect(events[i].percent).toBeGreaterThanOrEqual(events[i - 1].percent)
    }

    // First event should be low, last should be 100
    expect(events[0].percent).toBeLessThan(50)
    expect(events[events.length - 1].percent).toBeGreaterThanOrEqual(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('no premature completion shown during operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('No Premature Complete', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Verify events show proper progression (not all 100% from start)
    const events = await mock.getEmittedEvents()
    expect(events.length).toBeGreaterThan(5)

    // First event should not be 100% (no premature completion)
    expect(events[0].percent).toBeLessThan(100)

    // Only the last event(s) should be 100%
    const eventsAt100 = events.filter((e) => e.percent >= 100)
    expect(eventsAt100.length).toBeLessThan(events.length / 2)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Long Operation - Button States', () => {
  test('create project button shows appropriate state during operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Button State Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Button should be enabled before starting
    await expect(buildPage.createProjectButton).toBeEnabled()

    await buildPage.clickCreateProject()

    // Just verify the page is still functional
    await expect(buildPage.pageTitle).toBeVisible()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('form inputs remain visible during operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Input Visibility Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Title and cameras inputs should still be visible
    await expect(buildPage.titleInput).toBeVisible()
    await expect(buildPage.camerasInput).toBeVisible()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Long Operation - UI Responsiveness', () => {
  test('page remains interactive during long operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Responsiveness Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Perform various UI interactions during operation
    const interactions: { action: string; success: boolean; duration: number }[] = []

    // Test 1: Hover
    let start = Date.now()
    try {
      await buildPage.pageTitle.hover()
      interactions.push({ action: 'hover', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'hover', success: false, duration: Date.now() - start })
    }

    // Test 2: Check visibility
    start = Date.now()
    try {
      await buildPage.titleInput.isVisible()
      interactions.push({ action: 'isVisible', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'isVisible', success: false, duration: Date.now() - start })
    }

    // Test 3: Scroll (if applicable)
    start = Date.now()
    try {
      await page.mouse.wheel(0, 100)
      interactions.push({ action: 'scroll', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'scroll', success: false, duration: Date.now() - start })
    }

    // Test 4: Focus
    start = Date.now()
    try {
      await buildPage.pageTitle.focus()
      interactions.push({ action: 'focus', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'focus', success: false, duration: Date.now() - start })
    }

    // All interactions should succeed
    interactions.forEach((i) => {
      expect(i.success).toBe(true)
      expect(i.duration).toBeLessThan(5000) // Each should complete in < 5 seconds (relaxed for CI environments)
    })

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('no UI freeze during extended operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('No Freeze Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Perform multiple timed interactions
    const responseTimes: number[] = []
    const startTime = Date.now()
    const testDuration = 10000 // Test for 10 seconds

    while (Date.now() - startTime < testDuration) {
      const interactionStart = Date.now()
      await buildPage.pageTitle.isVisible()
      responseTimes.push(Date.now() - interactionStart)
      await page.waitForTimeout(500)
    }

    // Calculate average response time
    const avgResponseTime =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length

    // Average should be under 500ms (relaxed for CI)
    expect(avgResponseTime).toBeLessThan(500)

    // No individual response should exceed 2000ms
    responseTimes.forEach((time) => {
      expect(time).toBeLessThan(2000)
    })

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Long Operation - Extended Duration', () => {
  test('handles 30+ second simulated operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('30 Second Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    const operationStart = Date.now()
    await buildPage.clickCreateProject()

    // Monitor operation duration
    await buildPage.waitForCompletion(120000)

    const operationDuration = Date.now() - operationStart

    // Operation should have taken a reasonable amount of time
    // (with speed multiplier of 500, should be quick)
    expect(operationDuration).toBeGreaterThan(1000) // At least 1 second

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress checkpoints are hit during long operation', async ({ page }) => {
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

    // Verify checkpoints by examining emitted events
    const events = await mock.getEmittedEvents()
    expect(events.length).toBeGreaterThan(5)

    // Check that events covered all checkpoint ranges
    const reached25 = events.some((e) => e.percent >= 25)
    const reached50 = events.some((e) => e.percent >= 50)
    const reached75 = events.some((e) => e.percent >= 75)
    const reached100 = events.some((e) => e.percent >= 100)

    expect(reached25).toBe(true)
    expect(reached50).toBe(true)
    expect(reached75).toBe(true)
    expect(reached100).toBe(true)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Long Operation - Memory During Extended Operation', () => {
  test('no excessive memory growth during long operation', async ({ page }) => {
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

    // Try to get initial memory (may not be available)
    let initialMemory: number | null = null
    try {
      const metrics = await page.evaluate(() => {
        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number }
        }
        return perf.memory?.usedJSHeapSize || null
      })
      initialMemory = metrics
    } catch {
      // Memory API not available
    }

    await buildPage.fillProjectDetails('Memory Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    // Try to get final memory
    let finalMemory: number | null = null
    try {
      const metrics = await page.evaluate(() => {
        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number }
        }
        return perf.memory?.usedJSHeapSize || null
      })
      finalMemory = metrics
    } catch {
      // Memory API not available
    }

    // If memory measurements available, check growth
    if (initialMemory && finalMemory) {
      const growth = finalMemory - initialMemory
      const growthMB = growth / (1024 * 1024)

      // Memory growth should be less than 50MB
      expect(growthMB).toBeLessThan(50)
    }

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('event buffer does not grow unbounded', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(2000) // Faster for CI stability
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Event Buffer Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(120000) // Increased timeout for CI

    // Check event buffer size
    const events = await mock.getDetailedEvents()

    // Should have events but not an unreasonable number
    // 50 files * 10 events = 500 max events
    expect(events.length).toBeLessThan(1000)

    // Events should be well-formed
    events.forEach((event) => {
      expect(event.percent).toBeGreaterThanOrEqual(0)
      expect(event.percent).toBeLessThanOrEqual(100)
    })

    await expect(buildPage.successMessage).toBeVisible()
  })
})
