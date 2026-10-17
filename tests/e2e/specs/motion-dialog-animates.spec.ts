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

    // Templates hold still for seconds mid-loop, so two fixed-interval shots
    // can both land in the hold. Sample across one full loop instead and pass
    // as soon as any frame differs from the first; a stopped ticker never does.
    const first = Buffer.from(await preview.screenshot())
    let changed = false
    for (let i = 0; i < 25 && !changed; i++) {
      await page.waitForTimeout(250)
      changed = !first.equals(Buffer.from(await preview.screenshot()))
    }
    expect(changed, 'preview never changed across a full loop').toBe(true)
  })
})
