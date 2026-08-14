/**
 * Memory Stability Tests
 *
 * Validates that the application remains stable during long-running
 * file operations. Tests for memory leaks, UI responsiveness, and
 * proper cleanup of event listeners.
 *
 * The memory tests read Chrome's `performance.memory`, which needs
 * `--enable-precise-memory-info`. That flag is set in the top-level `use` block
 * of `playwright.config.ts`, so it reaches every project, and `measureMemory`
 * degrades to `{ available: false }` where the API is missing regardless. It was
 * recorded as the reason one of these tests was skipped, and it was not the
 * reason (issue #200).
 *
 * Thresholds here are on measured heap and frame timing, so each one says what
 * it was measured against and how much headroom that leaves. A threshold within
 * noise of its observed range is a flake rather than a check, which is what put
 * two of these tests beyond use.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import {
  MemorySampler,
  measureMemory,
  checkUIResponsivenessDuring,
  collectGarbage,
  formatMemory,
  readLongestFrameGap,
  startFrameGapProbe
} from '../utils/memory-monitor'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Memory Stability - Long Running Operations', () => {
  test('no memory leak during 50 file operation', async ({ page }) => {
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

    await buildPage.fillProjectDetails('Memory Test 50', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Baseline is taken here, with the page loaded and all 20 files rendered,
    // so what follows measures the transfer rather than the cost of starting
    // the app. Measured straight after navigation instead, the number is
    // whatever the heap happened to be before the route had done any work, and
    // comparing a peak against it says nothing about leaking (issue #200).
    await collectGarbage(page)
    const baseline = await measureMemory(page)

    // Sampled during the transfer for diagnostics only, deliberately without an
    // assertion. First-to-last-sample growth is dominated by where GC happens
    // to land between samples: measured locally over twenty runs it ranged from
    // -6.6MB to +42.9MB for an identical operation, and asserting it against
    // the 50MB threshold this test shipped with failed once in eight runs on an
    // idle machine. A threshold that close to the noise is a flake, not a
    // check, so the leak claim is made after GC instead (issue #200). The peak
    // is logged because it is the first thing worth seeing if that claim fails.
    const sampler = new MemorySampler(page)
    sampler.start(500)

    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    sampler.stop()
    const analysis = sampler.analyze()

    // Retained heap once the transfer is over and garbage has been collected.
    // This is the assertion that distinguishes a leak from a working set: a
    // transfer is free to allocate while it runs, but must give it back.
    await collectGarbage(page)
    const settled = await measureMemory(page)

    if (baseline.available && settled.available) {
      const retained = settled.usedJSHeapSize! - baseline.usedJSHeapSize!
      console.log(`Baseline heap: ${formatMemory(baseline.usedJSHeapSize!)}`)
      console.log(`Settled heap: ${formatMemory(settled.usedJSHeapSize!)}`)
      console.log(`Retained after GC: ${formatMemory(retained)}`)
      console.log(`Peak heap during transfer: ${formatMemory(analysis.peakHeap)}`)

      // 30MB against a measured -1.8MB to +11.3MB over eighteen local runs.
      // The margin is deliberate: GC is not exhaustive on demand, so the
      // figure has a spread of about 13MB run to run. It is still a real
      // check, because the working set a leaking transfer would hold on to is
      // around 80MB above baseline - see the peak logged above.
      expect(retained).toBeLessThan(30 * 1024 * 1024)
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
    const initialProgressListeners = await mock.getListenerCount('file-transfer-progress')
    const initialCompleteListeners = await mock.getListenerCount('file-transfer-complete')

    await buildPage.fillProjectDetails('Cleanup Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // During operation, listeners should exist
    await page.waitForTimeout(500)
    const duringProgressListeners = await mock.getListenerCount('file-transfer-progress')
    const duringCompleteListeners = await mock.getListenerCount('file-transfer-complete')

    // At least one listener should be registered during operation
    expect(duringProgressListeners + duringCompleteListeners).toBeGreaterThan(0)

    // Wait for completion
    await buildPage.waitForCompletion(30000)

    // Give time for cleanup
    await page.waitForTimeout(500)

    // After completion, listeners should be cleaned up
    // Note: The exact behavior depends on useCopyProgress implementation
    // Some implementations may keep listeners but stop processing
    const finalProgressListeners = await mock.getListenerCount('file-transfer-progress')
    const finalCompleteListeners = await mock.getListenerCount('file-transfer-complete')

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

  test('no UI freeze during operation', async ({ page }) => {
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

    await startFrameGapProbe(page)
    await buildPage.clickCreateProject()

    // Interact while the transfer runs. These have to complete, and if the main
    // thread were wedged they would time out rather than return - which is the
    // freeze this test is named for. The try/catch records the outcome instead
    // of throwing so that all three are attempted and reported together.
    const interactions: { action: string; success: boolean }[] = []

    for (const [action, run] of [
      ['getTitle', () => buildPage.getTitle()],
      ['isVisible', () => buildPage.pageTitle.isVisible()],
      ['hover', () => buildPage.pageTitle.hover()]
    ] as const) {
      try {
        await run()
        interactions.push({ action, success: true })
      } catch {
        interactions.push({ action, success: false })
      }
    }

    // Read the probe before the transfer ends, so it covers the busy period.
    const longestFrameGap = await readLongestFrameGap(page)

    console.log('Interactions during operation:', interactions)
    console.log(`Longest frame gap during transfer: ${longestFrameGap.toFixed(0)}ms`)

    interactions.forEach((i) => {
      expect(i.success, `${i.action} during transfer`).toBe(true)
    })

    // A long task on the main thread is what a user experiences as a freeze,
    // and it is the one thing here that is a property of the application rather
    // than of the machine the test runs on. 500ms is roughly thirty dropped
    // frames; measured locally the worst gap over ten runs was well inside it.
    //
    // This deliberately replaces a `duration < 1000` budget on each interaction
    // above. Those durations were 55-620ms locally on an idle machine, and the
    // large one was Playwright waiting for a re-rendering element to go stable
    // before hovering it - a measurement of the harness, not of the app, and
    // 1.6x off its threshold before CI load is even considered (issue #200).
    expect(longestFrameGap).toBeLessThan(500)

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Memory Stability - Stress Tests', { tag: '@slow' }, () => {
  test('stress test: rapid start/stop operations', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      // Slow enough that a transfer is still running 200ms in, which is what
      // makes the abandonment below a stop rather than a no-op: at ten events
      // per file each file takes about 100ms, so the 200ms wait lands a file or
      // two into ten. The event cap matters - uncapped, the final transfer is a
      // thousand progress events and took longer than its budget on CI even
      // though it finished in seconds locally.
      .setSpeedMultiplier(5)
      .setMaxEventsPerFile(10)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // Start a transfer and abandon it, ten times over.
    //
    // The stop is a navigation away, which is the reset the rest of this suite
    // uses and the only one that works from any state. This loop used to call
    // `clickClearAll()`, and there is no Clear button once a build has finished
    // - the control is "Start New Project" - so the click silently did nothing,
    // the form was never reset, and the next iteration waited five minutes for
    // a "Create Project" button that the success view does not render. That is
    // why this test could never have passed as written (issue #200).
    for (let i = 0; i < 10; i++) {
      await buildPage.fillProjectDetails(`Stress ${i}`, 2)
      await buildPage.clickSelectDestination()
      await buildPage.clickSelectFiles()
      await buildPage.clickCreateProject()
      await page.waitForTimeout(200)

      // The transfer has to be genuinely under way for this to be a stress
      // test rather than ten no-ops, so check it emitted before killing it.
      const events = await mock.getEmittedEvents()
      expect(events.length, `transfer ${i} started`).toBeGreaterThan(0)

      await page.goto('/')
      await mock.reset()
      await buildPage.goto()
      await mock.injectMocks()
    }

    // The claim: after all that, a build still runs to completion. 60s rather
    // than the 30s this shipped with, because the ubuntu runner is several times
    // slower than a dev machine and 30s left no margin there.
    await buildPage.fillProjectDetails('Final Stress', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    await expect(buildPage.successMessage).toBeVisible()
  })
})
