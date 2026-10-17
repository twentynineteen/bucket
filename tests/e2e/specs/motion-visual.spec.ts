/**
 * Motion Marketplace screenshot (visual regression) specs (issue #338).
 *
 * T4.1 - grid screenshot at frozen clock, Light theme, 1440x900
 * T4.2 - dialog screenshot at frozen clock, Light theme
 *
 * These specs skip on non-Linux platforms. Baselines are generated with
 * scripts/e2e-motion-baselines.sh inside the pinned Playwright Docker image.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { installMotionMocks } from '../fixtures/motion.fixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function stubReleaseCheck(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/*/*/releases/latest', route =>
    route.fulfill({
      json: { tag_name: 'v0.0.0', name: 'v0.0.0', body: '', html_url: '' }
    })
  )
}

async function gotoMarketplace(page: Page): Promise<void> {
  await page.goto('/')
  const group = page.getByRole('button', { name: /Motion graphics/i })
  await expect(group).toBeVisible()
  await group.click()
  const item = page.getByRole('link', { name: /Marketplace/i })
  await item.click()
  await expect(page).toHaveURL(/\/motion\/marketplace/)
  await expect(page.getByRole('heading', { name: /Motion marketplace/i })).toBeVisible()
}

// ---------------------------------------------------------------------------
// T4: Screenshots (Linux only)
// ---------------------------------------------------------------------------

test.describe('Motion visual regression', () => {
  test.skip(process.platform !== 'linux', 'Screenshot baselines are Linux-only')

  test('T4.1 grid screenshot at frozen clock, Light theme, 1440x900', async ({
    page
  }) => {
    await stubReleaseCheck(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupTauriMocks(page)
    await installMotionMocks(page)

    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light')
    })
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 1.0
    })

    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Park the cursor on the plain header so no hover style leaks into the baseline
    await page.mouse.move(1438, 110)
    await page.waitForTimeout(100)

    await expect(page).toHaveScreenshot('motion-grid-light-1440.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })

  test('T4.2 dialog screenshot at frozen clock, Light theme', async ({ page }) => {
    await stubReleaseCheck(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupTauriMocks(page)
    await installMotionMocks(page)

    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light')
    })
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 1.0
    })

    await gotoMarketplace(page)

    // Open the Glide dialog
    const card = page.locator('[data-template-id="lower-third-glide"]')
    await expect(card).toBeVisible()
    await card.getByRole('button').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Park the cursor on the plain header so no hover style leaks into the baseline
    await page.mouse.move(1438, 110)
    await page.waitForTimeout(100)

    await expect(dialog).toHaveScreenshot('motion-dialog-light-1440.png', {
      maxDiffPixelRatio: 0.01
    })
  })
})
