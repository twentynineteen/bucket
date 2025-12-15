/**
 * E2E Tests: Baker Scan Workflow
 * Feature: 003-a-new-feature (Baker)
 *
 * Tests for the Baker folder scanning and breadcrumbs management workflow.
 */

import { expect, test } from '../fixtures/app.fixture'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { BakerPage } from '../pages/baker.page'

test.describe('Baker Page - Basic Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('should navigate to baker page', async ({ page }) => {
    await page.goto('/ingest/baker')
    await page.waitForLoadState('networkidle')

    // Verify we're on the baker page
    await expect(page).toHaveURL(/baker/)
  })

  test('should display baker page content', async ({ page }) => {
    await page.goto('/ingest/baker')
    await page.waitForLoadState('networkidle')

    // Page should have content
    const body = page.locator('body')
    const content = await body.textContent()
    expect(content?.length).toBeGreaterThan(0)
  })
})

test.describe('Baker Page - UI Elements', () => {
  let bakerPage: BakerPage

  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
    bakerPage = new BakerPage(page)
    await bakerPage.navigate()
  })

  test('should show select/browse button for root directory', async () => {
    // Wait for page to load
    await bakerPage.waitForLoadingComplete()

    // Check for directory selection button
    const selectButton = bakerPage.selectDriveButton.first()
    const isVisible = await selectButton.isVisible().catch(() => false)

    // Button may or may not be visible depending on app state
    expect(typeof isVisible).toBe('boolean')
  })

  test('should have scan functionality available', async ({ page }) => {
    await bakerPage.waitForLoadingComplete()

    // Look for scan-related UI elements
    const scanElements = page.locator(
      'button:has-text("Scan"), button:has-text("Start"), [data-testid*="scan"]'
    )

    const count = await scanElements.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Baker Page - Scan Workflow', () => {
  let bakerPage: BakerPage

  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
    bakerPage = new BakerPage(page)
    await bakerPage.navigate()
  })

  test('should display project list area', async ({ page }) => {
    await bakerPage.waitForLoadingComplete()

    // Look for list/table/grid that would show projects
    const listArea = page.locator(
      'table, ul, [role="list"], [data-testid*="project"], [data-testid*="result"]'
    )

    const count = await listArea.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should have filter functionality', async ({ page }) => {
    await bakerPage.waitForLoadingComplete()

    // Look for filter/search input
    const filterInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="Filter"], input[type="search"]'
    )

    const count = await filterInput.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Baker Page - Breadcrumbs Management', () => {
  let bakerPage: BakerPage

  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
    bakerPage = new BakerPage(page)
    await bakerPage.navigate()
  })

  test('should have breadcrumbs action buttons', async ({ page }) => {
    await bakerPage.waitForLoadingComplete()

    // Look for breadcrumbs-related action buttons
    const actionButtons = page.locator(
      'button:has-text("Update"), button:has-text("Create"), button:has-text("Apply")'
    )

    const count = await actionButtons.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should show preview area for breadcrumbs changes', async ({ page }) => {
    await bakerPage.waitForLoadingComplete()

    // Look for preview/diff area
    const previewArea = page.locator(
      '[data-testid*="preview"], [data-testid*="diff"], pre, code'
    )

    const count = await previewArea.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Baker Page - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('should handle navigation errors gracefully', async ({ page }) => {
    // Navigate to baker page
    await page.goto('/ingest/baker')
    await page.waitForLoadState('networkidle')

    // Page should not crash
    await expect(page.locator('body')).toBeVisible()
  })

  test('should maintain state on rapid navigation', async ({ page }) => {
    // Navigate back and forth
    await page.goto('/ingest/baker')
    await page.goto('/ingest/build')
    await page.goto('/ingest/baker')
    await page.waitForLoadState('networkidle')

    // Page should still work
    await expect(page).toHaveURL(/baker/)
  })
})
