/**
 * Motion Marketplace screenshot (visual regression) specs (issue #338).
 *
 * T4.1 - grid screenshot at frozen clock, Light theme, 1440x900
 * T4.2 - dialog screenshot (fixme until #337 merges)
 * T4.3 - baseline script generates deterministic Linux baselines
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

function collectExternalRequests(page: Page): string[] {
  const external: string[] = []
  page.on('request', req => {
    const url = new URL(req.url())
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      external.push(req.url())
    }
  })
  return external
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
    const external = collectExternalRequests(page)
    await stubReleaseCheck(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await setupTauriMocks(page)
    await installMotionMocks(page)

    // Set Light theme
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light')
    })

    // Freeze the preview clock at 1.0s
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 1.0
    })

    await gotoMarketplace(page)

    // Wait for the grid to settle
    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Wait a frame for layout to finalise
    await page.waitForTimeout(100)

    await expect(page).toHaveScreenshot('motion-grid-light-1440.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })

    expect(external).toEqual([])
  })

  // T4.2 depends on dialog (#337) - marked fixme
  test.fixme('T4.2 dialog screenshot at frozen clock, Light theme', async () => {}) // eslint-disable-next-line @typescript-eslint/no-empty-function
})
