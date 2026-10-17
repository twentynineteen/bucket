/**
 * Motion navigation e2e spec (F5.3).
 *
 * Verifies that the sidebar group and items land on the correct routes.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { installMotionMocks } from '../fixtures/motion.fixture'

/**
 * The app checks GitHub for a newer release on every load. On shared CI IPs
 * that call is sometimes rate-limited with a 403, which shows up as a console
 * error. Answer it locally with a release older than any real one, so these
 * specs never depend on the network.
 */
async function stubReleaseCheck(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/*/*/releases/latest', route =>
    route.fulfill({
      json: { tag_name: 'v0.0.0', name: 'v0.0.0', body: '', html_url: '' }
    })
  )
}

test.describe('Motion navigation', () => {
  test('F5.3 sidebar Motion graphics group navigates to marketplace', async ({
    page
  }) => {
    // Collect console errors from the very first load, so the check does not
    // depend on when an async error happens to surface.
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await stubReleaseCheck(page)
    await setupTauriMocks(page)
    await installMotionMocks(page)
    await page.goto('/')

    // Open the sidebar group
    const group = page.getByRole('button', { name: /Motion graphics/i })
    await expect(group).toBeVisible()
    await group.click()

    // Click the Marketplace item
    const item = page.getByRole('link', { name: /Marketplace/i })
    await expect(item).toBeVisible()
    await item.click()

    // Verify we land on the marketplace page
    await expect(page).toHaveURL(/\/motion\/marketplace/)
    await expect(page.getByRole('heading', { name: /Motion marketplace/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('F5.3 Settings Motion item navigates to settings with motion hash', async ({
    page
  }) => {
    await stubReleaseCheck(page)
    await setupTauriMocks(page)
    await installMotionMocks(page)
    await page.goto('/')

    // Open Settings group
    const settingsGroup = page.getByRole('button', { name: /Settings/i })
    await settingsGroup.click()

    // Click the Motion item
    const motionItem = page.getByRole('link', { name: /^Motion$/i })
    await expect(motionItem).toBeVisible()
    await motionItem.click()

    // Verify we land on settings with the motion hash
    await expect(page).toHaveURL(/\/settings\/general#motion/)
  })
})
