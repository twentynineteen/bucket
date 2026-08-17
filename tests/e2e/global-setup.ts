/**
 * Warms the Vite dev server before any test runs (issue #227).
 *
 * `webServer.url` in `playwright.config.ts` is satisfied the moment the dev
 * server answers a request, and Vite answers with `index.html` before it has
 * transformed a single application module. Everything after that - pre-bundling
 * dependencies, transforming the module graph the browser then asks for - is paid
 * by whichever test navigates first, inside that test's own budget. #211 saw it
 * cost a run: `BuildProjectPage.goto()` timed out before the operation under test
 * had begun, on 1 of 14 local runs. Since every spec goes through that helper,
 * the cost lands on whichever spec happens to run first and moves as the suite is
 * reordered, which is why it read as several flaky tests rather than one shared
 * one.
 *
 * So the first compile is paid here instead, once, before the first test exists.
 * Two things follow. A test's navigation budget covers only a warm server, so a
 * timeout there is about the application rather than about Vite - which is the
 * distinction the issue exists to draw. And a dev server that never becomes
 * usable fails the run here, before any test, with a message about the dev
 * server.
 *
 * Measured on a cold cache locally: the URL answers 200 after ~440ms and this
 * function completes in 1.2-1.3s. A first navigation to any *other* route then
 * costs the same ~1.0s as a repeat visit to the same one, so the expense is the
 * shared module graph, paid once, and not the per-route lazy chunks - which is why
 * warming the app shell is enough and no list of routes belongs here. The figure is
 * logged on every run, so the number on a CI runner is in the log rather than
 * guessed at.
 *
 * What this does not fix, so that a later reader does not assume it did: the tail
 * on `BuildProjectPage.goto()` under parallel load. Measured, that is contention
 * between workers rather than the first compile, and it is dealt with separately by
 * the navigation budget in that file.
 */
import { chromium, type FullConfig } from '@playwright/test'

/**
 * Budget for the cold server, deliberately separate from the per-test action
 * budget in `expect.timeout`. It is the same order as `webServer.timeout`, and
 * for the same reason: there is nothing to be gained from bounding a first
 * compile tightly, because anything approaching this figure is a broken dev
 * server rather than a slow application, and 120s reports that as well as 15s
 * would while never racing the compile. Measured at 1.2-1.3s locally, and red-verified:
 * pointed at an element the app never renders, the run fails here, before the
 * first test, saying it is the dev server and not the application under test.
 */
const COLD_SERVER_BUDGET_MS = 120_000

/** Interval between readiness polls while the dev server is still starting. */
const POLL_INTERVAL_MS = 100

/**
 * Wait for the dev server to answer at all. Playwright starts `webServer` before
 * global setup, so this is normally satisfied on the first attempt; polling
 * rather than assuming it means this file does not depend on that ordering, and a
 * refused connection here waits rather than failing the run for a server that was
 * about to come up.
 */
async function waitForServer(baseURL: string, deadline: number): Promise<void> {
  for (;;) {
    try {
      const response = await fetch(baseURL)
      if (response.ok) {
        await response.text()
        return
      }
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Dev server at ${baseURL} did not answer within ${COLD_SERVER_BUDGET_MS}ms. ` +
          'This is the dev server, not the application under test.'
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

export default async function warmDevServer(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('No baseURL configured, so the dev server cannot be warmed.')
  }

  const started = Date.now()
  const deadline = started + COLD_SERVER_BUDGET_MS
  await waitForServer(baseURL, deadline)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ baseURL })
    await page.goto('/', { timeout: Math.max(1, deadline - Date.now()) })

    // Answering with `index.html` proves nothing about the module graph, so wait
    // for React to have mounted something. The app shell is what every route
    // shares and what the first compile is mostly spent on.
    await page
      .locator('#root > *')
      .first()
      .waitFor({ state: 'attached', timeout: Math.max(1, deadline - Date.now()) })

    console.log(`[e2e] dev server warm and rendering after ${Date.now() - started}ms`)
  } catch (error) {
    throw new Error(
      `Dev server at ${baseURL} did not render the application within ` +
        `${COLD_SERVER_BUDGET_MS}ms. This is the dev server, not the application ` +
        `under test.\n${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    await browser.close()
  }
}
