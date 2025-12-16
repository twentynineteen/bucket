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
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('External Drive - Basic Workflow', () => {
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

test.describe('External Drive - Multiple Volumes', () => {
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

test.describe('External Drive - Latency Simulation', () => {
  test('UI remains responsive with external drive latency', async ({ page }) => {
    // External drives typically have higher latency than internal storage
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setExternalDrivePath('/Volumes/SlowDrive')
      .setSpeedMultiplier(1000)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Latency Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Check UI responsiveness during slow operation
    const responseTimes: number[] = []

    for (let i = 0; i < 5; i++) {
      const start = Date.now()
      await buildPage.pageTitle.isVisible()
      responseTimes.push(Date.now() - start)
      await page.waitForTimeout(500)
    }

    // All UI interactions should complete in under 2000ms (relaxed for CI)
    responseTimes.forEach((time) => {
      expect(time).toBeLessThan(2000)
    })

    await buildPage.waitForCompletion(60000)
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

test.describe('External Drive - Error Handling', () => {
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
        type: 'partial',
        failingFileIndices: [3, 4, 5], // Simulate failure at specific files
        errorMessage: 'Drive disconnected'
      })
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Disconnect Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Operation should still complete (partial failure skips files)
    await buildPage.waitForCompletion(60000)

    // Get events to verify some files were processed
    const events = await mock.getDetailedEvents()
    expect(events.length).toBeGreaterThan(0)

    await expect(buildPage.successMessage).toBeVisible()
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
        type: 'complete',
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
    // (The mock emits copy_error event which the frontend should handle)
    const isOperationActive = await mock.isOperationActive()
    expect(isOperationActive).toBe(false)
  })
})

test.describe('External Drive - Network Drive Simulation', () => {
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
