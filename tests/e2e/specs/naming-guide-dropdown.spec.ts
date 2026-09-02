/**
 * Naming-guide format dropdown - browser-layer layout (issue #274)
 *
 * jsdom cannot see whether a Radix Select taller than the window is capped and
 * scrollable or simply overflows off-screen. This mounts the real Select in a
 * deliberately short window and checks both: the listbox stays inside the
 * window, and its last option is reachable by scrolling.
 */
import { expect, test } from '@playwright/test'

import { SAMPLE_TREE, setupSproutMocks } from '../fixtures/sprout-folders.fixture'

test.describe('naming guide - format dropdown fits and scrolls', () => {
  test.beforeEach(async ({ page }) => {
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
  })

  test('a window too short for all formats caps the menu and still scrolls to the last', async ({
    page
  }) => {
    // Short enough that the 12+ formats cannot all fit at once.
    await page.setViewportSize({ width: 1100, height: 420 })

    await page.goto('/upload/sprout')
    await page.waitForLoadState('networkidle')

    // Selecting a file reveals the title field and, with it, the naming guide.
    await page.getByRole('button', { name: /Select Video File/i }).click()

    const formatTrigger = page.getByRole('combobox', { name: /format/i })
    await expect(formatTrigger).toBeVisible({ timeout: 15000 })
    await formatTrigger.click()

    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    // The menu must not spill past the bottom of the window.
    const box = await listbox.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)

    // The last option is reachable - i.e. the capped menu actually scrolls.
    const lastOption = page.getByRole('option', { name: /other \/ not listed/i })
    await lastOption.scrollIntoViewIfNeeded()
    await expect(lastOption).toBeInViewport()
  })
})
