/**
 * Sprout folder picker inside the Add Video dialog (issue #191).
 *
 * The picker's menu scrolls fine on /upload/sprout, and the picker suite
 * proves it there - but inside Baker's Add Video dialog the dialog's scroll
 * lock (react-remove-scroll) cancels wheel events over anything portalled
 * outside its subtree. A non-modal menu brings no scroll lock of its own, so
 * every folder below the fold was unreachable. Only a real browser inside the
 * real dialog can check this, hence e2e.
 */
import { expect, test, type Page } from '@playwright/test'

import {
  PROJECT_NAME,
  installBackgroundMocks
} from '../fixtures/posterframe-backgrounds.fixture'

/**
 * Walk Baker to the Add Video dialog's upload tab and open the folder menu,
 * with enough folders that the menu must scroll.
 *
 * The backgrounds fixture owns the whole IPC mock, so the folder listing is
 * layered over it rather than combined with the sprout-folders fixture.
 */
async function openFolderMenu(page: Page) {
  await installBackgroundMocks(page, { bakerJourney: true })
  await page.addInitScript(
    (folders) => {
      const win = window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (cmd: string, args?: unknown) => Promise<unknown>
        }
      }
      const base = win.__TAURI_INTERNALS__.invoke
      win.__TAURI_INTERNALS__.invoke = async (cmd: string, args?: unknown) => {
        if (cmd === 'get_folders') {
          return {
            folders,
            truncated: false,
            rate_limit_remaining: null,
            rate_limit_reset: null
          }
        }
        return base(cmd, args)
      }
    },
    Array.from({ length: 30 }, (_, i) => ({
      id: `folder-${i}`,
      name: `Folder ${String(i).padStart(2, '0')}`,
      parent_id: null
    }))
  )

  await page.goto('/ingest/baker')
  await page.getByRole('button', { name: /select|choose|browse/i }).first().click()
  await page
    .getByRole('button', { name: /^(start )?scan/i })
    .first()
    .click()
  await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 20000 })
  await page.getByText(PROJECT_NAME).first().click()
  await page.getByRole('tab', { name: /^videos/i }).click()
  await expect(page.getByRole('heading', { name: /video links/i })).toBeVisible({
    timeout: 15000
  })

  await page.getByRole('button', { name: /add video/i }).click()
  await page.getByRole('tab', { name: /upload file/i }).click()
  await page.getByRole('button', { name: /select video file/i }).click()

  const trigger = page.getByRole('button', { name: /^Folder:/ })
  await expect(trigger).toBeVisible({ timeout: 15000 })
  await trigger.click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Folder 00/ })).toBeVisible({
    timeout: 10000
  })
  return menu
}

test.describe('folder picker inside the Add Video dialog (#191)', () => {
  test('b1_wheel_scrolls_the_menu_despite_the_dialogs_scroll_lock', async ({
    page
  }) => {
    const menu = await openFolderMenu(page)

    const overflow = await menu.evaluate((el) => ({
      canScroll: el.scrollHeight > el.clientHeight,
      scrollTop: el.scrollTop
    }))
    expect(overflow.canScroll, 'the menu must overflow for this test to mean anything')
      .toBe(true)
    expect(overflow.scrollTop).toBe(0)

    const box = await menu.boundingBox()
    if (!box) throw new Error('menu has no bounding box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 300)

    await expect
      .poll(async () => menu.evaluate((el) => el.scrollTop), { timeout: 3000 })
      .toBeGreaterThan(0)
  })

  test('b2_body_pointer_events_recover_after_menu_and_dialog_close', async ({
    page
  }) => {
    // Guards the historical Radix bug the old modal={false} workaround
    // existed for: a modal menu nested in a modal dialog left
    // pointer-events: none on the body after both closed.
    await openFolderMenu(page)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect
      .poll(async () =>
        page.evaluate(() => getComputedStyle(document.body).pointerEvents)
      )
      .toBe('auto')

    // The page behind must be clickable again.
    await page.getByRole('tab', { name: /^videos/i }).click()
    await expect(page.getByRole('heading', { name: /video links/i })).toBeVisible()
  })
})
