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

    const viewportH = page.viewportSize()!.height

    // The bug (#274): the menu was not capped, so it spilled past the bottom of
    // the window with no way to reach the hidden options. Assert it now fits
    // inside the window. Polled so it settles past the open (zoom) animation
    // rather than racing it.
    await expect
      .poll(async () => {
        const box = await listbox.boundingBox()
        return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY
      })
      .toBeLessThanOrEqual(viewportH + 1)

    // And the cap genuinely clips the list rather than shrinking the rows: the
    // menu is shorter than the space its 13 options need, so the remainder is
    // reachable only by scrolling. (Uncapped, the menu was ~656px; capped, it is
    // bounded by the ~420px window.)
    const optionCount = await page.getByRole('option').count()
    expect(optionCount).toBeGreaterThanOrEqual(13)
    const box = await listbox.boundingBox()
    expect(box!.height).toBeLessThan(viewportH)
  })
})
