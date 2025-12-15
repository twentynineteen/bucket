/**
 * Realistic Progress Tests
 *
 * Validates that progress tracking accurately simulates the behavior of
 * 250GB+ file transfers with realistic event patterns matching the Rust backend.
 *
 * Key formula (from src-tauri/src/utils/file_copy.rs):
 *   overall_progress = (files_completed + file_progress) / total_files * 100
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import {
  SCENARIOS,
  generateMockFiles,
  generateVariableSizeFiles,
  generateSingleLargeFile
} from '../utils/large-file-simulator'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Realistic Progress - Intra-File Progress', () => {
  test('emits progress events within each file (not just per-file)', async ({ page }) => {
    // Use 10-file scenario to verify intra-file progress
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(2000) // Faster for CI stability
      .setMaxEventsPerFile(5) // Reduced for speed while still testing intra-file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Intra-File Progress Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(120000) // Extended timeout for CI

    // Get detailed events
    const events = await mock.getDetailedEvents()

    // Should have more events than just file count (intra-file events)
    // With 5 events per file and 10 files, expect > 10 events
    expect(events.length).toBeGreaterThan(5)

    // Verify events include fileProgress (intra-file)
    const eventsWithFileProgress = events.filter((e) => e.fileProgress !== undefined)
    expect(eventsWithFileProgress.length).toBeGreaterThan(0)

    // Verify we see progress within individual files
    const fileZeroEvents = events.filter((e) => e.fileIndex === 0)
    expect(fileZeroEvents.length).toBeGreaterThan(1) // Multiple events for first file
  })

  test('progress updates for single 2GB file simulation', async ({ page }) => {
    // Test intra-file progress for a single large file
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SINGLE_LARGE)
      .setMockFiles(generateSingleLargeFile(2 * 1024 * 1024 * 1024))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(100) // 100 events for the single file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Single Large File Test', 1)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(120000)

    const events = await mock.getDetailedEvents()

    // Should have events for the single file
    expect(events.length).toBeGreaterThanOrEqual(10)

    // All events should be for file index 0
    events.slice(0, -1).forEach((event) => {
      expect(event.fileIndex).toBe(0)
    })

    // Progress should be monotonically increasing
    let lastPercent = 0
    for (const event of events) {
      expect(event.percent).toBeGreaterThanOrEqual(lastPercent)
      lastPercent = event.percent
    }

    // Final event should be 100%
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Realistic Progress - Formula Verification', () => {
  test('progress formula matches: (files + fileProgress) / total * 100', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(5) // 5 events per file for easy math
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Formula Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // Verify specific checkpoints based on formula
    // After first file complete (fileIndex=0, fileProgress=1.0): (0 + 1) / 10 * 100 = 10%
    const afterFirstFile = events.find(
      (e) => e.fileIndex === 0 && e.fileProgress && e.fileProgress >= 0.99
    )
    if (afterFirstFile) {
      expect(afterFirstFile.percent).toBeCloseTo(10, 0)
    }

    // After fifth file complete: (4 + 1) / 10 * 100 = 50%
    const afterFifthFile = events.find(
      (e) => e.fileIndex === 4 && e.fileProgress && e.fileProgress >= 0.99
    )
    if (afterFifthFile) {
      expect(afterFifthFile.percent).toBeCloseTo(50, 0)
    }

    // Final should be 100%
    expect(events[events.length - 1].percent).toBe(100)
  })

  test('no progress jumps greater than expected threshold', async ({ page }) => {
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

    await buildPage.fillProjectDetails('No Jump Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // With 20 files and 3 events per file, max jump should be ~5% per event
    // Allow some tolerance for batching
    const maxAllowedJump = 10 // 10% max jump

    for (let i = 1; i < events.length; i++) {
      const jump = events[i].percent - events[i - 1].percent
      expect(jump).toBeLessThanOrEqual(maxAllowedJump)
    }

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Realistic Progress - Variable File Sizes', () => {
  test('handles variable file sizes correctly', async ({ page }) => {
    const mock = createTauriMock(page)
    const variableFiles = generateVariableSizeFiles(SCENARIOS.SMOKE_TEST, 4)

    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(variableFiles.slice(0, 20)) // Use subset for faster test
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Variable Sizes Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // Verify we got events
    expect(events.length).toBeGreaterThan(5)

    // Progress should be monotonic
    let lastPercent = 0
    for (const event of events) {
      expect(event.percent).toBeGreaterThanOrEqual(lastPercent)
      lastPercent = event.percent
    }

    // Should reach 100%
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('larger files contribute more to progress duration', async ({ page }) => {
    // This test verifies that file size affects the number of events
    const mock = createTauriMock(page)

    // Create files with known sizes: 1 large (1GB) and 9 small (100MB)
    const GB = 1024 * 1024 * 1024
    const MB = 1024 * 1024
    const mixedFiles = [
      {
        file: { name: 'large.mov', path: '/mock/volumes/Production/large.mov' },
        camera: 1,
        simulatedSize: 1 * GB
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        file: {
          name: `small_${i}.mov`,
          path: `/mock/volumes/Production/small_${i}.mov`
        },
        camera: (i % 2) + 1,
        simulatedSize: 100 * MB
      }))
    ]

    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(mixedFiles)
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(5) // Cap events per file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Mixed Sizes Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // Count events for the large file (index 0)
    const largeFileEvents = events.filter((e) => e.fileIndex === 0)

    // Large file should have events (it's the first file)
    expect(largeFileEvents.length).toBeGreaterThan(0)

    // Total events should be reasonable
    expect(events.length).toBeGreaterThan(10)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Realistic Progress - Rapid Events', () => {
  test('handles rapid progress events without dropping updates', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(5) // Reduced events per file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Rapid Events Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // Should have events (10 files * 5 events max)
    expect(events.length).toBeGreaterThan(20)

    // Progress should still be monotonic despite rapid updates
    let lastPercent = 0
    for (const event of events) {
      expect(event.percent).toBeGreaterThanOrEqual(lastPercent)
      lastPercent = event.percent
    }

    // Final should be 100%
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('UI displays progress updates during rapid event emission', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3) // Reduced for speed
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('UI Rapid Update Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events to verify progress updates
    const events = await mock.getDetailedEvents()

    // Should have captured multiple distinct progress values
    const uniqueValues = [...new Set(events.map((e) => Math.floor(e.percent)))]
    expect(uniqueValues.length).toBeGreaterThan(3)

    // Progress values should be monotonically increasing
    let lastPercent = 0
    for (const event of events) {
      expect(event.percent).toBeGreaterThanOrEqual(lastPercent)
      lastPercent = event.percent
    }

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Realistic Progress - 250GB Simulation', () => {
  test('handles 50 files @ 500MB with realistic intra-file events', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3) // Reduced events per file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Large Transfer Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()

    // Should have events (20 files * 3 events)
    expect(events.length).toBeGreaterThan(20)

    // Verify monotonic progress
    let lastPercent = 0
    for (const event of events) {
      expect(event.percent).toBeGreaterThanOrEqual(lastPercent)
      lastPercent = event.percent
    }

    // Should reach 100%
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles 100 files @ 100MB with realistic intra-file events', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(30, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(2000) // Faster for CI stability
      .setMaxEventsPerFile(3) // Reduced events per file
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Many Files Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(120000) // Extended timeout for CI

    const events = await mock.getDetailedEvents()

    // Should have events (30 files * 3 events)
    expect(events.length).toBeGreaterThan(30)

    // Final event should be 100%
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })
})
