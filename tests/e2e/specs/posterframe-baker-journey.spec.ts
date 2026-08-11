/**
 * E2E: the poster frame dialogs reached the way a user reaches them.
 * Issue #166 (B6.1-B6.4)
 *
 * usePosterFrameForUpload is consumed by Baker's AddVideoDialog and
 * SetPosterFrameDialog, not by /upload/sprout, so proving those surfaces report
 * the right cause means walking Baker: pick a drive, scan, open a project, then
 * open the dialog. The folder-only states live in posterframe-backgrounds.spec.ts;
 * this file exists to prove the reason survives the journey to the dialog.
 *
 * IPC is mocked, so this proves wiring and not real filesystem semantics. See
 * docs/posterframe-background-verification.md for the manual steps.
 *
 * Two kinds of test live here, and it matters which is which:
 *
 *   Proves the fix. Asserts a string that does not exist before this change
 *   ("Cannot read background folder", "Could not read your settings"), so it
 *   fails against the unfixed code. These are the cannot-read and
 *   settings-unreadable cases.
 *
 *   Guards preserved behaviour. Asserts the empty-folder and absent-font
 *   messages, which are unchanged (B6.2, B6.4), so it passes before and after.
 *   Its value is catching this change breaking a path it was not meant to
 *   touch, not demonstrating the fix. Do not read it as evidence of one.
 */
import { expect, test, type Page } from '@playwright/test'

import {
  DEFAULT_FOLDER,
  LINKED_VIDEO_TITLE,
  PROJECT_NAME,
  installBackgroundMocks,
  type BackgroundMockOptions
} from '../fixtures/posterframe-backgrounds.fixture'

const CANNOT_READ = `Cannot read background folder: ${DEFAULT_FOLDER}`

/**
 * Walk Baker as far as the selected project's detail panel.
 *
 * The scan completes through useBakerScan's 2s status poll rather than an
 * emitted event, so the project list is deliberately awaited generously.
 */
async function openProject(page: Page, options: BackgroundMockOptions) {
  await installBackgroundMocks(page, { ...options, bakerJourney: true })
  await page.goto('/ingest/baker')

  // Pick the drive. The mock returns a root path for any titled folder dialog.
  await page.getByRole('button', { name: /select|choose|browse/i }).first().click()

  await page
    .getByRole('button', { name: /^(start )?scan/i })
    .first()
    .click()

  // Poll-driven completion: the project appears once the scan reports endTime.
  await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 20000 })
  await page.getByText(PROJECT_NAME).first().click()

  // The detail panel opens on Overview; VideoLinksManager lives behind Videos.
  await page.getByRole('tab', { name: /^videos/i }).click()

  await expect(page.getByRole('heading', { name: /video links/i })).toBeVisible({
    timeout: 15000
  })
}

/**
 * Open the upload tab and pick a file, because the poster frame panel only
 * renders once a file is selected (AddVideoDialog.tsx:528).
 */
async function openUploadTabWithFile(page: Page) {
  await page.getByRole('tab', { name: /upload file/i }).click()
  await page.getByRole('button', { name: /select video file/i }).click()
  // The panel appears with the file; its heading is the checkbox label.
  await expect(page.getByText(/create branded poster frame/i)).toBeVisible({
    timeout: 15000
  })
}

test.describe('Baker > Add Video dialog', () => {
  test('names a background folder it cannot read, and blocks the option', async ({
    page
  }) => {
    await openProject(page, { scenario: 'missing' })

    await page.getByRole('button', { name: /^add video$/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await openUploadTabWithFile(page)

    await expect(page.getByText(CANNOT_READ)).toBeVisible()
    // The pre-fix bug: this said "contains no image files" for an absent folder.
    await expect(page.getByText(/contains no image files/i)).toBeHidden()
    await expect(
      page.getByRole('checkbox', { name: /create branded poster frame/i })
    ).toBeDisabled()
  })

  // Regression guard: passes before this change too (B6.2 unchanged).
  test('reports an empty folder as empty, not as unreadable', async ({ page }) => {
    await openProject(page, { scenario: 'empty' })

    await page.getByRole('button', { name: /^add video$/i }).first().click()
    await openUploadTabWithFile(page)

    await expect(page.getByText(/contains no image files/i)).toBeVisible()
    await expect(page.getByText(/cannot read background folder/i)).toBeHidden()
  })

  // Regression guard: passes before this change too (B6.4 unchanged).
  test('blames the font, not the folder, when only the font is absent', async ({
    page
  }) => {
    await openProject(page, { scenario: 'ready', fontInstalled: false })

    await page.getByRole('button', { name: /^add video$/i }).first().click()
    await openUploadTabWithFile(page)

    await expect(page.getByText(/requires Cabrito\.otf/i)).toBeVisible()
    await expect(page.getByText(/cannot read background folder/i)).toBeHidden()
  })

  // Regression guard: the happy path must survive the new gating.
  test('offers the option with no warning when everything is present', async ({
    page
  }) => {
    await openProject(page, { scenario: 'ready' })

    await page.getByRole('button', { name: /^add video$/i }).first().click()
    await openUploadTabWithFile(page)

    await expect(
      page.getByRole('checkbox', { name: /create branded poster frame/i })
    ).toBeEnabled()
    await expect(page.getByText(/cannot read background folder/i)).toBeHidden()
    await expect(page.getByText(/contains no image files/i)).toBeHidden()
  })
})

test.describe('Baker > Set poster frame dialog', () => {
  test('names a background folder it cannot read, and disables the action', async ({
    page
  }) => {
    await openProject(page, { scenario: 'missing', withLinkedVideo: true })

    await expect(page.getByText(LINKED_VIDEO_TITLE)).toBeVisible()
    await page.getByRole('button', { name: /^set poster frame$/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(CANNOT_READ)).toBeVisible()
    await expect(dialog.getByText(/contains no image files/i)).toBeHidden()
    await expect(
      dialog.getByRole('button', { name: /^set poster frame$/i })
    ).toBeDisabled()
  })

  test('says the folder is unknown when settings could not be read', async ({ page }) => {
    await openProject(page, { settingsUnreadable: true, withLinkedVideo: true })

    await page.getByRole('button', { name: /^set poster frame$/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/could not read your settings/i)).toBeVisible()
    // Must not send the user to Settings to re-enter a path that is already set.
    await expect(
      dialog.getByText(/no default background folder configured/i)
    ).toBeHidden()
  })
})
