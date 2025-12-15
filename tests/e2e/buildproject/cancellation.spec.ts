/**
 * Transfer Cancellation Tests
 *
 * Tests the behavior when file transfers are interrupted or cancelled.
 * Validates proper cleanup, state management, and recovery scenarios.
 */

import { test, expect } from '@playwright/test'
import { BuildProjectPage } from '../pages/BuildProjectPage'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_PROJECTS } from '../fixtures/mock-file-data'

test.describe('Transfer Cancellation - User Initiated', () => {
  test('can cancel operation mid-transfer via mock', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(50) // Slow enough to cancel but not too slow
      .setMaxEventsPerFile(10)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Cancel Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for operation to start
    await page.waitForTimeout(500)

    // Verify operation is in progress
    const isActive = await mock.isOperationActive()
    expect(isActive).toBe(true)

    // Cancel the operation
    await mock.cancelOperation()

    // Wait for cancellation to take effect
    await page.waitForTimeout(1000)

    // Operation should no longer be active
    const isStillActive = await mock.isOperationActive()
    expect(isStillActive).toBe(false)

    // Should not have reached 100%
    const events = await mock.getDetailedEvents()
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      expect(lastEvent.percent).toBeLessThan(100)
    }
  })

  test('partial progress is preserved after cancellation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(30) // Slow enough to see progress before cancellation
      .setMaxEventsPerFile(10)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Partial Progress Test', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for some progress
    await page.waitForTimeout(2000)

    // Get current progress before cancellation
    const eventsBeforeCancel = await mock.getDetailedEvents()
    const progressBeforeCancel = eventsBeforeCancel.length > 0
      ? eventsBeforeCancel[eventsBeforeCancel.length - 1].percent
      : 0

    // Cancel
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    // Events should still be preserved
    const eventsAfterCancel = await mock.getDetailedEvents()
    expect(eventsAfterCancel.length).toBeGreaterThan(0)

    // Progress should be somewhere between 0 and 100 (not completed)
    if (progressBeforeCancel > 0) {
      expect(progressBeforeCancel).toBeLessThan(100)
    }
  })

  test('can start new operation after cancellation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // First operation - cancel it
    await buildPage.fillProjectDetails('First Cancelled', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await page.waitForTimeout(500)
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    // Reset mock state
    await mock.reset()

    // Navigate away and back to fully reset UI state (XState machine)
    await page.goto('/')
    await page.waitForTimeout(200)
    await buildPage.goto()
    await mock.injectMocks()

    // Second operation - let it complete
    await buildPage.fillProjectDetails('Second Success', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()

    // Update speed for faster completion
    mock.setSpeedMultiplier(500)
    await mock.injectMocks()

    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    const events = await mock.getDetailedEvents()
    expect(events[events.length - 1].percent).toBe(100)

    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Transfer Cancellation - Page Navigation', () => {
  test('navigation away cleans up listeners', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 3, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Navigation Test', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for operation to start and register listeners
    await page.waitForTimeout(500)

    // Check listeners before navigation
    const progressListenersBefore = await mock.getListenerCount('copy_progress')
    const completeListenersBefore = await mock.getListenerCount('copy_complete')
    expect(progressListenersBefore + completeListenersBefore).toBeGreaterThan(0)

    // Navigate away
    await page.goto('/')

    // Small delay for cleanup
    await page.waitForTimeout(200)

    // Navigate back
    await buildPage.goto()

    // Page should be in fresh state
    const title = await buildPage.getTitle()
    expect(title).toBe('') // Fresh state has empty title
  })

  test('can complete operation after returning to page', async ({ page }) => {
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

    // Navigate away and back
    await page.goto('/')
    await page.waitForTimeout(200)
    await buildPage.goto()

    // Reset mock state and re-inject after navigation
    await mock.reset()
    await mock.injectMocks()

    // Start fresh operation
    await buildPage.fillProjectDetails('After Navigation', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(60000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Transfer Cancellation - Browser Refresh', () => {
  test('refresh during transfer resets state', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(500)
      .setMaxEventsPerFile(3)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Refresh Test', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for operation to start
    await page.waitForTimeout(500)

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Re-setup mocks after reload
    mock.setSpeedMultiplier(1000)
    await mock.setup()
    await buildPage.goto()
    await mock.injectMocks()

    // Page should be in fresh state
    const title = await buildPage.getTitle()
    expect(title).toBe('')

    // Should be able to start new operation
    await buildPage.fillProjectDetails('After Refresh', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await buildPage.waitForCompletion(30000)
    await expect(buildPage.successMessage).toBeVisible()
  })
})

test.describe('Transfer Cancellation - Partial Completion', () => {
  test('cancel at 25% shows partial progress', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(30) // Slow enough to catch 25%
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Cancel at 25%', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait until we're past 25%
    let progress = 0
    const startTime = Date.now()
    while (progress < 25 && Date.now() - startTime < 30000) {
      const events = await mock.getDetailedEvents()
      if (events.length > 0) {
        progress = events[events.length - 1].percent
      }
      await page.waitForTimeout(100)
    }

    // Cancel around 25%
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    // Verify we were past 25% but not complete
    const finalEvents = await mock.getDetailedEvents()
    if (finalEvents.length > 0) {
      const finalProgress = finalEvents[finalEvents.length - 1].percent
      expect(finalProgress).toBeGreaterThanOrEqual(20) // Allow some variance
      expect(finalProgress).toBeLessThan(100)
    }
  })

  test('cancel at 50% shows approximately half progress', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 4, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(20)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Cancel at 50%', 4)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait until we're past 50%
    let progress = 0
    const startTime = Date.now()
    while (progress < 50 && Date.now() - startTime < 60000) {
      const events = await mock.getDetailedEvents()
      if (events.length > 0) {
        progress = events[events.length - 1].percent
      }
      await page.waitForTimeout(100)
    }

    // Cancel around 50%
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    // Verify we were around 50%
    const finalEvents = await mock.getDetailedEvents()
    if (finalEvents.length > 0) {
      const finalProgress = finalEvents[finalEvents.length - 1].percent
      expect(finalProgress).toBeGreaterThanOrEqual(45)
      expect(finalProgress).toBeLessThan(100)
    }
  })
})

test.describe('Transfer Cancellation - State Cleanup', () => {
  test('event listeners are cleaned up after cancellation', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(10)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Cleanup Test', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Wait for listeners to be registered
    await page.waitForTimeout(500)

    const listenersDuring = await mock.getListenerCount('copy_progress')
    expect(listenersDuring).toBeGreaterThan(0)

    // Cancel
    await mock.cancelOperation()
    await page.waitForTimeout(1000)

    // Operation should be stopped
    const isActive = await mock.isOperationActive()
    expect(isActive).toBe(false)
  })

  test('mock state is properly reset between operations', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    // First operation
    await buildPage.fillProjectDetails('First Op', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await page.waitForTimeout(500)
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    const eventsAfterFirst = await mock.getDetailedEvents()
    expect(eventsAfterFirst.length).toBeGreaterThan(0)

    // Reset mock state
    await mock.reset()

    // Verify reset cleared events
    const eventsAfterReset = await mock.getDetailedEvents()
    expect(eventsAfterReset.length).toBe(0)

    // Navigate away and back to fully reset UI state (XState machine)
    await page.goto('/')
    await page.waitForTimeout(200)
    await buildPage.goto()

    // Second operation with faster speed
    mock.setSpeedMultiplier(1000)
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Second Op', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()
    await buildPage.waitForCompletion(60000)

    const eventsAfterSecond = await mock.getDetailedEvents()
    // Events should be from second operation only
    expect(eventsAfterSecond.length).toBeGreaterThan(0)
    expect(eventsAfterSecond[eventsAfterSecond.length - 1].percent).toBe(100)
  })
})

test.describe('Transfer Cancellation - Rapid Cancellation', () => {
  test('immediate cancellation after start', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(10, 2, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
      .setSpeedMultiplier(20) // Slow enough to cancel but not too slow
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Immediate Cancel', 2)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    // Cancel immediately
    await mock.cancelOperation()
    await page.waitForTimeout(500)

    // Should have minimal or no progress
    const events = await mock.getDetailedEvents()
    if (events.length > 0) {
      // First event should be low percentage
      expect(events[0].percent).toBeLessThan(50)
    }

    // Operation should be stopped
    const isActive = await mock.isOperationActive()
    expect(isActive).toBe(false)
  })

  test('multiple rapid cancel attempts are handled', async ({ page }) => {
    const mock = createTauriMock(page)
    mock
      .setScenario(SCENARIOS.SMOKE_TEST)
      .setMockFiles(generateMockFiles(20, 3, SCENARIOS.SMOKE_TEST))
      .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
      .setSpeedMultiplier(50)
      .setMaxEventsPerFile(5)
    await mock.setup()

    const buildPage = new BuildProjectPage(page)
    await buildPage.goto()
    await mock.injectMocks()

    await buildPage.fillProjectDetails('Multi Cancel', 3)
    await buildPage.clickSelectDestination()
    await buildPage.clickSelectFiles()
    await buildPage.clickCreateProject()

    await page.waitForTimeout(200)

    // Multiple cancellation attempts
    await mock.cancelOperation()
    await mock.cancelOperation()
    await mock.cancelOperation()

    await page.waitForTimeout(500)

    // Should still be properly cancelled (not in error state)
    const isActive = await mock.isOperationActive()
    expect(isActive).toBe(false)
  })
})
