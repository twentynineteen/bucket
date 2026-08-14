/**
 * External Drive Workflow Tests
 *
 * Tests the BuildProject workflow when files are selected from external drives
 * (e.g., /Volumes/Production, /Volumes/SD_CARD). This is the common workflow
 * for professional video production where footage is ingested from memory cards.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import {
  SCENARIOS,
  generateMockFiles,
  generateMultiVolumeFiles
} from '../utils/large-file-simulator'
import { readLongestFrameGap, startFrameGapProbe } from '../utils/memory-monitor'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

/**
 * Large-drive ingest simulations need longer than the config's 5 minute
 * default. This was the removed `large-files` project's timeout; it belongs
 * beside the specs that need it, so the config keeps no per-file rules
 * (issue #171).
 */
test.describe.configure({ timeout: 600000 })

test.describe('External Drive - Basic Workflow', { tag: '@slow' }, () => {
  test('handles files from /Volumes/Production path', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setExternalDrivePath('/Volumes/Production')
      .setSpeedMultiplier(2000) // Faster for CI stability
      .setMaxEventsPerFile(3) // Reduced events for speed
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('External Drive Project', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Verify files were selected (implicitly via UI state)
    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(120000) // Extended timeout for CI

    // Get events to verify paths were processed
    const events = await mock.getDetailedEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles files from SD card path', async ({ page }) => {
    const sdCardScenario = {
      ...SCENARIOS.SMOKE_TEST,
      basePath: '/Volumes/SD_CARD/DCIM/100MEDIA'
    }

    const mock = createTauriMock(page)
    mock
      .setScenario(sdCardScenario)
      .setMockFiles(generateMockFiles(10, 2, sdCardScenario))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/SD_CARD')
      .setSpeedMultiplier(2000) // Faster for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('SD Card Import', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })

  test('handles files from BRAW camera card path', async ({ page }) => {
    // Blackmagic RAW camera cards typically have this structure
    const brawScenario = {
      ...SCENARIOS.SMOKE_TEST,
      basePath: '/Volumes/BMPCC4K/Blackmagic'
    }

    const mock = createTauriMock(page)
    mock
      .setScenario(brawScenario)
      .setMockFiles(
        Array.from({ length: 10 }, (_, i) => ({
          file: {
            name: `A001_C${String(i + 1).padStart(3, '0')}_0101AB.braw`,
            path: `/Volumes/BMPCC4K/Blackmagic/A001_C${String(i + 1).padStart(3, '0')}_0101AB.braw`
          },
          camera: 1,
          simulatedSize: 500 * 1024 * 1024 // 500MB per clip
        }))
      )
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/BMPCC4K')
      .setSpeedMultiplier(2000) // Faster for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('BRAW Import', 1)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('External Drive - Multiple Volumes', { tag: '@slow' }, () => {
  test('handles files from multiple external drives', async ({ page }) => {
    const multiVolumeFiles = generateMultiVolumeFiles(15, 3, SCENARIOS.SMOKE_TEST, [
      '/Volumes/Camera_A',
      '/Volumes/Camera_B',
      '/Volumes/Camera_C'
    ])

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(multiVolumeFiles)
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(2000) // Faster for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Multi-Volume Import', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()
    expect(events.length).toBeGreaterThan(15)
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('correctly assigns cameras for multi-volume files', async ({ page }) => {
    // Create files where each volume represents a different camera
    const cameraAFiles = Array.from({ length: 5 }, (_, i) => ({
      file: {
        name: `CamA_${String(i).padStart(3, '0')}.mov`,
        path: `/Volumes/Camera_A/CamA_${String(i).padStart(3, '0')}.mov`
      },
      camera: 1, // All Camera A files assigned to camera 1
      simulatedSize: 100 * 1024 * 1024
    }))

    const cameraBFiles = Array.from({ length: 5 }, (_, i) => ({
      file: {
        name: `CamB_${String(i).padStart(3, '0')}.mov`,
        path: `/Volumes/Camera_B/CamB_${String(i).padStart(3, '0')}.mov`
      },
      camera: 2, // All Camera B files assigned to camera 2
      simulatedSize: 100 * 1024 * 1024
    }))

    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles([...cameraAFiles, ...cameraBFiles])
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(2000) // Faster for CI stability
      .setMaxEventsPerFile(3) // Reduced for speed
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Camera Assignment Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000) // Extended timeout for CI
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('External Drive - Latency Simulation', { tag: '@slow' }, () => {
  // The fourth site of the pattern #200, #211 and #229 replaced elsewhere, and the
  // one none of them found, because it did not call the helper - it timed
  // `await buildPage.pageTitle.isVisible()` inline, five times, and asserted each
  // reading under 2000ms. Searching for callers of `checkUIResponsivenessDuring`
  // therefore missed it; searching `tests/e2e` for a stopwatch around an `await` on
  // a locator is what turned it up (issue #229).
  //
  // The objection is the same one: that elapsed time is a round trip to the browser
  // plus Playwright's actionability polling on a re-rendering page, so it reports
  // the runner rather than main-thread availability in the app.
  test('no UI freeze with external drive latency', async ({ page }) => {
    // External drives typically have higher latency than internal storage
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/SlowDrive')
      // Unscaled, as in the other two converted sites: at multiplier 1000 the
      // mock's inter-event delay clamps to 1ms and nothing guarantees the window
      // is a window at all. At the scenario's stated 50ms, 10 files at three
      // events is 10 x 2 waits within files plus 9 between them, so 1.45s of the
      // operation is `setTimeout` however fast the machine.
      .setSpeedMultiplier(1)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Latency Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    await startFrameGapProbe(page)
    const operationStart = Date.now()
    await buildPage.clickCreateProject()

    // Reading the probe after completion makes the window the operation itself
    // rather than the five-poll guess it replaces, and costs one round trip
    // instead of five.
    await buildPage.waitForCompletion(120000)
    const operationDuration = Date.now() - operationStart
    const longestFrameGap = await readLongestFrameGap(page)

    console.log(`Operation ran for ${operationDuration}ms`)
    console.log(`Longest frame gap over the operation: ${longestFrameGap.toFixed(0)}ms`)

    // Guards the measurement, not the application: sits just under the 1.45s the
    // mock's timers guarantee above, so it fails if that configuration is retimed
    // to stop guaranteeing a window, and cannot be pushed towards failing by a
    // loaded runner or a faster app.
    expect(
      operationDuration,
      'operation was extended, not instantaneous'
    ).toBeGreaterThan(1250)

    // The freeze this test is named for is a long task on the main thread, and the
    // browser cannot serve an animation frame while one runs. 500ms is about thirty
    // dropped frames, against the same threshold and the same probe as the sites in
    // memory-stability.spec.ts and long-operation-states.spec.ts. Measured here:
    // 104-123ms over three runs, with the operation at 4.9-5.0s. Red verified,
    // blocking the main thread for a real 1500ms gave a 1546ms gap and failed.
    expect(longestFrameGap).toBeLessThan(500)

    await expect(buildPage.successMessage).toBeVisible()
  })

  test('progress updates visible during slow external drive operation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/Production')
      .setSpeedMultiplier(1000) // Fast for CI
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Progress Visibility Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for completion
    await buildPage.waitForCompletion(60000)

    // Get emitted events to verify progress was tracked
    const events = await mock.getEmittedEvents()

    // Should have captured multiple distinct progress values
    const uniqueProgress = [...new Set(events.map((e) => Math.floor(e.percent)))]
    expect(uniqueProgress.length).toBeGreaterThan(3)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('External Drive - Error Handling', { tag: '@slow' }, () => {
  test('handles external drive disconnection simulation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/Production')
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
      .injectFailure({
        errorMessage: 'Drive disconnected',
        failAtFileIndex: 3 // Simulate the drive vanishing mid-transfer
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Disconnect Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // A disconnected drive aborts the transfer - the error toast appears
    // and the operation never reports success
    await expect(
      page.getByText('Please try again or contact support if the issue persists.')
    ).toBeVisible({ timeout: 30000 })

    // Some files were processed before the disconnection
    const events = await mock.getDetailedEvents()
    expect(events.length).toBeGreaterThan(0)

    expect(await buildPage.isComplete()).toBe(false)
  })

  test('handles complete drive failure gracefully', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/Production')
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
      .injectFailure({
        errorMessage: 'Drive not found: /Volumes/Production'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Complete Failure Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Give time for error to appear
    await page.waitForTimeout(2000)

    // Operation should have failed - no success message
    // (The mock emits a failed file-transfer-complete event which the frontend handles)
    const isOperationActive = await mock.isOperationActive()
    expect(isOperationActive).toBe(false)
  })
})

test.describe('External Drive - Network Drive Simulation', { tag: '@slow' }, () => {
  test('handles network drive paths (SMB/NFS)', async ({ page }) => {
    // Network drives on macOS appear under /Volumes with mount names
    const networkScenario = {
      ...SCENARIOS.SMOKE_TEST,
      basePath: '/Volumes/NetworkShare/Video_Projects',
      progressIntervalMs: 100 // Network drives have higher latency
    }

    const mock = createTauriMock(page)
    mock
      .setScenario(networkScenario)
      .setMockFiles(generateMockFiles(15, 3, networkScenario))
      .setSelectedFolder('/Volumes/NetworkShare/Completed')
      .setExternalDrivePath('/Volumes/NetworkShare')
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Network Drive Import', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(120000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})
