/**
 * Motion Marketplace behaviour and keyboard/reduced-motion e2e specs (issue #338).
 *
 * Tests T1.1-T1.11 (grid behaviour), T2.1-T2.2 (keyboard and reduced motion).
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import {
  getMotionClipboard,
  getMotionRenames,
  getMotionWrites,
  installMotionMocks
} from '../fixtures/motion.fixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert no request left localhost. The GitHub release check is stubbed
 * centrally by stubGitHubReleases (called inside setupTauriMocks) and
 * fulfilled locally by Playwright's route handler, but the request event
 * still fires for it, so we exclude api.github.com.
 */
function assertNoExternalRequests(page: Page): () => void {
  const external: string[] = []
  page.on('request', req => {
    const url = req.url()
    try {
      const parsed = new URL(url)
      if (
        parsed.hostname !== 'localhost' &&
        parsed.hostname !== '127.0.0.1' &&
        parsed.hostname !== 'api.github.com'
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
 * Full setup: install shared + motion mocks (which stub the GitHub release
 * check), freeze clock. Call before navigating. Returns assertion function
 * for external requests.
 */
async function setupAll(
  page: Page,
  motionOptions?: Parameters<typeof installMotionMocks>[1]
): Promise<() => void> {
  const assertNoExternal = assertNoExternalRequests(page)
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

/** Open a template card's dialog by clicking its name button. */
async function openDialog(page: Page, templateId: string): Promise<void> {
  const card = page.locator(`[data-template-id="${templateId}"]`)
  await expect(card).toBeVisible()
  const nameButton = card.getByRole('button').first()
  await nameButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
        files: [
          {
            name: 'custom-lib-template.json',
            contents: LIBRARY_TEMPLATE_JSON
          }
        ]
      }
    })
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    for (const name of BUILTIN_NAMES) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }

    await expect(
      page.getByRole('button', {
        name: 'Custom Library Template',
        exact: true
      })
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
        files: [
          {
            name: 'custom-lib-template.json',
            contents: LIBRARY_TEMPLATE_JSON
          }
        ],
        brokenFile: {
          name: 'broken.json',
          errorMessage: 'Unexpected token'
        }
      }
    })
    await gotoMarketplace(page)

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("1 template couldn't be loaded")
    await expect(alert).toContainText('/mock/library/broken.json')

    const dismissBtn = alert.getByRole('button', { name: /Dismiss/i })
    await dismissBtn.click()
    await expect(alert).not.toBeVisible()

    await page.getByRole('button', { name: /Rescan/i }).click()
    await expect(page.getByRole('alert')).toContainText("1 template couldn't be loaded")

    assertNoExternal()
  })

  test('T1.3 starring Quote card persists through prefs write', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    const quoteCard = page.locator('[data-template-id="quote-card"]')
    await expect(quoteCard).toBeVisible()
    const starButton = quoteCard.getByRole('button', {
      name: /Favourite Quote card/i
    })
    await expect(starButton).toHaveAttribute('aria-pressed', 'false')
    await starButton.click()
    await expect(starButton).toHaveAttribute('aria-pressed', 'true')

    const writes = await getMotionWrites(page)
    const prefsWrite = writes.find(w => w.path.includes('motion_prefs.json'))
    expect(prefsWrite).toBeTruthy()
    const savedPrefs = JSON.parse(prefsWrite!.data as string)
    expect(savedPrefs.favourites).toContain('quote-card')

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

    const categoryTrigger = page.getByRole('combobox', { name: /Category/i })
    await categoryTrigger.click()
    await page.getByRole('option', { name: 'Data' }).click()

    const searchInput = page.getByRole('searchbox', {
      name: /Search templates/i
    })
    await searchInput.fill('ring')

    const grid = page.getByRole('list', { name: 'Templates' })
    const items = grid.getByRole('listitem')
    await expect(items).toHaveCount(1)
    await expect(page.getByText('Score ring')).toBeVisible()

    await searchInput.clear()
    await categoryTrigger.click()
    await page.getByRole('option', { name: 'All categories' }).click()

    const allItems = grid.getByRole('listitem')
    const count = await allItems.count()
    expect(count).toBeGreaterThanOrEqual(10)

    assertNoExternal()
  })

  test('T1.5 export to project writes to temp folder, renames, shows Reveal toast', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page, {
      projectFolder: {
        path: '/mock/project',
        hasBreadcrumbs: true,
        hasGraphicsMotion: true
      }
    })
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')

    // Fill the name param with a Unicode name
    const nameInput = dialog.getByRole('textbox', { name: /Name/i })
    await nameInput.clear()
    await nameInput.fill('Zoë Ångström')

    // Pick the project folder
    const folderBtn = dialog.getByRole('button', {
      name: /Choose project folder/i
    })
    await folderBtn.click()

    // Select targets: AE + Claude prompt (default for non-particle)
    // Targets should already be checked by default

    // This spec is about the bundle (temp folder, rename, toast). Rendering a
    // 4K ProRes video here makes it as slow as the CI machine; the video path
    // has its own spec (T1.9) and unit tests.
    await dialog.getByRole('checkbox', { name: 'Video', exact: true }).uncheck()

    // Click Export to project
    const exportBtn = dialog.getByRole('button', {
      name: /Export to project/i
    })
    await expect(exportBtn).toBeEnabled()
    await exportBtn.click()

    // Wait for the success toast
    await expect(page.getByText('Exported to project')).toBeVisible()
    await expect(page.getByText('Reveal in Finder')).toBeVisible()

    // Check recorded writes went to the right path
    const renames = await getMotionRenames(page)
    expect(renames.length).toBeGreaterThan(0)
    const lastRename = renames[renames.length - 1]

    // The temp folder should start with .tmp-lower-third-glide-
    expect(lastRename.oldPath).toContain('.tmp-lower-third-glide-')
    // The final folder should be lower-third-glide-zoe-angstrom
    expect(lastRename.newPath).toContain('lower-third-glide-zoe-angstrom')
    expect(lastRename.newPath).toContain('/Graphics/Motion/')

    // Check params.json was written and has no absolute paths
    const writes = await getMotionWrites(page)
    const paramsWrite = writes.find(w => w.path.includes('params.json'))
    expect(paramsWrite).toBeTruthy()
    const params = JSON.parse(paramsWrite!.data as string)
    expect(params.templateId).toBe('lower-third-glide')
    // No absolute paths in params
    const paramsStr = JSON.stringify(params)
    expect(paramsStr).not.toContain('/mock/')
    expect(paramsStr).not.toContain('/Users/')

    assertNoExternal()
  })

  test('T1.6 repeated export appends -2 to the folder name', async ({ page }) => {
    const assertNoExternal = await setupAll(page, {
      projectFolder: {
        path: '/mock/project',
        hasBreadcrumbs: true,
        hasGraphicsMotion: true,
        existingMotionFolders: ['lower-third-glide-jane-doe']
      }
    })
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')
    const nameInput = dialog.getByRole('textbox', { name: /Name/i })
    await nameInput.clear()
    await nameInput.fill('Jane Doe')

    // Pick project folder
    await dialog.getByRole('button', { name: /Choose project folder/i }).click()

    // This spec is about the bundle (temp folder, rename, toast). Rendering a
    // 4K ProRes video here makes it as slow as the CI machine; the video path
    // has its own spec (T1.9) and unit tests.
    await dialog.getByRole('checkbox', { name: 'Video', exact: true }).uncheck()

    // Export
    await dialog.getByRole('button', { name: /Export to project/i }).click()
    await expect(page.getByText('Exported to project')).toBeVisible()

    // The final rename should use -2 suffix since the base name exists
    const renames = await getMotionRenames(page)
    const lastRename = renames[renames.length - 1]
    expect(lastRename.newPath).toContain('lower-third-glide-jane-doe-2')

    assertNoExternal()
  })

  test('T1.7 Copy Claude prompt with no project folder captures clipboard and shows toast', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')

    // Click Copy Claude prompt (no project folder needed)
    const copyBtn = dialog.getByRole('button', {
      name: /Copy Claude prompt/i
    })
    await expect(copyBtn).toBeEnabled()
    await copyBtn.click()

    // Toast appears
    await expect(page.getByText('Prompt copied to clipboard')).toBeVisible()

    // Clipboard was captured
    const clipboard = await getMotionClipboard(page)
    expect(clipboard).toBeTruthy()
    // Prompt starts with the template name as a heading
    expect(clipboard!).toContain('# Lower third "Glide"')

    assertNoExternal()
  })

  test('T1.8 ffmpeg unavailable disables Video checkbox and shows Settings link', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page, {
      ffmpegAvailable: false
    })
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')

    // Video checkbox should be disabled
    const videoCheckbox = dialog.getByRole('checkbox', {
      name: /Video/i
    })
    await expect(videoCheckbox).toBeDisabled()

    // Settings link should be visible
    const settingsLink = dialog.getByRole('link', {
      name: /Set up ffmpeg in Settings/i
    })
    await expect(settingsLink).toBeVisible()
    await expect(settingsLink).toHaveAttribute('href', '/settings/general#kavanagh')

    assertNoExternal()
  })

  test('T1.9 video render shows progress, cancel stops the export', async ({ page }) => {
    const assertNoExternal = await setupAll(page, {
      projectFolder: {
        path: '/mock/project',
        hasBreadcrumbs: true,
        hasGraphicsMotion: true
      },
      renderProgressFrames: [1, 2, 3, 4, 5],
      // Each frame takes 500ms so the render loop runs long enough for the
      // progress UI to appear and the test to click Cancel
      renderFrameDelayMs: 500
    })
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')

    // Uncheck all non-video targets so the export only renders video.
    // Use exact name matching to avoid the "After Effects" / "Premiere
    // (mogrt via After Effects)" ambiguity.
    for (const label of [
      'After Effects',
      'DaVinci Resolve',
      'Premiere (mogrt via After Effects)',
      'Claude prompt'
    ]) {
      const cb = dialog.getByRole('checkbox', { name: label, exact: true })
      if (await cb.isChecked()) await cb.click()
    }

    // Pick project folder
    await dialog.getByRole('button', { name: /Choose project folder/i }).click()

    // Export with only Video checked
    await dialog.getByRole('button', { name: /Export to project/i }).click()

    // The "Rendering video" label or progress bar should appear
    await expect(dialog.getByText('Rendering video')).toBeVisible()

    // Cancel the render
    const cancelBtn = dialog.getByRole('button', { name: /Cancel render/i })
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()

    // After cancel, the Export button becomes enabled again (not exporting)
    await expect(dialog.getByRole('button', { name: /Export to project/i })).toBeEnabled()

    assertNoExternal()
  })

  test('T1.10 Spread map card shows Video and Claude prompt only', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    const spreadCard = page.locator('[data-template-id="spread-map"]')
    await expect(spreadCard).toBeVisible()
    await expect(spreadCard.getByText('Video and Claude prompt only')).toBeVisible()

    // Open the dialog - only Video and Claude prompt checkboxes should exist
    await openDialog(page, 'spread-map')
    const dialog = page.getByRole('dialog')

    // Video and Claude prompt should be present
    await expect(dialog.getByRole('checkbox', { name: /Video/i })).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: /Claude prompt/i })).toBeVisible()

    // After Effects, Resolve and Premiere should NOT be present
    await expect(
      dialog.getByRole('checkbox', { name: /After Effects/i })
    ).not.toBeVisible()
    await expect(
      dialog.getByRole('checkbox', { name: /DaVinci Resolve/i })
    ).not.toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: /Premiere/i })).not.toBeVisible()

    assertNoExternal()
  })

  test('T1.11 Settings Motion format change is reflected in dialog', async ({ page }) => {
    const assertNoExternal = await setupAll(page, {
      prefs: {
        defaultFormat: { width: 1920, height: 1080, fps: 25 }
      }
    })
    await gotoMarketplace(page)
    await openDialog(page, 'lower-third-glide')

    const dialog = page.getByRole('dialog')

    // Format should show the configured default
    const formatTrigger = dialog.getByRole('combobox', { name: /Format/i })
    await expect(formatTrigger).toContainText('1920')
    await expect(formatTrigger).toContainText('1080')
    await expect(formatTrigger).toContainText('25')

    assertNoExternal()
  })
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

    const firstItem = grid.getByRole('listitem').first()
    const nameButton = firstItem.locator('[data-template-id]').getByRole('button').first()
    await nameButton.focus()
    await expect(nameButton).toBeFocused()

    // Enter opens dialog
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Tab reaches param inputs, format, targets and export button
    // Just verify Tab moves focus within the dialog
    await page.keyboard.press('Tab')
    const focusedInDialog = await dialog.evaluate(el =>
      el.contains(document.activeElement)
    )
    expect(focusedInDialog).toBe(true)

    // Escape closes
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // Focus returns to the same card
    await expect(nameButton).toBeFocused()

    assertNoExternal()
  })

  test('T2.2 reduced motion pauses preview; hover resumes playback', async ({ page }) => {
    const assertNoExternal = assertNoExternalRequests(page)
    await setupTauriMocks(page)
    await installMotionMocks(page)
    // Do NOT set the frozen clock - let the real ticker run
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    const firstCard = grid.getByRole('listitem').first()
    const preview = firstCard.locator('.preview-stage')
    await expect(preview).toBeVisible()

    // Two captures 500ms apart should be identical (static)
    const capture1 = await preview.screenshot()
    await page.waitForTimeout(500)
    const capture2 = await preview.screenshot()
    expect(capture1.equals(capture2)).toBe(true)

    // After hovering the card, the preview starts playing. Templates hold
    // still for seconds mid-loop, so sample across a full loop and pass as
    // soon as a frame differs; a paused preview never does.
    await firstCard.hover()
    const start = await preview.screenshot()
    let changed = false
    for (let i = 0; i < 25 && !changed; i++) {
      await page.waitForTimeout(250)
      changed = !start.equals(await preview.screenshot())
    }
    expect(changed, 'hovered preview never changed across a full loop').toBe(true)

    assertNoExternal()
  })

  // -------------------------------------------------------------------------
  // W6: Line wrapping E2E
  // -------------------------------------------------------------------------

  test('W6.1 typing a long quote shows it on several lines in the preview', async ({
    page
  }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    // Open the Quote card dialog
    const quoteCard = page.locator('[data-template-id="quote-card"]')
    await expect(quoteCard).toBeVisible()
    await quoteCard.getByRole('button', { name: 'Quote card', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Type a long quote that will wrap. At the approximation (88 x 0.6),
    // width 1900 fits ~36 chars per line, so 87 chars wraps to 3 lines.
    const quoteInput = dialog.getByRole('textbox', { name: /Quote/i })
    await expect(quoteInput).toBeVisible()
    const longQuote =
      'The only way to do great work is to love what you do and keep pushing forward every day'
    await quoteInput.fill(longQuote)

    // The preview should show the wrapped text across multiple tspans.
    // Verify by reading the tspan text content and checking the lines
    // contain the expected words.
    const previewImg = dialog.getByRole('img', { name: /Quote card.*preview/i })
    await expect(previewImg).toBeVisible()
    const tspans = previewImg.locator('tspan')
    await expect(tspans.first()).toBeVisible({ timeout: 3000 })
    const tspanCount = await tspans.count()
    expect(
      tspanCount,
      'wrapped quote should produce at least two tspans'
    ).toBeGreaterThanOrEqual(2)

    // Collect the tspan texts and verify they reassemble the original
    const lineTexts: string[] = []
    for (let i = 0; i < tspanCount; i++) {
      const t = await tspans.nth(i).textContent()
      if (t) lineTexts.push(t)
    }
    const reassembled = lineTexts.join(' ').replace(/\s+/g, ' ').trim()
    expect(reassembled).toBe(longQuote)

    assertNoExternal()
  })

  test('W6.1 grid card shows the default quote with line tspans', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    const quoteCard = page.locator('[data-template-id="quote-card"]')
    await expect(quoteCard).toBeVisible()

    const svg = quoteCard.locator('svg').first()
    await expect(svg).toBeVisible()

    // Find the quote text element by its content (not the decorative mark).
    // The default quote wraps at width 1900 with any measurer, so it has
    // at least 2 tspans (one per line).
    const allText = svg.locator('text')
    await expect(allText.first()).toBeVisible({ timeout: 3000 })
    const textCount = await allText.count()
    let quoteTspanCount = 0
    for (let i = 0; i < textCount; i++) {
      const content = await allText.nth(i).textContent()
      if (content && content.includes('Design')) {
        quoteTspanCount = await allText.nth(i).locator('tspan').count()
        break
      }
    }
    expect(
      quoteTspanCount,
      'default quote text should have at least 2 line tspans'
    ).toBeGreaterThanOrEqual(2)

    assertNoExternal()
  })

  test('W6.2 line-count error shows and disables export', async ({ page }) => {
    const assertNoExternal = await setupAll(page, {
      projectFolder: { path: '/tmp/test', hasBreadcrumbs: true }
    })
    await gotoMarketplace(page)

    const quoteCard = page.locator('[data-template-id="quote-card"]')
    await expect(quoteCard).toBeVisible()
    await quoteCard.getByRole('button', { name: 'Quote card', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Type text that exceeds maxLines under both the approximation and the
    // canvas measurer. At 88 x 0.6 per char, width 1900 fits ~36 chars per
    // line, so maxLines 4 allows ~144 chars. 120 chars / 36 = ~3.3 lines,
    // which fits in 4. But if we repeat "WWWW " (wide words), the canvas
    // measurer measures each W wider than 0.6 em, pushing to 5+ lines.
    //
    // For the approximation path: 120 * 88 * 0.6 = 6336. At width 1900,
    // that needs ceil(6336 / 1900) = 4 lines. That equals maxLines, so
    // it fits. We need a shorter width or longer text - but maxLength is 120.
    //
    // Use the approximation: at 120 chars, 6336 / 1900 = 3.3 -> 4 lines
    // (balanced wrapping may use 4). The canvas measurer measures wider,
    // so it needs 5+ lines, exceeding maxLines 4. Either way: the canvas
    // path always triggers the error.
    const quoteInput = dialog.getByRole('textbox', { name: /Quote/i })
    await expect(quoteInput).toBeVisible()
    await quoteInput.fill('W'.repeat(120))
    await page.waitForTimeout(500)

    // The canvas measurer in the browser measures 'W' wider than 0.6 em,
    // so 120 W's at size 88 exceeds 4 lines at width 1900.
    const linesError = dialog.getByText(/lines/i)
    await expect(linesError).toBeVisible({ timeout: 3000 })

    const exportBtn = dialog.getByRole('button', { name: /Export to project/i })
    await expect(exportBtn).toBeDisabled()

    assertNoExternal()
  })
})
