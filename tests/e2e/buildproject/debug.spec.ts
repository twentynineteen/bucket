/**
 * Debug Test - to investigate workflow issues
 */
import { test, expect } from '@playwright/test'
import { createTauriMock } from '../fixtures/tauri-e2e-mocks'
import { SCENARIOS, generateMockFiles } from '../utils/large-file-simulator'
import { TEST_FILE_SETS, TEST_PROJECTS } from '../fixtures/mock-file-data'

test('debug workflow', async ({ page }) => {
  // Collect console logs
  const logs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    logs.push(`[${msg.type()}] ${text}`)
  })

  const mock = createTauriMock(page)
  mock
    .setScenario(SCENARIOS.SMOKE_TEST)
    .setMockFiles(TEST_FILE_SETS.SMOKE)
    .setSelectedFolder(TEST_PROJECTS.BASIC.folder)
    .setSpeedMultiplier(10)
  await mock.setup()

  await page.goto('/ingest/build')
  await page.waitForLoadState('networkidle')
  await mock.injectMocks()

  // Wait for page to be ready
  await expect(page.getByRole('heading', { name: 'Build a Project' })).toBeVisible()

  // Fill in details
  await page.getByPlaceholder('Enter title here').fill('Debug Test')
  await page.getByRole('spinbutton', { name: /number of cameras/i }).fill('2')

  // Select destination
  await page.getByRole('button', { name: /select destination/i }).click()
  await page.waitForTimeout(500)

  // Select files
  await page.getByRole('button', { name: 'Select Files' }).click()
  await page.waitForTimeout(500)

  // Check files are shown
  const fileCount = await page.locator('ul li').count()
  console.log('Files shown:', fileCount)

  // Click create project
  await page.getByRole('button', { name: 'Create Project' }).click()

  // Wait a few seconds for events
  await page.waitForTimeout(5000)

  // Print relevant logs
  console.log('\n=== Console logs ===')
  logs.forEach((log) => {
    if (
      log.includes('[E2E Mock]') ||
      log.includes('copy_') ||
      log.includes('move_') ||
      log.includes('listen') ||
      log.includes('error') ||
      log.includes('Error')
    ) {
      console.log(log)
    }
  })
  console.log('=== End logs ===\n')

  // Check progress
  const progressText = await page
    .locator('text=/\\d+\\.?\\d*%/')
    .first()
    .textContent()
    .catch(() => 'N/A')
  console.log('Progress:', progressText)

  // Check emitted events
  const events = await mock.getEmittedEvents()
  console.log('Emitted events count:', events.length)
  if (events.length > 0) {
    console.log('Last event:', events[events.length - 1])
  }

  // Check listener count
  const progressListeners = await mock.getListenerCount('copy_progress')
  const completeListeners = await mock.getListenerCount('copy_complete')
  console.log('Listener counts - progress:', progressListeners, 'complete:', completeListeners)
})

test('debug large files', async ({ page }) => {
  // Collect console logs
  const logs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    logs.push(`[${msg.type()}] ${text}`)
  })

  // Setup with large file scenario - same settings as actual test
  const mock = createTauriMock(page)
  mock
    .setScenario(SCENARIOS.LARGE_FILES)
    .setMockFiles(generateMockFiles(500, 4, SCENARIOS.LARGE_FILES))
    .setSelectedFolder(TEST_PROJECTS.PROFESSIONAL.folder)
    .setSpeedMultiplier(500) // Match the actual test settings
  await mock.setup()

  await page.goto('/ingest/build')
  await page.waitForLoadState('networkidle')

  // Wait for page to be ready
  await expect(page.getByRole('heading', { name: 'Build a Project' })).toBeVisible()

  // Fill in details
  await page.getByPlaceholder('Enter title here').fill('Large Files Test')
  await page.getByRole('spinbutton', { name: /number of cameras/i }).fill('4')

  // Select destination
  await page.getByRole('button', { name: /select destination/i }).click()
  await page.waitForTimeout(500)

  // Select files
  await page.getByRole('button', { name: 'Select Files' }).click()
  await page.waitForTimeout(500)

  // Check files are shown
  const fileCount = await page.locator('ul li').count()
  console.log('Files shown:', fileCount)

  // Click create project
  await page.getByRole('button', { name: 'Create Project' }).click()

  // Wait for completion or timeout - wait longer with faster simulation
  await page.waitForTimeout(15000)

  // Print relevant logs
  console.log('\n=== Console logs (last 50) ===')
  const relevantLogs = logs.filter((log) =>
    log.includes('[E2E Mock]') ||
    log.includes('copy_') ||
    log.includes('move_') ||
    log.includes('error') ||
    log.includes('Error')
  )
  relevantLogs.slice(-50).forEach((log) => console.log(log))
  console.log('=== End logs ===\n')

  // Check progress
  const progressText = await page
    .locator('text=/\\d+\\.?\\d*%/')
    .first()
    .textContent()
    .catch(() => 'N/A')
  console.log('Progress:', progressText)

  // Check emitted events
  const events = await mock.getEmittedEvents()
  console.log('Emitted events count:', events.length)
  if (events.length > 0) {
    console.log('Last event:', events[events.length - 1])
  }
})
