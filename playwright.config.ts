import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://localhost:1422',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // memory-stability.spec.ts reads performance.memory, which Chrome only
    // populates precisely with this flag.
    launchOptions: {
      args: ['--enable-precise-memory-info']
    }
  },

  // Global timeout for tests (5 minutes for large file simulations). The two
  // specs that need longer raise it themselves with test.describe.configure.
  timeout: 300000,

  // Expect timeout for assertions
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
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:1422',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
