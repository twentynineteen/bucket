import { defineConfig, devices } from '@playwright/test'

/**
 * Port for the e2e dev server. Defaults to 1422 (the Tauri port). Set E2E_PORT
 * to run from a second checkout or worktree at the same time: with
 * reuseExistingServer on, every checkout would otherwise share whichever
 * server started first and silently test someone else's code.
 */
const port = Number(process.env.E2E_PORT ?? 1422)
/**
 * Host for the e2e dev server. Unset, Vite and the tests both use "localhost".
 * CI sets E2E_HOST=127.0.0.1: inside the Playwright container Node resolves
 * "localhost" to ::1 while Vite listens on IPv4, so the warm-up fetch in
 * global-setup never connects. Pinning both ends to one address avoids that.
 */
const host = process.env.E2E_HOST
const baseURL = `http://${host ?? 'localhost'}:${port}`

/**
 * The only Playwright configuration in this repo. Tests run against the Vite
 * dev server (localhost:1422).
 *
 * Discovery is driven by the file layout and nothing else (issue #171). There
 * used to be a second config under `tests/e2e/`, and eleven projects each
 * declaring an explicit `testMatch`, so a spec file matching none of them never
 * ran and nothing reported it - three files were in that state. No project here
 * may declare `testMatch` or `testIgnore`: a spec dropped anywhere under
 * `tests/e2e/` runs. `tests/integration/e2e-spec-discovery.test.ts` enforces
 * that, and fails on a project that resolves to zero tests or one no workflow
 * runs.
 *
 * The two projects below partition the suite by cost, not by feature. The heavy
 * simulation specs carry a `@slow` tag, so they can be held back to pushes and
 * manual runs without a per-file list in this file:
 *
 *   e2e   every spec without a `@slow` tag. Runs on every push and pull
 *         request, in ci.yml.
 *   slow  the `@slow` specs, which simulate 250GB transfers and multi-minute
 *         operations. Runs on pushes to master/release and on workflow_dispatch,
 *         in e2e-tests.yml.
 *
 * Their union is the whole suite, so tagging a spec moves it between CI jobs
 * and can never drop it from both.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry keeps the trace from the first attempt. failOnFlakyTests then
  // fails the run anyway, so a test that only passes on retry is visible
  // rather than reported green (issue #171 finding 7).
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // memory-stability.spec.ts reads performance.memory, which Chrome only
    // populates precisely with this flag.
    launchOptions: {
      args: ['--enable-precise-memory-info']
    }
  },

  // Navigates once before any test runs, so that Vite's first compile is not
  // charged to whichever spec happens to go first (issue #227). See the file for
  // what `webServer.url` below does and does not prove.
  globalSetup: './tests/e2e/global-setup.ts',

  // Global timeout for tests (5 minutes for large file simulations). The two
  // specs that need longer raise it themselves with test.describe.configure.
  timeout: 300000,

  // The per-test action budget: what one assertion about the application is
  // allowed to take to come true. Two things are deliberately not measured
  // against it, because neither is a claim about the application (issue #227):
  // getting a page rendered in the first place, which is
  // `PAGE_READY_TIMEOUT_MS` in the page object and carries the load of every
  // worker in the run, and Vite's first compile, which `globalSetup` above pays
  // for once before any test exists.
  expect: {
    timeout: 10000
  },

  projects: [
    {
      name: 'e2e',
      grepInvert: /@slow/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'slow',
      grep: /@slow/,
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  // Dev server configuration. bun, matching the toolchain in CLAUDE.md - this
  // said `npm run dev` until issue #171.
  //
  // `url` is a liveness check and not a readiness one: Vite answers it with
  // `index.html` before it has transformed an application module, so the first
  // compile happens after this resolves. `globalSetup` above is what waits for the
  // app to actually render (issue #227).
  webServer: {
    command: `bun run dev -- --port ${port}${host ? ` --host ${host}` : ''}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
