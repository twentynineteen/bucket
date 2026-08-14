/**
 * TEMPORARY - proof for issue #171, removed in the commit after this one.
 *
 * This file exists to demonstrate the claim the fix is built on: a spec file
 * added anywhere under tests/e2e/ with no change to any config or workflow is
 * executed by CI. Compare the test count in this PR's e2e job against the
 * previous run's. Under the old setup this file would have matched no project
 * in the root config and never run, with nothing reporting its absence.
 */
import { expect, test } from '@playwright/test'

import { setupTauriMocks } from '../fixtures/mocks.fixture'

test('a spec added with no config change is executed', async ({ page }) => {
  await setupTauriMocks(page)
  await page.goto('/ingest/baker')

  await expect(page.getByRole('heading', { level: 1, name: 'Baker' })).toBeVisible()
})
