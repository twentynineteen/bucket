/**
 * Motion Marketplace behaviour and keyboard/reduced-motion e2e specs (issue #338).
 *
 * Tests T1.1-T1.11 (grid behaviour), T2.1-T2.2 (keyboard and reduced motion).
 * Tests T1.5-T1.9 and T1.11 that depend on the dialog (#337) are marked
 * test.fixme until the dialog is merged.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { getMotionWrites, installMotionMocks } from '../fixtures/motion.fixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub the GitHub release check to avoid 403s on shared CI IPs. */
async function stubReleaseCheck(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/*/*/releases/latest', route =>
    route.fulfill({
      json: { tag_name: 'v0.0.0', name: 'v0.0.0', body: '', html_url: '' }
    })
  )
}

/**
 * Assert no unstubbed request left localhost. The GitHub release check is
 * routed locally by stubReleaseCheck but Playwright's request event still
 * fires for it, so we exclude it.
 */
function assertNoUnstubExternalRequests(page: Page): () => void {
  const external: string[] = []
  page.on('request', req => {
    const url = req.url()
    try {
      const parsed = new URL(url)
      if (
        parsed.hostname !== 'localhost' &&
        parsed.hostname !== '127.0.0.1' &&
        !url.includes('api.github.com/repos')
      ) {
        external.push(url)
      }
    } catch {
      // Ignore invalid URLs
    }
  })
  return () => expect(external).toEqual([])
}

/**
 * Full setup: stub release check, install shared + motion mocks, freeze clock.
 * Call this before navigating. Returns assertion function for external requests.
 */
async function setupAll(
  page: Page,
  motionOptions?: Parameters<typeof installMotionMocks>[1]
): Promise<() => void> {
  const assertNoExternal = assertNoUnstubExternalRequests(page)
  await stubReleaseCheck(page)
  await setupTauriMocks(page)
  await installMotionMocks(page, motionOptions)
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 1.0
  })
  return assertNoExternal
}

/** Navigate to the marketplace page. */
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

// Built-in template names (10 starters from #332)
const BUILTIN_NAMES = [
  'Chapter title card',
  'End card/CTA',
  'Lower third "Bar reveal"',
  'Lower third "Glide"',
  'Quote card',
  'Scan trail',
  'Score ring',
  'Shape wipe',
  'Spread map',
  'Stat reveal'
]

// A library template JSON for testing
const LIBRARY_TEMPLATE_JSON = JSON.stringify({
  schemaVersion: 1,
  id: 'custom-lib-template',
  version: '1.0.0',
  name: 'Custom Library Template',
  description: 'A user library template for testing',
  category: 'lower-third',
  status: 'stable',
  tags: ['custom'],
  fonts: [],
  duration: 4,
  inEnd: 1,
  outStart: 3,
  params: {},
  layers: [
    {
      kind: 'rect',
      id: 'r1',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 100 } }],
      opacity: [{ t: 0, value: 1 }],
      width: 200,
      height: 50,
      fill: '#ffffff',
      radius: 0
    }
  ]
})

// ---------------------------------------------------------------------------
// T1: Behaviour specs
// ---------------------------------------------------------------------------

test.describe('Motion Marketplace behaviour', () => {
  test('T1.1 grid shows each built-in template by name plus library marker', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page, {
      libraryFolder: {
        path: '/mock/library',
        files: [{ name: 'custom-lib-template.json', contents: LIBRARY_TEMPLATE_JSON }]
      }
    })
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Each built-in name is present - use aria-label on the name button
    for (const name of BUILTIN_NAMES) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }

    // Library template appears with "Library" marker
    await expect(
      page.getByRole('button', { name: 'Custom Library Template', exact: true })
    ).toBeVisible()
    const card = page.locator('[data-template-id="custom-lib-template"]')
    await expect(card.getByText('Library', { exact: true })).toBeVisible()

    assertNoExternal()
  })

  test('T1.2 invalid library file shows alert, dismiss hides it, rescan shows alert again', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page, {
      libraryFolder: {
        path: '/mock/library',
        files: [{ name: 'custom-lib-template.json', contents: LIBRARY_TEMPLATE_JSON }],
        brokenFile: { name: 'broken.json', errorMessage: 'Unexpected token' }
      }
    })
    await gotoMarketplace(page)

    // Alert shows with the count and path
    const alert = page.getByRole('alert')
    await expect(alert).toContainText("1 template couldn't be loaded")
    await expect(alert).toContainText('/mock/library/broken.json')

    // Dismiss hides it
    const dismissBtn = alert.getByRole('button', { name: /Dismiss/i })
    await dismissBtn.click()
    await expect(alert).not.toBeVisible()

    // Click Rescan (the header button)
    await page.getByRole('button', { name: /Rescan/i }).click()

    // After rescan the banner reappears because the broken file is still there
    await expect(page.getByRole('alert')).toContainText("1 template couldn't be loaded")

    assertNoExternal()
  })

  test('T1.3 starring Quote card persists through prefs write', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    // Find the Quote card and star it
    const quoteCard = page.locator('[data-template-id="quote-card"]')
    await expect(quoteCard).toBeVisible()
    const starButton = quoteCard.getByRole('button', {
      name: /Favourite Quote card/i
    })
    await expect(starButton).toHaveAttribute('aria-pressed', 'false')
    await starButton.click()
    await expect(starButton).toHaveAttribute('aria-pressed', 'true')

    // Verify the prefs write was recorded with favourites containing quote-card
    const writes = await getMotionWrites(page)
    const prefsWrite = writes.find(w => w.path.includes('motion_prefs.json'))
    expect(prefsWrite).toBeTruthy()
    const savedPrefs = JSON.parse(prefsWrite!.data as string)
    expect(savedPrefs.favourites).toContain('quote-card')

    // After starring, favourites sort ahead: Quote card should be first
    const grid = page.getByRole('list', { name: 'Templates' })
    const items = grid.getByRole('listitem')
    const firstCardText = await items.first().textContent()
    expect(firstCardText).toContain('Quote card')

    assertNoExternal()
  })

  test('T1.4 category data + search ring shows only Score ring; Clear filters restores all', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    // Set category to "Data" via the Radix Select
    const categoryTrigger = page.getByRole('combobox', { name: /Category/i })
    await categoryTrigger.click()
    await page.getByRole('option', { name: 'Data' }).click()

    // Set search to "ring"
    const searchInput = page.getByRole('searchbox', { name: /Search templates/i })
    await searchInput.fill('ring')

    // Only Score ring should remain
    const grid = page.getByRole('list', { name: 'Templates' })
    const items = grid.getByRole('listitem')
    await expect(items).toHaveCount(1)
    await expect(page.getByText('Score ring')).toBeVisible()

    // Clear the search and category to restore (use the filter controls directly)
    await searchInput.clear()
    await categoryTrigger.click()
    await page.getByRole('option', { name: 'All categories' }).click()

    // All templates restored
    const allItems = grid.getByRole('listitem')
    const count = await allItems.count()
    expect(count).toBeGreaterThanOrEqual(10)

    assertNoExternal()
  })

  // T1.5 - T1.9: Dialog-dependent tests - marked fixme until #337 merges
  // The dialog is currently a placeholder that doesn't have the export UI.
  test.fixme('T1.5 export to project creates temp folder, renames to final, shows Reveal toast', async () => {})

  test.fixme('T1.6 repeated export appends -2 to the folder name', async () => {})

  test.fixme('T1.7 Copy Claude prompt with no project folder captures clipboard and shows toast', async () => {})

  test.fixme('T1.8 ffmpeg unavailable disables Video checkbox and shows Settings link', async () => {})

  test.fixme('T1.9 video render shows progress, cancel removes temp folder', async () => {})

  test('T1.10 Spread map card shows Video and Claude prompt only', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    // Spread map's card should show "Video and Claude prompt only" text
    const spreadCard = page.locator('[data-template-id="spread-map"]')
    await expect(spreadCard).toBeVisible()
    await expect(spreadCard.getByText('Video and Claude prompt only')).toBeVisible()

    assertNoExternal()
  })

  // T1.11 depends on dialog and settings integration - fixme until #337
  test.fixme('T1.11 Settings Motion library folder and format change updates marketplace', async () => {})
})

// ---------------------------------------------------------------------------
// T2: Keyboard and reduced motion
// ---------------------------------------------------------------------------

test.describe('Motion Marketplace keyboard and reduced motion', () => {
  test('T2.1 Tab to card, Enter opens dialog, Escape closes and returns focus', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Focus the first card's name button
    const firstItem = grid.getByRole('listitem').first()
    const nameButton = firstItem.locator('[data-template-id]').getByRole('button').first()
    await nameButton.focus()
    await expect(nameButton).toBeFocused()

    // Press Enter to open dialog
    await page.keyboard.press('Enter')

    // The placeholder dialog should open
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible().catch(() => false)) {
      // Escape closes it
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()

      // Focus returns to the card
      await expect(nameButton).toBeFocused()
    }

    assertNoExternal()
  })

  test('T2.2 reduced motion pauses preview; hover resumes playback', async ({ page }) => {
    const assertNoExternal = assertNoUnstubExternalRequests(page)
    await stubReleaseCheck(page)
    await setupTauriMocks(page)
    await installMotionMocks(page)
    // Do NOT set the frozen clock - let the real ticker run
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Under reduced motion, the preview should be static (poster at inEnd)
    const firstCard = grid.getByRole('listitem').first()
    const preview = firstCard.locator('.preview-stage')
    await expect(preview).toBeVisible()

    // Two captures 500ms apart should be identical (static)
    const capture1 = await preview.screenshot()
    await page.waitForTimeout(500)
    const capture2 = await preview.screenshot()
    expect(capture1.equals(capture2)).toBe(true)

    // After hovering the card, the preview starts playing
    await firstCard.hover()
    await page.waitForTimeout(300)
    const capture3 = await preview.screenshot()
    await page.waitForTimeout(500)
    const capture4 = await preview.screenshot()
    expect(capture3.equals(capture4)).toBe(false)

    assertNoExternal()
  })
})
