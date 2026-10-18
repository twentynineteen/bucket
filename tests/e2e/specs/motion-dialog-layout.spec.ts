/**
 * Motion dialog layout e2e spec (#337)
 *
 * Catches preview-overlay and footer-pinning regressions without pixel
 * comparison. Asserts that the Name input's bounding box is below the
 * preview's bounding box and inside the dialog's visible scroll area.
 */
import { expect, test } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { installMotionMocks } from '../fixtures/motion.fixture'

test.describe('Motion dialog layout', () => {
  test('Name input is below the preview, not overlapped', async ({ page }) => {
    await setupTauriMocks(page)
    await installMotionMocks(page)

    // Freeze the preview at a fixed time so the render is deterministic
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.5
    })

    await page.goto('/motion/marketplace')
    await page.waitForLoadState('networkidle')

    // Wait for at least one card to appear, then click a lower-third card
    const card = page.getByRole('button', { name: /Bar reveal/i }).first()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.click()

    // Wait for the dialog to open
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Find the preview and the Name input
    const preview = dialog.getByRole('img', { name: /Bar reveal.*preview/i })
    const nameInput = dialog.getByRole('textbox', { name: /Name/i })

    await expect(preview).toBeVisible()

    // Scroll the Name input into view inside the dialog body
    await nameInput.scrollIntoViewIfNeeded()
    await expect(nameInput).toBeVisible()

    // Get their bounding boxes (after scroll, the preview may have
    // scrolled up but its height is still measurable)
    const previewBox = await preview.boundingBox()
    const inputBox = await nameInput.boundingBox()

    expect(previewBox).not.toBeNull()
    expect(inputBox).not.toBeNull()

    // In the DOM order, the input's top offset must be below the
    // preview's bottom. Use evaluate to check layout positions
    // relative to their shared scroll container, not the viewport.
    // Compare their scroll positions inside the dialog body to prove no
    // overlap. Use the scroll container's coordinate system, not the viewport.
    const scrollBody = dialog.locator('[data-slot="dialog-body"]')
    await expect(scrollBody).toBeVisible()

    const positions = await scrollBody.evaluate(body => {
      const prev = body.querySelector('[role="img"]')
      const inp = body.querySelector('input')
      if (!prev || !inp) return null
      // offsetTop is relative to the offsetParent, which is the scroll body
      return {
        previewTop: (prev as HTMLElement).offsetTop,
        previewHeight: (prev as HTMLElement).offsetHeight,
        inputTop: (inp as HTMLElement).offsetTop
      }
    })

    expect(positions).not.toBeNull()
    // The input's top must be below the preview's bottom
    expect(positions!.inputTop).toBeGreaterThan(
      positions!.previewTop + positions!.previewHeight - 1
    )
  })

  test('Export button is visible without scrolling', async ({ page }) => {
    await setupTauriMocks(page)
    await installMotionMocks(page)

    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.5
    })

    await page.goto('/motion/marketplace')
    await page.waitForLoadState('networkidle')

    // Open any card
    const card = page.getByRole('button', { name: /Bar reveal/i }).first()
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Export button should be visible in the pinned footer
    const exportBtn = dialog.getByRole('button', {
      name: /Export to project/i
    })
    await expect(exportBtn).toBeVisible()

    // Its bounding box should be inside the viewport
    const btnBox = await exportBtn.boundingBox()
    expect(btnBox).not.toBeNull()
    const viewport = page.viewportSize()!
    expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(viewport.height)
  })
})
