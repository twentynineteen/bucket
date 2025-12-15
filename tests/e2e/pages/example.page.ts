import { expect, Locator, Page } from '@playwright/test'
import { CommonPage } from './common.page'

/**
 * Page object for the Example Embeddings management page
 * Route: /ai-tools/example-embeddings
 */
export class ExampleEmbeddingsPage extends CommonPage {
  // Example list
  readonly exampleList: Locator
  readonly exampleItems: Locator
  readonly emptyState: Locator

  // Actions
  readonly uploadButton: Locator
  readonly deleteButton: Locator
  readonly replaceButton: Locator
  readonly refreshButton: Locator

  // Upload dialog
  readonly uploadDialog: Locator
  readonly fileInput: Locator
  readonly uploadSubmit: Locator
  readonly uploadCancel: Locator

  // Filters
  readonly filterSelect: Locator
  readonly searchInput: Locator

  // Example details
  readonly examplePreview: Locator
  readonly exampleMetadata: Locator

  constructor(page: Page) {
    super(page)

    // List
    this.exampleList = page.locator(
      '[data-testid="example-list"], .example-list, table, ul'
    )
    this.exampleItems = page.locator(
      '[data-testid="example-item"], .example-item, tr, li'
    )
    this.emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state, :text("No examples")'
    )

    // Actions
    this.uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add")')
    this.deleteButton = page.locator(
      'button:has-text("Delete"), button[aria-label="Delete"]'
    )
    this.replaceButton = page.locator(
      'button:has-text("Replace"), button:has-text("Update")'
    )
    this.refreshButton = page.locator(
      'button:has-text("Refresh"), button[aria-label="Refresh"]'
    )

    // Upload dialog
    this.uploadDialog = page.locator('[role="dialog"]')
    this.fileInput = page.locator('input[type="file"]')
    this.uploadSubmit = page.locator(
      '[role="dialog"] button:has-text("Upload"), [role="dialog"] button[type="submit"]'
    )
    this.uploadCancel = page.locator('[role="dialog"] button:has-text("Cancel")')

    // Filters
    this.filterSelect = page.locator('select, [role="combobox"], button:has-text("All")')
    this.searchInput = page.locator('input[placeholder*="Search"], input[type="search"]')

    // Details
    this.examplePreview = page.locator(
      '[data-testid="example-preview"], .example-preview, pre, code'
    )
    this.exampleMetadata = page.locator(
      '[data-testid="example-metadata"], .example-metadata'
    )
  }

  /**
   * Navigate to Example Embeddings page
   */
  async navigate(): Promise<void> {
    await this.goto('/ai-tools/example-embeddings')
  }

  /**
   * Get count of examples
   */
  async getExampleCount(): Promise<number> {
    return await this.exampleItems.count()
  }

  /**
   * Select an example by index
   */
  async selectExample(index: number): Promise<void> {
    await this.exampleItems.nth(index).click()
  }

  /**
   * Select an example by name
   */
  async selectExampleByName(name: string): Promise<void> {
    await this.exampleItems.filter({ hasText: name }).first().click()
  }

  /**
   * Open upload dialog
   */
  async openUploadDialog(): Promise<void> {
    await this.uploadButton.click()
    await expect(this.uploadDialog).toBeVisible()
  }

  /**
   * Upload a file
   * Note: File path must be absolute
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.openUploadDialog()
    await this.fileInput.setInputFiles(filePath)
    await this.uploadSubmit.click()
    await this.uploadDialog.waitFor({ state: 'hidden' })
  }

  /**
   * Delete selected example
   */
  async deleteSelectedExample(): Promise<void> {
    await this.deleteButton.click()
    // Confirm deletion if dialog appears
    const confirmButton = this.page.locator(
      'button:has-text("Confirm"), button:has-text("Yes")'
    )
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
  }

  /**
   * Replace selected example
   */
  async replaceSelectedExample(filePath: string): Promise<void> {
    await this.replaceButton.click()
    await expect(this.uploadDialog).toBeVisible()
    await this.fileInput.setInputFiles(filePath)
    await this.uploadSubmit.click()
    await this.uploadDialog.waitFor({ state: 'hidden' })
  }

  /**
   * Filter examples by source
   */
  async filterBySource(source: 'All' | 'Bundled' | 'Uploaded'): Promise<void> {
    await this.filterSelect.click()
    await this.page.locator(`text="${source}"`).click()
  }

  /**
   * Search for examples
   */
  async searchExamples(query: string): Promise<void> {
    await this.searchInput.fill(query)
  }

  /**
   * Expect specific number of examples
   */
  async expectExampleCount(count: number): Promise<void> {
    await expect(this.exampleItems).toHaveCount(count)
  }

  /**
   * Expect empty state to be visible
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible()
  }

  /**
   * Expect example to be in list
   */
  async expectExampleInList(name: string): Promise<void> {
    await expect(this.exampleItems.filter({ hasText: name })).toBeVisible()
  }
}
