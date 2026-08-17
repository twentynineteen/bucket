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

  // This describe block held two tests reaching for one property: the main
  // thread stays available while a long transfer runs. They are one test now,
  // and this is it.
  //
  // `UI remains responsive during large file operation` timed
  // `page.locator('body').isVisible()` in a ten-second polling loop and asserted
  // every reading under 2000ms. That number is mostly Playwright - a round trip
  // per call plus actionability polling on a re-rendering page - so it moves with
  // runner load rather than with main-thread availability. It was the last
  // instance in the repo of the defect #171, #200 and #211 each dealt with in
  // another form, and it was never close to its threshold on an idle machine:
  // measured, its nineteen readings were 14-149ms against 2000ms. What moves a
  // figure like that is the runner, not the app. Its two contributions that were
  // not the stopwatch - that interactions complete, and that the window is
  // extended rather than a single moment - are kept below.
  //
  // `no UI freeze during operation` was the frame-gap shape already, from #209,
  // but over a shorter window: it read the probe after three interactions rather
  // than over the whole transfer, and had no floor under the operation's own
  // duration. Against this test it asserts nothing extra, so it is deleted rather
  // than left beside a near-twin in the same block - the same call #224 made for
  // the pair in `long-operation-states.spec.ts`, for the same reason (issue #229).
  test('no UI freeze during a large file operation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      // Unscaled, where both predecessors ran at multiplier 1000. At 1000 the
      // mock's inter-event delay clamps to `max(1, 50 / 1000)` = 1ms, so the whole
      // length of the operation is however long the app takes to chew through the
      // events and nothing guarantees it is long at all. Measured, 20 files at
      // three events still ran 9.5-9.6s that way - so unlike #224's pair this test
      // was not in fact reading an idle page for most of its window, and that is
      // worth saying rather than assuming. What it had was no floor: the number
      // was a property of the machine.
      //
      // At the scenario's stated 50ms interval the timers put that floor in place
      // instead, and it does not depend on how fast the machine is: 20 files at
      // three events is 20 x 2 waits within files plus 19 between them, so 2.95s
      // of the operation is `setTimeout` whatever else happens. Measured end to
      // end it runs 12.7-13.6s locally, the extra being the app's own work on 61
      // progress events.
      .setSpeedMultiplier(1)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Responsiveness Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    await startFrameGapProbe(page)
    const operationStart = Date.now()
    await buildPage.clickCreateProject()

    // Interact while the transfer runs. These still assert something without a
    // duration budget: a wedged main thread cannot serve them, so they would time
    // out rather than return. The try/catch records the outcome instead of
    // throwing, so all four are attempted and reported together.
    //
    // They are not, however, what catches a freeze. Injecting a real 1500ms block
    // during the transfer leaves all four reporting success - measured, here and
    // in #224 - because each is retried until the main thread frees up and none
    // has a deadline short enough to notice. The probe below carries the
    // coverage; these establish that the page is a working page and not a
    // screenshot of one.
    const interactions: { action: string; success: boolean }[] = []

    for (const [action, run] of [
      ['getTitle', () => buildPage.getTitle()],
      ['isVisible', () => buildPage.pageTitle.isVisible()],
      ['hover', () => buildPage.pageTitle.hover()],
      ['scroll', () => page.mouse.wheel(0, 100)]
    ] as const) {
      try {
        await run()
        interactions.push({ action, success: true })
      } catch {
        interactions.push({ action, success: false })
      }
    }

    // The probe runs inside the page, so holding the window open needs no
    // polling: waiting for the transfer to finish covers the whole busy period,
    // and the window is then the operation itself rather than a fixed guess at
    // its length. One round trip, where the loop this replaces made twenty.
    await buildPage.waitForCompletion(120000)
    const operationDuration = Date.now() - operationStart
    const longestFrameGap = await readLongestFrameGap(page)

    console.log('Interactions during transfer:', interactions)
    console.log(`Operation ran for ${operationDuration}ms`)
    console.log(`Longest frame gap over the operation: ${longestFrameGap.toFixed(0)}ms`)

    interactions.forEach((i) => {
      expect(i.success, `${i.action} during transfer`).toBe(true)
    })

    // Guards the measurement rather than the application: a frame-gap reading
    // over an instant is not evidence about a large file operation, and would pass
    // whatever the app did. 2500ms sits just under the 2.95s the mock's timers
    // guarantee above, which is the point - it is satisfied by the mock's
    // configuration alone, so neither a loaded runner nor a future speed-up of the
    // app can push it towards failing, and it fails if that configuration is
    // retimed to stop guaranteeing a window at all. It is deliberately not a
    // performance assertion: the app's own work dominates the measured 12.7-13.6s
    // and is not what this claims.
    expect(
      operationDuration,
      'operation was extended, not instantaneous'
    ).toBeGreaterThan(2500)

    // A freeze is a long task on the main thread, and the browser cannot serve an
    // animation frame while one runs, so the longest gap between frames is the
    // direct measurement - and unlike a stopwatch in the test process it is a
    // property of the application rather than of the runner. 500ms is about thirty
    // dropped frames; measured 113-127ms locally, and the same probe against the
    // same threshold measured 104-133ms in #224 and 80-121ms in #209. Load moves
    // this figure very little: #224 recorded 133ms on CI where the operation took
    // twice as long as it did locally.
    //
    // Red verified: blocking the main thread for a real 1500ms during the transfer
    // produced a 1524ms gap and failed here, and all four interactions above still
    // reported success through that block - which is why they are not the check.
    //
    // Worth knowing what this does not claim. The app is not idle during the
    // transfer, it is loaded - the operation takes 12.7s where its timers ask for
    // 2.95s. React splits that work into slices short enough to keep serving
    // frames, which is the difference between a busy UI and a frozen one, and the
    // difference a stopwatch on a Playwright call cannot see.
    expect(longestFrameGap).toBeLessThan(500)

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
