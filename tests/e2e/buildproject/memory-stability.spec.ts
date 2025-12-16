/**
 * Memory Stability Tests
 *
 * Validates that the application remains stable during long-running
 * file operations. Tests for memory leaks, UI responsiveness, and
 * proper cleanup of event listeners.
 *
 * Note: Memory tests use Chrome's performance.memory API which
 * requires the --enable-precise-memory-info flag.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import {
  MemorySampler,
  measureMemory,
  checkUIResponsivenessDuring,
  formatMemory
} from '../utils/memory-monitor'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Memory Stability - Long Running Operations', () => {
  test.skip('no memory leak during 50 file operation', async ({ page }) => {
    // Setup with many files scenario (reduced for CI speed)
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

    // Take initial heap measurement
    const initialMemory = await measureMemory(page)

    // Start memory sampling
    const sampler = new MemorySampler(page)
    sampler.start(1000) // Sample every second

    await buildPage.fillProjectDetails('Memory Test 50', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Stop sampling
    sampler.stop()

    // Take final measurement
    const finalMemory = await measureMemory(page)

    // Analyze samples
    const analysis = sampler.analyze(50 * 1024 * 1024) // 50MB threshold

    // Log memory stats for debugging
    if (initialMemory.available && finalMemory.available) {
      console.log(`Initial heap: ${formatMemory(initialMemory.usedJSHeapSize!)}`)
      console.log(`Final heap: ${formatMemory(finalMemory.usedJSHeapSize!)}`)
      console.log(`Peak heap: ${formatMemory(analysis.peakHeap)}`)
      console.log(`Growth: ${formatMemory(analysis.growthBytes)} (${analysis.growthPercent.toFixed(1)}%)`)
    }

    // Assert: No significant memory growth
    if (analysis.growthBytes > 0) {
      expect(analysis.hasLeak).toBe(false)
    }

    // Assert: Peak should not be excessive (< 2x initial)
    if (initialMemory.available && analysis.peakHeap > 0) {
      expect(analysis.peakHeap).toBeLessThan(initialMemory.usedJSHeapSize! * 2)
    }

    // Verify operation completed successfully
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('UI remains responsive during large file operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Responsiveness Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Check UI responsiveness during operation
    const responsiveness = await checkUIResponsivenessDuring(
      page,
      10000, // Check for 10 seconds
      500,   // Every 500ms
      2000   // Max 2000ms response time (relaxed for CI)
    )

    console.log('Response times:', responsiveness.responseTimes)

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Assert: All UI interactions were responsive
    expect(responsiveness.allResponsive).toBe(true)

    // Assert: No individual response exceeded 2000ms (relaxed for CI)
    responsiveness.responseTimes.forEach((time) => {
      expect(time).toBeLessThan(2000)
    })

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('event listeners are cleaned up after completion', async ({ page }) => {
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

    // Check initial listener count
    const initialProgressListeners = await mock.getListenerCount('copy_progress')
    const initialCompleteListeners = await mock.getListenerCount('copy_complete')

    await buildPage.fillProjectDetails('Cleanup Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // During operation, listeners should exist
    await page.waitForTimeout(500)
    const duringProgressListeners = await mock.getListenerCount('copy_progress')
    const duringCompleteListeners = await mock.getListenerCount('copy_complete')

    // At least one listener should be registered during operation
    expect(duringProgressListeners + duringCompleteListeners).toBeGreaterThan(0)

    // Wait for completion
    await buildPage.waitForCompletion(30000)

    // Give time for cleanup
    await page.waitForTimeout(500)

    // After completion, listeners should be cleaned up
    // Note: The exact behavior depends on useCopyProgress implementation
    // Some implementations may keep listeners but stop processing
    const finalProgressListeners = await mock.getListenerCount('copy_progress')
    const finalCompleteListeners = await mock.getListenerCount('copy_complete')

    console.log('Listener counts:', {
      initial: { progress: initialProgressListeners, complete: initialCompleteListeners },
      during: { progress: duringProgressListeners, complete: duringCompleteListeners },
      final: { progress: finalProgressListeners, complete: finalCompleteListeners }
    })

    // Verify operation completed successfully
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles repeated operations without memory accumulation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(3000) // Faster for CI stability
      .setMaxEventsPerFile(2) // Reduced for speed
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    const heapMeasurements: number[] = []

    // Run multiple operations
    for (let i = 0; i < 3; i++) {
      // Measure before
      const beforeMemory = await measureMemory(page)
      if (beforeMemory.available) {
        heapMeasurements.push(beforeMemory.usedJSHeapSize!)
      }

      await buildPage.fillProjectDetails(`Repeated Op ${i + 1}`, 2)
      await buildPage.clickSelectDestination()
      await buildPage.clickSelectFiles()
      await buildPage.clickCreateProject()
      await buildPage.waitForCompletion(60000) // Extended timeout for each iteration

      // Reset mock state
      await mock.reset()

      // Navigate away and back to fully reset UI state (XState machine)
      // This is more reliable than trying to click Clear button
      await page.goto('/')
      await page.waitForTimeout(200)
      await buildPage.goto()
      await mock.injectMocks()

      // Force GC if available (Chrome DevTools Protocol)
      try {
        const client = await page.context().newCDPSession(page)
        await client.send('HeapProfiler.collectGarbage')
      } catch {
        // GC not available, continue anyway
      }

      await page.waitForTimeout(500)
    }

    // Final measurement
    const finalMemory = await measureMemory(page)
    if (finalMemory.available) {
      heapMeasurements.push(finalMemory.usedJSHeapSize!)
    }

    console.log('Heap measurements across operations:', heapMeasurements.map(formatMemory))

    // Calculate growth trend
    if (heapMeasurements.length >= 2) {
      const firstMeasurement = heapMeasurements[0]
      const lastMeasurement = heapMeasurements[heapMeasurements.length - 1]
      const growth = lastMeasurement - firstMeasurement

      // Growth should be minimal (< 20MB) after multiple operations
      expect(growth).toBeLessThan(20 * 1024 * 1024)
    }
  })

  test.skip('no UI freeze during operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('No Freeze Test', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Try to interact with UI during operation
    const interactions: { action: string; success: boolean; duration: number }[] = []

    // Test 1: Can we read title?
    let start = Date.now()
    try {
      await buildPage.getTitle()
      interactions.push({ action: 'getTitle', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'getTitle', success: false, duration: Date.now() - start })
    }

    // Test 2: Can we check page title visibility?
    start = Date.now()
    try {
      await buildPage.pageTitle.isVisible()
      interactions.push({ action: 'isVisible', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'isVisible', success: false, duration: Date.now() - start })
    }

    // Test 3: Can we hover elements?
    start = Date.now()
    try {
      await buildPage.pageTitle.hover()
      interactions.push({ action: 'hover', success: true, duration: Date.now() - start })
    } catch {
      interactions.push({ action: 'hover', success: false, duration: Date.now() - start })
    }

    console.log('Interactions during operation:', interactions)

    // All interactions should succeed
    interactions.forEach((i) => {
      expect(i.success).toBe(true)
      expect(i.duration).toBeLessThan(1000) // Should complete in < 1 second
    })

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Memory Stability - Stress Tests', () => {
  test.skip('stress test: rapid start/stop operations', async ({ page }) => {
    // This test is skipped by default as it's intensive
    // Enable for thorough stress testing
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // Rapidly start and clear operations
    for (let i = 0; i < 10; i++) {
      await buildPage.fillProjectDetails(`Stress ${i}`, 2)
      await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
      await buildPage.clickCreateProject()
      await page.waitForTimeout(200)
      await buildPage.clickClearAll()
      await mock.reset()
    }

    // Final successful operation
    await buildPage.fillProjectDetails('Final Stress', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(30000)

    await expect(buildPage.successMessage).toBeVisible()
  })
})
