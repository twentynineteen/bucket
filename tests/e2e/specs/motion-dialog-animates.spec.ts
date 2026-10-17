/**
 * Motion dialog animates e2e spec (S2 fix verification)
 *
 * Opens a template card, takes two screenshots of the preview about 400ms
 * apart without __BUCKET_MOTION_CLOCK__, and asserts the preview content
 * changes between them - proving the ticker is running.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { installMotionMocks } from '../fixtures/motion.fixture'

async function stubReleaseCheck(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/*/*/releases/latest', route =>
    route.fulfill({
      json: { tag_name: 'v0.0.0', name: 'v0.0.0', body: '', html_url: '' }
    })
  )
}

test.describe('Motion dialog animation', () => {
  test('preview content changes between two screenshots (ticker runs)', async ({
    page
  }) => {
    await stubReleaseCheck(page)
    await setupTauriMocks(page)
    await installMotionMocks(page)

    // Do NOT set __BUCKET_MOTION_CLOCK__ - let the real ticker run
    await page.goto('/motion/marketplace')
    await page.waitForLoadState('networkidle')

    // Open the first available card
    const card = page.getByRole('button', { name: /Bar reveal/i }).first()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.click()

    // Wait for the dialog to open
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Find the preview element
    const preview = dialog.getByRole('img', { name: /preview/i })
    await expect(preview).toBeVisible()

    // Take two screenshots about 400ms apart
    const shot1 = await preview.screenshot()
    await page.waitForTimeout(400)
    const shot2 = await preview.screenshot()

    // The two screenshots must differ, proving the animation is running.
    // Compare raw buffers: if they are identical, the preview is static.
    const buf1 = Buffer.from(shot1)
    const buf2 = Buffer.from(shot2)
    expect(buf1.equals(buf2)).toBe(false)
  })
})
