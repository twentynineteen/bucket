import { expect, test } from '../fixtures/app.fixture'
import { setupTauriMocks } from '../fixtures/mocks.fixture'

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('app loads successfully', async ({ appReady }) => {
    // Verify the page loaded
    await expect(appReady).toHaveTitle(/Bucket/)
  })

  test('main navigation is visible', async ({ appReady }) => {
    // Check for main navigation elements
    // Adjust selectors based on your app's actual structure
    const sidebar = appReady.locator('[data-testid="sidebar"], nav, aside')
    await expect(sidebar.first()).toBeVisible()
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await setupTauriMocks(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Filter out expected errors when running outside Tauri context
    const unexpectedErrors = errors.filter(
      error =>
        !error.includes('__TAURI__') &&
        !error.includes('TAURI_INTERNALS') &&
        !error.includes('invoke') &&
        !error.includes('transformCallback') &&
        !error.includes('Failed to fetch') &&
        !error.includes('Failed to load resource') &&
        !error.includes('net::ERR') &&
        !error.includes('Error loading API keys') &&
        !error.includes('Failed to setup copy progress') &&
        !error.includes('403')
    )

    expect(unexpectedErrors).toHaveLength(0)
  })

  test('app responds to window resize', async ({ appReady }) => {
    // Test responsive behavior
    await appReady.setViewportSize({ width: 1920, height: 1080 })
    await expect(appReady.locator('body')).toBeVisible()

    await appReady.setViewportSize({ width: 768, height: 1024 })
    await expect(appReady.locator('body')).toBeVisible()

    await appReady.setViewportSize({ width: 375, height: 667 })
    await expect(appReady.locator('body')).toBeVisible()
  })

  /**
   * An idle screen must be idle. Until issue #228 it was not: `useBreadcrumb`
   * wrote to the store and the query cache on every render, and each write
   * re-rendered the tree, so every page in the app spun at ~570 renders per
   * second for as long as it was open. The sidebar's vibrancy effect turned
   * each of those renders into two `plugin:window|set_effects` calls, and the
   * backlog of queued renders is what made a file transfer's progress events
   * get slower the longer it ran.
   *
   * IPC volume is the measurable signature, and it is not a timing assertion:
   * an idle Build Project screen issues **0** commands over three seconds with
   * the loop fixed, against ~1,650 with it present. The bound is 20 so that a
   * legitimate background refetch could never fail this, and no plausible
   * render loop could pass it.
   */
  test('an idle screen issues no Tauri IPC', async ({ page }) => {
    await setupTauriMocks(page)
    await page.addInitScript(() => {
      const win = window as unknown as {
        __IPC_LOG__: string[]
        __TAURI_INTERNALS__?: {
          invoke: (cmd: string, args?: unknown) => Promise<unknown>
        }
      }
      win.__IPC_LOG__ = []
      const internals = win.__TAURI_INTERNALS__
      if (!internals) return
      const original = internals.invoke
      internals.invoke = (cmd: string, args?: unknown) => {
        win.__IPC_LOG__.push(cmd)
        return original(cmd, args)
      }
    })

    await page.goto('/ingest/build')
    await expect(page.getByRole('heading', { name: 'Build a Project' })).toBeVisible()

    const readLog = () =>
      page.evaluate(() => (window as unknown as { __IPC_LOG__: string[] }).__IPC_LOG__.length)

    // Startup legitimately issues commands; measure only the idle window after.
    await page.waitForTimeout(1000)
    const before = await readLog()
    await page.waitForTimeout(3000)
    const after = await readLog()

    const commands = await page.evaluate(() =>
      (window as unknown as { __IPC_LOG__: string[] }).__IPC_LOG__.slice(-5)
    )
    expect(after - before, `commands seen while idle, last five: ${commands.join(', ')}`).toBeLessThan(20)
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTauriMocks(page)
  })

  test('home page renders without critical failures', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify the page rendered something
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Check that the app shell rendered (not a blank page)
    const content = await body.textContent()
    expect(content?.length).toBeGreaterThan(0)
  })
})
