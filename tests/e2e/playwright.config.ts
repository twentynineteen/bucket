import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Bucket Tauri E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: '../../playwright-report' }], ['list']],

  use: {
    // Base URL for the Vite dev server
    baseURL: 'http://localhost:1422',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording on failure
    video: 'on-first-retry'
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    // WebKit for macOS testing (skip in CI unless explicitly requested)
    ...(process.env.CI && !process.env.PLAYWRIGHT_PROJECT?.includes('webkit')
      ? []
      : [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] }
          }
        ])
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:1422',
    timeout: 60 * 1000,
    reuseExistingServer: !process.env.CI
  },

  // Output directory for test artifacts
  outputDir: '../../test-results'
})
