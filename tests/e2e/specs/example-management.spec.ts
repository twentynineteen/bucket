/**
 * E2E: managing AI script examples, as a user drives it.
 *
 * The previous version of this file was ten conditional tests ending in
 * `expect(true).toBe(true)`, `expect(typeof dialogVisible).toBe('boolean')` or
 * `expect(count).toBeGreaterThanOrEqual(0)` (issue #171 finding 5). They could
 * not have asserted anything: `setupTauriMocks` answered `null` for
 * `get_all_examples_with_metadata`, and the page filters that value directly,
 * so every one of those runs was in fact looking at the "Example Embeddings
 * Error" boundary rather than at the library. The fixture now serves the three
 * examples it always declared - two bundled, one uploaded.
 *
 * IPC is mocked, and the Ollama embedding endpoints are routed, so the upload
 * dialog's readiness does not depend on whether the machine running the test
 * happens to have Ollama listening.
 */
import { expect, test, type Page } from '@playwright/test'

import { mockOllamaEmbedding, setupTauriMocks } from '../fixtures/mocks.fixture'

const BUNDLED_ONE = 'Educational Script Example'
const BUNDLED_TWO = 'Business Script Example'
const UPLOADED = 'User Custom Script'

/** Open the library and wait for the examples to land. */
async function openLibrary(page: Page) {
  await setupTauriMocks(page)
  await mockOllamaEmbedding(page)
  await page.goto('/ai-tools/example-embeddings')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Example Embeddings' })
  ).toBeVisible()
  await expect(page.getByText('Example Library (3 total)')).toBeVisible()
}

test.describe('Example library', () => {
  test('lists every example it loaded', async ({ page }) => {
    await openLibrary(page)

    await expect(page.getByText(BUNDLED_ONE)).toBeVisible()
    await expect(page.getByText(BUNDLED_TWO)).toBeVisible()
    await expect(page.getByText(UPLOADED)).toBeVisible()
    await expect(page.getByText('No examples found')).toBeHidden()
  })

  test('survives a reload with the library intact', async ({ page }) => {
    await openLibrary(page)

    await page.reload()

    await expect(page.getByText('Example Library (3 total)')).toBeVisible()
    await expect(page.getByText(UPLOADED)).toBeVisible()
  })

  test('counts bundled and uploaded examples separately', async ({ page }) => {
    await openLibrary(page)

    await expect(page.getByRole('tab', { name: 'All (3)' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Bundled (2)' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Uploaded (1)' })).toBeVisible()
  })

  test('shows only the uploaded example on the Uploaded tab', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('tab', { name: 'Uploaded (1)' }).click()

    await expect(page.getByText(UPLOADED)).toBeVisible()
    await expect(page.getByText(BUNDLED_ONE)).toBeHidden()
    await expect(page.getByText(BUNDLED_TWO)).toBeHidden()
  })

  test('shows only bundled examples on the Bundled tab', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('tab', { name: 'Bundled (2)' }).click()

    await expect(page.getByText(BUNDLED_ONE)).toBeVisible()
    await expect(page.getByText(BUNDLED_TWO)).toBeVisible()
    await expect(page.getByText(UPLOADED)).toBeHidden()
  })
})

test.describe('Example deletion', () => {
  test('offers delete on the uploaded example only, never on a bundled one', async ({
    page
  }) => {
    await openLibrary(page)

    // Bundled examples ship with the app, so only the uploaded one is deletable.
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(1)

    await page.getByRole('tab', { name: 'Bundled (2)' }).click()

    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  })

  test('confirms which example it is about to delete', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('button', { name: 'Delete' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Delete Example?')).toBeVisible()
    await expect(dialog.getByText(UPLOADED)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('deletes nothing when the confirmation is cancelled', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('alertdialog')).toBeHidden()
    await expect(page.getByText(UPLOADED)).toBeVisible()
  })
})

test.describe('Example upload', () => {
  test('asks for both halves of the example when the dialog opens', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('button', { name: 'Upload Example' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Upload Script Example')).toBeVisible()
    await expect(dialog.getByLabel('Original Script (.txt or .docx)')).toBeVisible()
    await expect(dialog.getByLabel('Formatted Script (.txt or .docx)')).toBeVisible()
    await expect(dialog.getByLabel('Title')).toBeVisible()
  })

  test('closes the upload dialog on cancel', async ({ page }) => {
    await openLibrary(page)

    await page.getByRole('button', { name: 'Upload Example' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('Example Library (3 total)')).toBeVisible()
  })
})
