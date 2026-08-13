import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Bucket E2E tests
 * Tests run against the Vite dev server (localhost:1422)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:1422',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  // Global timeout for tests (5 minutes for large file simulations)
  timeout: 300000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000
  },

  projects: [
    {
      name: 'smoke',
      testMatch: /buildproject\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'debug',
      testMatch: /debug\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'progress',
      testMatch: /progress-accuracy\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'memory',
      testMatch: /memory-stability\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Chrome-specific flags for memory API access
        launchOptions: {
          args: ['--enable-precise-memory-info']
        }
      }
    },
    {
      name: 'errors',
      testMatch: /error-recovery\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    // New projects for large file testing
    {
      name: 'large-files',
      testMatch: /realistic-progress\.spec\.ts|external-drive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 600000 // 10 minutes for large file tests
    },
    {
      name: 'cancellation',
      testMatch: /cancellation\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'sprout-folders',
      testMatch: /sprout-folder-picker\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'folder-picker-dialog-scroll',
      testMatch: /folder-picker-dialog-scroll\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      // Every project here uses an explicit testMatch, so a spec that matches
      // none of them never runs at all. Issue #166.
      name: 'posterframe-backgrounds',
      testMatch: /posterframe-backgrounds\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      // Walks Baker to reach the poster frame dialogs. Scan completion arrives
      // via useBakerScan's 2s status poll, so these are slower than the
      // folder-only specs. Issue #166.
      name: 'posterframe-baker',
      testMatch: /posterframe-baker-journey\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'long-operations',
      testMatch: /long-operation-states\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        video: 'retain-on-failure' // Capture video for visual debugging
      },
      timeout: 300000 // 5 minutes
    }
  ],

  // Dev server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1422',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
