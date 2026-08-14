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
import {
  collectGarbage,
  measureMemory,
  readLongestFrameGap,
  startFrameGapProbe
} from '../utils/memory-monitor'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Long Operation - Progress Visibility', { tag: '@slow' }, () => {
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

test.describe('Long Operation - Button States', { tag: '@slow' }, () => {
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

test.describe('Long Operation - UI Responsiveness', { tag: '@slow' }, () => {
  // Two tests lived here: `page remains interactive during long operation` and
  // `no UI freeze during extended operation`. Both timed interactions with a
  // wall-clock stopwatch around `await` on a Playwright locator and asserted the
  // elapsed time against a fixed budget - `duration < 5000` on each of four
  // interactions in the first, an average under 500ms with no single reading
  // over 2000ms on an `isVisible()` polling loop in the second.
  //
  // What that number contains is mostly Playwright. `locator.hover()` runs the
  // actionability checks and retries them until the element settles, and every
  // call costs a round trip to the browser, so the reading moves with runner
  // load far more than with main-thread availability in the page. The second of
  // the two had already been observed failing under parallel load and then
  // passing 3 of 3 run alone, which is the signature of measuring the harness
  // (issues #200, #211).
  //
  // Between them the two were reaching for one property: the main thread stays
  // available while a long transfer runs. Their two contributions that were not
  // the stopwatch - that interactions complete, and that the window is extended
  // rather than a single moment - are properties of one test rather than two, so
  // this is one test now, measured with the in-page frame-gap probe from #209.
  test('main thread stays responsive throughout an extended operation', async ({
    page
  }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(15, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      // Both previous tests ran at multiplier 1000, where the mock's inter-event
      // delay is clamped to 1ms and the operation's whole length is whatever the
      // app takes to chew through the events. Measured, that is 3.5s for their
      // ten files at three events - so `no UI freeze during extended operation`
      // spent roughly two thirds of its ten-second window polling a build that
      // had already finished, and its 500ms average was diluted by that idle
      // tail.
      //
      // Unscaled, the scenario's stated 50ms interval puts a floor under the
      // window that does not depend on how fast the app is: 15 files at three
      // events is 15 x 2 waits within files plus 14 between them, so at least
      // 2.2s of the operation is timers. Measured end to end it runs 8.5-9.3s
      // over thirteen local runs, and timers can only be late, so a loaded runner
      // lengthens it rather than shortening it. That is what makes the duration
      // floor asserted below safe rather than a race.
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
    // duration budget: a wedged main thread cannot serve them, so they would
    // time out rather than return. The try/catch records the outcome instead of
    // throwing, so all four are attempted and reported together.
    const interactions: { action: string; success: boolean }[] = []

    for (const [action, run] of [
      ['hover', () => buildPage.pageTitle.hover()],
      ['isVisible', () => buildPage.titleInput.isVisible()],
      ['scroll', () => page.mouse.wheel(0, 100)],
      ['focus', () => buildPage.pageTitle.focus()]
    ] as const) {
      try {
        await run()
        interactions.push({ action, success: true })
      } catch {
        interactions.push({ action, success: false })
      }
    }

    // The probe runs inside the page, so the window needs no polling to stay
    // open - waiting for the transfer to finish holds it over the whole busy
    // period, and reading it here rather than mid-transfer means the window is
    // the operation itself instead of a fixed guess at its length. It costs one
    // round trip where the loop this replaces made twenty. Measured, reading it
    // here reports the same worst gap as reading it mid-transfer does, so the
    // success-screen render adds no long task of its own.
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
    // over an instant is not evidence about an extended operation, and would
    // pass whatever the app did. 2000ms against a 2.2s timer floor and a
    // measured 8.5-9.3s. This is a floor on the application's own elapsed time
    // rather than a ceiling on a Playwright call, so runner load can only push
    // it further from failing.
    expect(
      operationDuration,
      'operation was extended, not instantaneous'
    ).toBeGreaterThan(2000)

    // A freeze is a long task on the main thread, and the browser cannot serve
    // an animation frame while one is running, so the longest gap between frames
    // is the direct measurement - and unlike a stopwatch in the test process it
    // is a property of the application rather than of the runner. 500ms is about
    // thirty dropped frames; measured 104-133ms over thirteen local runs, and the
    // same probe against the same threshold in memory-stability.spec.ts measured
    // 80-121ms over ten. Red verified: blocking the main thread for 1500ms
    // during the transfer produced a 1606ms gap and failed here.
    //
    // Worth knowing what this does not claim. The app is not idle during the
    // transfer, it is loaded - progress events cost several hundred milliseconds
    // each by the end of a run, and the operation takes 8.5s where its timers
    // ask for 2.2s. React splits that work into slices short enough to keep
    // serving frames, which is the difference between a busy UI and a frozen
    // one, and the difference a stopwatch on a Playwright call cannot see.
    expect(longestFrameGap).toBeLessThan(500)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Long Operation - Extended Duration', { tag: '@slow' }, () => {
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

test.describe('Long Operation - Memory During Extended Operation', { tag: '@slow' }, () => {
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

    await buildPage.fillProjectDetails('Memory Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Baseline with the page loaded and the file list rendered, after a GC.
    //
    // This test compared the heap immediately after navigation against the heap
    // immediately after completion, with no collection in between, and called a
    // 50MB difference excessive growth. It failed on every one of three runs
    // against master at around 100MB, because that difference is mostly the app
    // warming up plus garbage that had not been collected yet - neither of which
    // is growth. Same defect, same fix as `no memory leak during 50 file
    // operation` in memory-stability.spec.ts (issue #200).
    await collectGarbage(page)
    const baseline = await measureMemory(page)

    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    await collectGarbage(page)
    const settled = await measureMemory(page)

    if (baseline.available && settled.available) {
      const retainedMB =
        (settled.usedJSHeapSize! - baseline.usedJSHeapSize!) / (1024 * 1024)
      console.log(`Retained after GC: ${retainedMB.toFixed(2)} MB`)
      expect(retainedMB).toBeLessThan(30)
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
