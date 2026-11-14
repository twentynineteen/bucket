/**
 * E2E: the Baker scan workflow, as a user drives it.
 *
 * Every assertion in the previous version of this file was a soft check -
 * `expect(count).toBeGreaterThanOrEqual(0)` over a locator, or
 * `expect(typeof isVisible).toBe('boolean')` - so all ten tests reported green
 * while asserting nothing about Baker (issue #171 finding 5). Two causes:
 * `setupTauriMocks` answered `null` for every Baker command, so the project
 * list was always empty, and `pages/baker.page.ts` looked for a "Select" button
 * and a `[data-testid="scan-results"]` that do not exist in this UI. The
 * fixture now serves the scan data it always declared, and these assert what
 * is on screen.
 *
 * IPC is mocked, so this proves the wiring and the rendering, not real
 * filesystem semantics.
 *
 * Scan completion arrives through useBakerScan's 2s status poll rather than an
 * emitted event, so the project list is deliberately awaited generously.
 */
import { expect, test, type Page } from '@playwright/test'
import { SCAN_ROOT, setupTauriMocks } from '../fixtures/mocks.fixture'

const CURRENT_PROJECT = 'Project One'
const STALE_PROJECT = 'Project Two'
const NO_BREADCRUMBS_PROJECT = 'Project Three'

/** Open Baker with the scan mocks installed. */
async function openBaker(page: Page) {
  await setupTauriMocks(page)
  await page.goto('/ingest/baker')
  await expect(page.getByRole('heading', { level: 1, name: 'Baker' })).toBeVisible()
}

/** A project's row in the list: a button that holds the project's name. */
function rowFor(page: Page, projectName: string) {
  return page
    .getByRole('button')
    .filter({ has: page.getByText(projectName, { exact: true }) })
}

/** Pick the scan root and run a scan, then wait for the results to land. */
async function runScan(page: Page) {
  await openBaker(page)
  await page.getByRole('button', { name: 'Browse' }).click()
  await expect(page.getByRole('button', { name: 'Start Scan' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start Scan' }).click()

  await expect(page.getByText(CURRENT_PROJECT, { exact: true })).toBeVisible({
    timeout: 20000
  })
}

test.describe('Baker - before a scan', () => {
  test('offers a folder picker and refuses to scan until one is chosen', async ({
    page
  }) => {
    await openBaker(page)

    await expect(page.getByPlaceholder('No folder selected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Browse' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Scan' })).toBeDisabled()
    await expect(
      page.getByText('Select a folder and start a scan to find projects')
    ).toBeVisible()
  })

  test('enables the scan once a folder is picked, and shows which one', async ({
    page
  }) => {
    await openBaker(page)

    await page.getByRole('button', { name: 'Browse' }).click()

    await expect(page.getByPlaceholder('No folder selected')).toHaveValue(SCAN_ROOT)
    await expect(page.getByRole('button', { name: 'Start Scan' })).toBeEnabled()
  })
})

test.describe('Baker - scan results', () => {
  test('lists every project the scan found, with its breadcrumbs state', async ({
    page
  }) => {
    await runScan(page)

    await expect(page.getByText(STALE_PROJECT, { exact: true })).toBeVisible()
    await expect(page.getByText(NO_BREADCRUMBS_PROJECT, { exact: true })).toBeVisible()

    // One project of each breadcrumbs state, per the scan fixture. Each row
    // carries one status word on its meta line.
    await expect(rowFor(page, CURRENT_PROJECT).getByText('Current')).toBeVisible()
    await expect(rowFor(page, STALE_PROJECT).getByText('Stale')).toBeVisible()
    await expect(rowFor(page, NO_BREADCRUMBS_PROJECT).getByText('Missing')).toBeVisible()
  })

  test('summarises the scan in one sentence and links to what needs attention', async ({
    page
  }) => {
    await runScan(page)

    // Two of the three fixture projects (stale, missing) need attention.
    await expect(page.getByText('3 projects', { exact: true })).toBeVisible()
    await expect(page.getByText(/folders? scanned/)).toBeVisible()
    await page.getByRole('button', { name: '2 need attention' }).click()

    await expect(page.getByText(STALE_PROJECT, { exact: true })).toBeVisible()
    await expect(page.getByText(NO_BREADCRUMBS_PROJECT, { exact: true })).toBeVisible()
    await expect(page.getByText(CURRENT_PROJECT, { exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: /^Needs attention/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('filters the list by name, and says so when nothing matches', async ({ page }) => {
    await runScan(page)

    await page.getByPlaceholder('Filter projects…').fill('Two')

    await expect(page.getByText(STALE_PROJECT, { exact: true })).toBeVisible()
    await expect(page.getByText(CURRENT_PROJECT, { exact: true })).toBeHidden()

    await page.getByPlaceholder('Filter projects…').fill('no-such-project')

    await expect(page.getByText('No projects match the current filter')).toBeVisible()
    await expect(page.getByText(STALE_PROJECT, { exact: true })).toBeHidden()
  })

  test('narrows to the stale project through the status filter', async ({ page }) => {
    await runScan(page)

    await page.getByRole('button', { name: /^Stale/ }).click()

    await expect(page.getByText(STALE_PROJECT, { exact: true })).toBeVisible()
    await expect(page.getByText(CURRENT_PROJECT, { exact: true })).toBeHidden()
    await expect(page.getByText(NO_BREADCRUMBS_PROJECT, { exact: true })).toBeHidden()
  })
})

test.describe('Baker - breadcrumbs changes', () => {
  test('offers a batch update once projects are ticked, and says what it will do', async ({
    page
  }) => {
    await runScan(page)

    const review = page.getByRole('button', { name: 'Review and update breadcrumbs' })
    await expect(review).toBeHidden()

    await page.getByRole('checkbox', { name: `Select ${STALE_PROJECT}` }).check()

    await expect(review).toBeVisible()
    await expect(page.getByText('1 selected')).toBeVisible()
    await expect(page.getByText('1 to update', { exact: true })).toBeVisible()
  })

  test('selects every shown project from the list header, and skips the current one', async ({
    page
  }) => {
    await runScan(page)

    await page.getByRole('checkbox', { name: 'Select all shown projects' }).check()

    await expect(page.getByText('3 selected')).toBeVisible()
    await expect(
      page.getByText('1 to update · 1 to create · 1 already current')
    ).toBeVisible()

    await page.getByRole('button', { name: 'Clear selection' }).click()

    await expect(
      page.getByRole('button', { name: 'Review and update breadcrumbs' })
    ).toBeHidden()
  })

  test('selects only the shown projects, and says how many ticked ones the filter hides', async ({
    page
  }) => {
    await runScan(page)

    await page.getByRole('checkbox', { name: `Select ${CURRENT_PROJECT}` }).check()
    await page.getByRole('button', { name: /^Stale/ }).click()
    await page.getByRole('checkbox', { name: 'Select all shown projects' }).check()

    await expect(page.getByText('2 selected')).toBeVisible()
    await expect(page.getByText('(1 hidden by filter)')).toBeVisible()
  })

  test('names the reason a project needs a change before writing anything', async ({
    page
  }) => {
    await runScan(page)

    await page.getByText(NO_BREADCRUMBS_PROJECT, { exact: true }).click()

    await expect(
      page.getByText('Breadcrumbs file is missing', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('This folder has no breadcrumbs.json yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create breadcrumbs' })).toBeVisible()
  })

  test('reviews a batch in a dialog rather than writing on the first click', async ({
    page
  }) => {
    await runScan(page)

    await page.getByRole('checkbox', { name: `Select ${STALE_PROJECT}` }).check()
    await page.getByRole('button', { name: 'Review and update breadcrumbs' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Confirm Batch Update')).toBeVisible()
    await expect(
      dialog.getByText('Review the changes Baker will make before anything is written.')
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})

test.describe('Baker - navigation', () => {
  test('survives a round trip to BuildProject and back', async ({ page }) => {
    await openBaker(page)

    await page.goto('/ingest/build')
    await page.goto('/ingest/baker')

    await expect(page.getByRole('heading', { level: 1, name: 'Baker' })).toBeVisible()
    await expect(page.getByText('Baker Error')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Browse' })).toBeVisible()
  })
})
