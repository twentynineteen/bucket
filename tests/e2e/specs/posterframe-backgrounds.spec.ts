/**
 * E2E: background folder diagnostics across the three surfaces that consume it.
 * Issue #166
 *
 * The reported bug was that a configured-but-absent folder was indistinguishable
 * from no configuration at all. These specs drive each state through the real UI
 * and assert what the user is actually told.
 *
 * IPC is mocked, so the real-filesystem behaviour these states model is verified
 * by hand per docs/posterframe-background-verification.md.
 */
import { expect, test } from '@playwright/test'

import {
  DEFAULT_FOLDER,
  attemptedListings,
  installBackgroundMocks
} from '../fixtures/posterframe-backgrounds.fixture'

const POSTERFRAME_ROUTE = '/upload/posterframe'
const SETTINGS_BACKGROUNDS_ROUTE = '/settings/general#backgrounds'

test.describe('Posterframe page', () => {
  test('names the folder it cannot read and keeps the picker available', async ({
    page
  }) => {
    await installBackgroundMocks(page, { scenario: 'missing' })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(
      page.getByText(`Cannot read Classic background folder: ${DEFAULT_FOLDER}`)
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /select background folder/i })
    ).toBeEnabled()
    // The old failure mode: an empty picker and no explanation at all.
    await expect(page.getByText(/contains no image files/i)).toBeHidden()
  })

  test('gives the same message for a folder it cannot list', async ({ page }) => {
    await installBackgroundMocks(page, { scenario: 'unreadable' })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(
      page.getByText(`Cannot read Classic background folder: ${DEFAULT_FOLDER}`)
    ).toBeVisible()
    // The os error detail belongs in the log, not on screen.
    await expect(page.getByText(/os error 13/i)).toBeHidden()
  })

  test('explains a folder that holds no images', async ({ page }) => {
    await installBackgroundMocks(page, { scenario: 'empty' })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(page.getByText(/contains no image files/i)).toBeVisible()
  })

  test('explains that no folder is configured', async ({ page }) => {
    await installBackgroundMocks(page, { configured: false })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(page.getByText(/no classic background folder configured/i)).toBeVisible()
    // Nothing to list, so nothing should have been attempted.
    expect(await attemptedListings(page)).toEqual([])
  })

  test('says the folder is unknown when settings could not be read', async ({ page }) => {
    await installBackgroundMocks(page, { settingsUnreadable: true })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(page.getByText(/could not read your settings/i)).toBeVisible()
    // Must not claim nothing is configured: that is the contradiction #166 fixed.
    await expect(page.getByText(/no classic background folder configured/i)).toBeHidden()
  })

  test('recovers for the session via the picker, leaving the default alone', async ({
    page
  }) => {
    await installBackgroundMocks(page, { scenario: 'missing' })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(
      page.getByText(`Cannot read Classic background folder: ${DEFAULT_FOLDER}`)
    ).toBeVisible()
    await page.getByRole('button', { name: /select background folder/i }).click()

    // The dialog mock returns /Volumes/Media/session-bgs, which lists fine.
    await expect(page.getByText('/Volumes/Media/session-bgs')).toBeVisible()
    await expect(page.getByRole('button', { name: /use default/i })).toBeVisible()

    // The stored default is untouched, so Settings still shows it.
    await page.goto(SETTINGS_BACKGROUNDS_ROUTE)
    await expect(page.getByText(DEFAULT_FOLDER)).toBeVisible()
  })

  test('returns to the configured default when the override is reset', async ({
    page
  }) => {
    await installBackgroundMocks(page, { scenario: 'ready' })
    await page.goto(POSTERFRAME_ROUTE)

    await page.getByRole('button', { name: /select background folder/i }).click()
    await expect(page.getByRole('button', { name: /use default/i })).toBeVisible()

    await page.getByRole('button', { name: /use default/i }).click()

    await expect(page.getByRole('button', { name: /use default/i })).toBeHidden()
    await expect(page.getByText(DEFAULT_FOLDER)).toBeVisible()
  })

  test('shows no preview for a folder it is warning about', async ({ page }) => {
    await installBackgroundMocks(page, { scenario: 'unreadable' })
    await page.goto(POSTERFRAME_ROUTE)

    await expect(
      page.getByText(`Cannot read Classic background folder: ${DEFAULT_FOLDER}`)
    ).toBeVisible()
    await expect(page.getByText(/select a background to preview/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /generate thumbnail/i })).toBeDisabled()
  })
})

test.describe('Settings > Backgrounds', () => {
  test('shows a live path with no warning', async ({ page }) => {
    await installBackgroundMocks(page, { scenario: 'ready' })
    await page.goto(SETTINGS_BACKGROUNDS_ROUTE)

    await expect(page.getByText(DEFAULT_FOLDER)).toBeVisible()
    await expect(page.getByText(/cannot read this folder/i)).toBeHidden()
  })

  test('flags a path it cannot read', async ({ page }) => {
    await installBackgroundMocks(page, { scenario: 'missing' })
    await page.goto(SETTINGS_BACKGROUNDS_ROUTE)

    await expect(page.getByText(DEFAULT_FOLDER)).toBeVisible()
    await expect(page.getByText(/bucket cannot read this folder/i)).toBeVisible()
  })

  test('banners a settings read failure and disables saving', async ({ page }) => {
    await installBackgroundMocks(page, { settingsUnreadable: true })
    await page.goto(SETTINGS_BACKGROUNDS_ROUTE)

    await expect(page.getByText(/could not read your saved settings/i)).toBeVisible()
    // Sections still render, but must not overwrite a merely unparseable file.
    await expect(page.getByRole('heading', { name: /^backgrounds$/i })).toBeVisible()
    for (const save of await page.getByRole('button', { name: /^save$/i }).all()) {
      await expect(save).toBeDisabled()
    }
  })

  test('shows no banner on a first run with no settings file', async ({ page }) => {
    await installBackgroundMocks(page, { configured: false })
    await page.goto(SETTINGS_BACKGROUNDS_ROUTE)

    await expect(page.getByRole('heading', { name: /^backgrounds$/i })).toBeVisible()
    await expect(page.getByText(/could not read your saved settings/i)).toBeHidden()
  })
})

/*
 * The poster frame upload dialog (B6.1-B6.6) is deliberately NOT covered here.
 *
 * usePosterFrameForUpload is consumed by Baker's AddVideoDialog and
 * SetPosterFrameDialog and by Trello's useCardPosterFrame -- not by
 * /upload/sprout -- so reaching it end to end means driving a drive scan,
 * project selection and dialog open, which needs the Baker scan fixtures rather
 * than these filesystem ones.
 *
 * B6 is covered instead at:
 *   - hook level, usePosterFrameForUpload.test.ts (b6_1 to b6_6)
 *   - render level, Baker/components/SetPosterFrameDialog.test.tsx (b6_1, b6_3).
 *     The b4_* cases in that file belong to issue #141 and assert the older
 *     reason strings, so they do not cover this change on their own.
 *   - by hand, docs/posterframe-background-verification.md
 *
 * Still uncovered end to end: that Baker's AddVideoDialog and Trello's
 * useCardPosterFrame surface the reason in a real browser. Both render the same
 * panel state as SetPosterFrameDialog, so the render tests carry it.
 */
