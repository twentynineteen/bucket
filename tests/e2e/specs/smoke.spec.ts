import { expect, test } from '../fixtures/app.fixture'
import { setupTauriMocks } from '../fixtures/mocks.fixture'

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('app loads successfully', async ({ appReady }) => {
    // Verify the page loaded
    await expect(appReady).toHaveTitle(/Bucket/)
  })

  test('main navigation is visible', async ({ appReady }) => {
    // Check for main navigation elements
    // Adjust selectors based on your app's actual structure
    const sidebar = appReady.locator('[data-testid="sidebar"], nav, aside')
    await expect(sidebar.first()).toBeVisible()
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await setupTauriMocks(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Filter out expected errors when running outside Tauri context
    const unexpectedErrors = errors.filter(
      error =>
        !error.includes('__TAURI__') &&
        !error.includes('TAURI_INTERNALS') &&
        !error.includes('invoke') &&
        !error.includes('transformCallback') &&
        !error.includes('Failed to fetch') &&
        !error.includes('Failed to load resource') &&
        !error.includes('net::ERR') &&
        !error.includes('Error loading API keys') &&
        !error.includes('Failed to setup copy progress') &&
        !error.includes('403')
    )

    expect(unexpectedErrors).toHaveLength(0)
  })

  test('app responds to window resize', async ({ appReady }) => {
    // Test responsive behavior
    await appReady.setViewportSize({ width: 1920, height: 1080 })
    await expect(appReady.locator('body')).toBeVisible()

    await appReady.setViewportSize({ width: 768, height: 1024 })
    await expect(appReady.locator('body')).toBeVisible()

    await appReady.setViewportSize({ width: 375, height: 667 })
    await expect(appReady.locator('body')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('home page renders without critical failures', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify the page rendered something
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Check that the app shell rendered (not a blank page)
    const content = await body.textContent()
    expect(content?.length).toBeGreaterThan(0)
  })
})
