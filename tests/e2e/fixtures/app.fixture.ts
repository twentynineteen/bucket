import { test as base, Page } from '@playwright/test'

/**
 * Extended test fixtures for Tauri app testing
 */
export interface AppFixtures {
  /**
   * Wait for the app to be fully loaded
   */
  appReady: Page
}

/**
 * Extended test with Tauri app fixtures
 */
export const test = base.extend<AppFixtures>({
  appReady: async ({ page }, use) => {
    // Collect console errors for debugging
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`)
    })

    // Navigate to the app
    await page.goto('/')

    // Wait for the app to be fully loaded
    // This waits for React to mount and any initial data fetching
    await page.waitForLoadState('networkidle')

    // Wait for React to render content into #root
    // The #root div should have child elements once React mounts
    try {
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root')
          return root !== null && root.children.length > 0
        },
        { timeout: 10000 }
      )
    } catch (e) {
      // If React fails to mount, log console errors
      console.error('React failed to mount. Console errors:', errors)
      throw e
    }

    await use(page)
  }
})

export { expect } from '@playwright/test'

/**
 * Helper to wait for Tauri API to be available
 */
export async function waitForTauriApi(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      return typeof window !== 'undefined' && '__TAURI__' in window
    },
    { timeout: 10000 }
  )
}

/**
 * Helper to mock Tauri invoke calls
 */
export async function mockTauriInvoke(
  page: Page,
  command: string,
  response: unknown
): Promise<void> {
  await page.evaluate(
    ({ cmd, res }) => {
      const originalInvoke = (
        window as {
          __TAURI__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> }
        }
      ).__TAURI__?.invoke
      if (originalInvoke) {
        ;(
          window as {
            __TAURI__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> }
          }
        ).__TAURI__!.invoke = async (invokeCmd: string, args?: unknown) => {
          if (invokeCmd === cmd) {
            return res
          }
          return originalInvoke(invokeCmd, args)
        }
      }
    },
    { cmd: command, res: response }
  )
}

/**
 * Helper to get console logs from the page
 */
export function collectConsoleLogs(page: Page): string[] {
  const logs: string[] = []
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`)
  })
  return logs
}
