/**
 * Sprout folder picker — browser-layer behaviour (issue #155)
 *
 * These cover the claims jsdom cannot check. The unit suite asserts class
 * strings and hook state; only a real browser can say whether a 40-folder menu
 * is actually reachable, whether Radix's 100ms hover-open fires a request, or
 * whether typeahead steals focus from the filter box.
 *
 * IPC is mocked (see the fixture), so nothing here proves the TS↔Rust argument
 * binding — that is `tauri-ipc.contract.test.ts` — nor Sprout's real semantics,
 * which are in docs/sprout-folder-picker-manual-verification.md.
 */
import { expect, test } from '@playwright/test'

import {
  DEEP_TREE,
  SAMPLE_TREE,
  folderCalls,
  resetFolderCalls,
  setupSproutMocks,
  wideTree
} from '../fixtures/sprout-folders.fixture'

/**
 * Opens the Sprout upload page and selects a file, which is what reveals the
 * folder picker (it sits alongside the title field, both gated on a selection).
 */
async function openPicker(page: import('@playwright/test').Page) {
  await page.goto('/upload/sprout')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: /Select Video File/i }).click()

  const trigger = page.getByRole('button', { name: /^Folder:/ })
  await expect(trigger).toBeVisible({ timeout: 15000 })
  return trigger
}

/**
 * Opens the menu and waits for the root level to finish loading.
 *
 * Opening legitimately fetches the root level after the dwell elapses, so
 * assertions about *submenu* traffic must not race it -- clearing the call log
 * before the root request lands would attribute it to the interaction under
 * test. Waiting for a known root folder is the signal that it has settled.
 */
async function openMenu(
  page: import('@playwright/test').Page,
  trigger: import('@playwright/test').Locator,
  firstFolder: string | RegExp
) {
  await trigger.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.getByRole('menuitem', { name: firstFolder })).toBeVisible({
    timeout: 10000
  })
}

test.describe('folder picker — rate-limit behaviour in a real browser', () => {
  test('hovering across folders without pausing fires no requests', async ({ page }) => {
    // Radix opens a submenu on pointer-move after 100ms. Wiring `enabled` to
    // that open event would turn a mouse sweep into one request per row.
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)

    await openMenu(page, trigger, /Marketing/)
    await resetFolderCalls(page)

    // Bounding boxes are read up front and driven with raw mouse moves.
    // `locator.hover()` performs actionability checks between rows, which adds
    // enough delay to exceed the dwell and stop modelling a real sweep.
    const rows = page.getByRole('menuitem')
    const boxes: Array<{ x: number; y: number }> = []
    for (let i = 0; i < (await rows.count()); i++) {
      const box = await rows.nth(i).boundingBox()
      if (box) boxes.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
    }
    expect(boxes.length, 'need several rows to sweep across').toBeGreaterThan(2)

    for (const box of boxes) {
      await page.mouse.move(box.x, box.y)
      // Past Radix's 100ms open timer, comfortably under the 300ms dwell.
      await page.waitForTimeout(140)
    }
    // Leave the menu so the last row cannot accumulate dwell time.
    await page.mouse.move(5, 5)
    await page.waitForTimeout(400)

    const calls = await folderCalls(page)
    expect(
      calls,
      `swept ${boxes.length} rows and issued ${calls.length} folder requests`
    ).toHaveLength(0)
  })

  test('dwelling on one folder fires exactly one request', async ({ page }) => {
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)

    await openMenu(page, trigger, /Marketing/)
    await resetFolderCalls(page)

    await page.getByRole('menuitem', { name: /Marketing/ }).hover()
    await page.waitForTimeout(900)

    const calls = await folderCalls(page)
    expect(calls).toHaveLength(1)
    expect(calls[0].parentId).toBe('root-1')
  })

  test('reopening the picker refetches nothing', async ({ page }) => {
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)

    await openMenu(page, trigger, /Marketing/)
    await page.keyboard.press('Escape')

    await resetFolderCalls(page)
    await openMenu(page, trigger, /Marketing/)
    await page.waitForTimeout(700)

    expect(await folderCalls(page)).toHaveLength(0)
  })
})

test.describe('folder picker — layout the unit tests cannot see', () => {
  test('a level with 40 folders scrolls instead of clipping', async ({ page }) => {
    // The backend fetches up to 100 per level; Radix menus do not scroll and
    // the base class is overflow-hidden, so without an explicit cap the tail
    // would be unreachable and the pagination fix pointless.
    await setupSproutMocks(page, { folders: wideTree(40) })
    const trigger = await openPicker(page)
    await openMenu(page, trigger, 'Folder 000')

    const menu = page.getByRole('menu')

    const metrics = await menu.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      bottom: el.getBoundingClientRect().bottom
    }))

    expect(metrics.overflowY, 'menu must scroll').toMatch(/auto|scroll/)
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    expect(metrics.bottom).toBeLessThanOrEqual(page.viewportSize()!.height)

    // The last folder must be genuinely reachable, not merely present in DOM.
    const last = page.getByRole('menuitem', { name: 'Folder 039' })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
  })

  test('search results show the full breadcrumb path without clipping', async ({
    page
  }) => {
    // Reported from manual testing: at a fixed narrow width, a path like
    // `2026 Projects / MSc Programmes / Module X -- Session Recordings` was
    // truncated to uselessness. The menu now borrows the trigger's width.
    await setupSproutMocks(page, { folders: DEEP_TREE })
    const trigger = await openPicker(page)
    await openMenu(page, trigger, /2026 Projects/)

    // Load the deeper levels so they are in cache and therefore filterable.
    await page.getByRole('menuitem', { name: /2026 Projects/ }).hover()
    await expect(page.getByRole('menuitem', { name: /MSc Programmes/ })).toBeVisible()
    await page.getByRole('menuitem', { name: /MSc Programmes/ }).hover()
    await expect(page.getByRole('menuitem', { name: /Module X/ })).toBeVisible()

    await page.getByLabel('Filter loaded folders').click()
    await page.keyboard.type('Module X')

    const hit = page.getByTitle('2026 Projects / MSc Programmes / Module X -- Session Recordings')
    await expect(hit).toBeVisible()

    // scrollWidth > clientWidth is exactly what CSS truncation looks like.
    const clipped = await hit.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped, 'the full path must be visible, not ellipsised').toBe(false)
  })

  test('the trigger reports the current destination without opening', async ({
    page
  }) => {
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)

    // Discoverability: a dropdown hides structure, so the label must carry the
    // selection. Defaults to Root before anything is chosen.
    await expect(trigger).toContainText('Root (no folder)')
  })
})

test.describe('folder picker — Radix interaction hazards', () => {
  test('the filter box keeps focus across several keystrokes', async ({ page }) => {
    // Radix fires typeahead for any single character typed inside menu content
    // and calls .focus() on the match. jsdom approximates focus; this is the
    // check that actually means something.
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)
    await openMenu(page, trigger, /Marketing/)

    const filter = page.getByLabel('Filter loaded folders')
    await filter.click()
    await page.keyboard.type('marketing', { delay: 60 })

    await expect(filter).toHaveValue('marketing')
    await expect(filter).toBeFocused()
  })

  test('Escape still closes the menu from inside the filter box', async ({ page }) => {
    // The keydown workaround must not swallow dismissal along with typeahead.
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)
    await openMenu(page, trigger, /Marketing/)

    const filter = page.getByLabel('Filter loaded folders')
    await filter.click()
    await page.keyboard.type('mark')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('menu')).toBeHidden()
  })

  test('filtering issues no requests at all', async ({ page }) => {
    await setupSproutMocks(page, { folders: SAMPLE_TREE })
    const trigger = await openPicker(page)
    await openMenu(page, trigger, /Marketing/)
    await resetFolderCalls(page)

    await page.getByLabel('Filter loaded folders').click()
    await page.keyboard.type('campaign', { delay: 40 })
    await page.waitForTimeout(600)

    expect(await folderCalls(page)).toHaveLength(0)
  })
})

test.describe('folder picker — failure does not block uploading', () => {
  test('an auth failure explains itself instead of showing an empty tree', async ({
    page
  }) => {
    await setupSproutMocks(page, {
      folders: SAMPLE_TREE,
      failWith:
        'Sprout rejected the folder request: HTTP 401 — check your Sprout Video API key in Settings.'
    })
    const trigger = await openPicker(page)
    await trigger.click()

    await expect(page.getByText(/check your Sprout Video API key/i)).toBeVisible()
    await expect(page.getByText(/still upload to the root folder/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible()
  })

  test('Root stays selectable when folders cannot load', async ({ page }) => {
    await setupSproutMocks(page, {
      folders: SAMPLE_TREE,
      failWith: 'Could not reach Sprout Video: timeout'
    })
    const trigger = await openPicker(page)
    await trigger.click()

    await page.getByRole('menuitem', { name: /Root \(no folder\)/ }).click()
    await expect(trigger).toContainText('Root (no folder)')
  })
})
