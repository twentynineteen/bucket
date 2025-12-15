import { Locator, Page } from '@playwright/test'

/**
 * Common page selectors and helpers shared across all page objects
 */
export class CommonPage {
  readonly page: Page

  // Navigation selectors
  readonly sidebar: Locator
  readonly navLinks: Locator

  // Common UI elements
  readonly loadingSpinner: Locator
  readonly toast: Locator
  readonly dialog: Locator
  readonly dialogTitle: Locator
  readonly dialogClose: Locator

  // Form elements
  readonly submitButton: Locator
  readonly cancelButton: Locator

  constructor(page: Page) {
    this.page = page

    // Navigation
    this.sidebar = page.locator('aside, [data-testid="sidebar"], nav')
    this.navLinks = page.locator('nav a, aside a')

    // Common UI
    this.loadingSpinner = page.locator(
      '[data-testid="loading"], .animate-spin, [role="progressbar"]'
    )
    this.toast = page.locator('[data-sonner-toast], [role="alert"]')
    this.dialog = page.locator('[role="dialog"]')
    this.dialogTitle = page.locator('[role="dialog"] h2')
    this.dialogClose = page.locator('[role="dialog"] button[aria-label="Close"]')

    // Forms
    this.submitButton = page.locator(
      'button[type="submit"], button:has-text("Save"), button:has-text("Submit")'
    )
    this.cancelButton = page.locator(
      'button:has-text("Cancel"), button:has-text("Close")'
    )
  }

  /**
   * Navigate to a specific route
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for any spinners to disappear
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
      // No spinner found, that's fine
    })
  }

  /**
   * Click a navigation link by text
   */
  async clickNavLink(text: string): Promise<void> {
    await this.navLinks.filter({ hasText: text }).first().click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Check if toast notification appeared with specific text
   */
  async expectToast(text: string): Promise<void> {
    await this.toast.filter({ hasText: text }).waitFor({ state: 'visible' })
  }

  /**
   * Close any open dialog
   */
  async closeDialog(): Promise<void> {
    if (await this.dialog.isVisible()) {
      await this.dialogClose.first().click()
      await this.dialog.waitFor({ state: 'hidden' })
    }
  }

  /**
   * Get text content, trimmed
   */
  async getTextContent(locator: Locator): Promise<string> {
    const text = await locator.textContent()
    return text?.trim() ?? ''
  }
}
