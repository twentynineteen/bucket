/**
 * BuildProject Page Object Model
 *
 * Provides an abstraction layer for interacting with the BuildProject page
 * in E2E tests. Encapsulates locators and common actions.
 */

import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

export class BuildProjectPage {
  readonly page: Page

  // Locators - based on actual page structure
  readonly pageTitle: Locator
  readonly titleInput: Locator
  readonly camerasInput: Locator
  readonly folderSelector: Locator
  readonly selectFilesButton: Locator
  readonly clearAllButton: Locator
  readonly createProjectButton: Locator
  readonly progressContainer: Locator
  readonly fileList: Locator
  readonly successMessage: Locator
  readonly sanitizationWarning: Locator
  readonly trelloSection: Locator

  constructor(page: Page) {
    this.page = page

    // Page elements - using text content and roles for reliability
    this.pageTitle = page.getByRole('heading', { name: 'Build a Project' })
    this.titleInput = page.getByPlaceholder('e.g. DBA - IB1234 - J Doe - Introductions 060626')
    this.camerasInput = page.getByRole('spinbutton', { name: /number of cameras/i })
    this.folderSelector = page.getByRole('button', { name: /select destination/i })

    // Action buttons
    this.selectFilesButton = page.getByRole('button', { name: 'Select Files' })
    this.clearAllButton = page.getByRole('button', { name: 'Clear' })
    this.createProjectButton = page.getByRole('button', { name: 'Create Project' })

    // Progress indicator - look for the percentage text
    this.progressContainer = page.locator('text=/\\d+\\.\\d+%/')

    // File list
    this.fileList = page.locator('ul')

    // Success state
    this.successMessage = page.getByText('Project Created Successfully!')
    this.trelloSection = page.getByText('Trello')

    // Warnings
    this.sanitizationWarning = page.getByText(/characters were changed/i)
  }

  /**
   * Navigate to the BuildProject page
   * If already on the page, just waits for title to be visible
   */
  async goto(): Promise<void> {
    const currentUrl = this.page.url()
    if (!currentUrl.includes('/ingest/build')) {
      await this.page.goto('/ingest/build')
    }
    await expect(this.pageTitle).toBeVisible({ timeout: 10000 })
  }

  /**
   * Fill in project details
   */
  async fillProjectDetails(title: string, numCameras: number): Promise<void> {
    await this.titleInput.fill(title)
    await this.camerasInput.fill(String(numCameras))
  }

  /**
   * Get the current title value
   */
  async getTitle(): Promise<string> {
    return this.titleInput.inputValue()
  }

  /**
   * Get the current number of cameras
   */
  async getNumCameras(): Promise<number> {
    const value = await this.camerasInput.inputValue()
    return parseInt(value, 10)
  }

  /**
   * Check if sanitization warning is shown
   */
  async isSanitizationWarningVisible(): Promise<boolean> {
    return this.sanitizationWarning.isVisible()
  }

  /**
   * Click the folder selector to choose destination
   */
  async clickSelectDestination(): Promise<void> {
    await this.folderSelector.click()
  }

  /**
   * Click "Select Files" button
   * Note: In E2E tests, the file dialog is mocked
   */
  async clickSelectFiles(): Promise<void> {
    await this.selectFilesButton.click()
  }

  /**
   * Click "Clear All" button
   * Waits for the button to be visible before clicking
   */
  async clickClearAll(): Promise<void> {
    // Clear button may not be immediately visible after operations
    // Wait for it to appear with a reasonable timeout
    await this.clearAllButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // If Clear button doesn't appear, the form might already be in reset state
      console.log('[BuildProjectPage] Clear button not visible, form may already be reset')
    })
    if (await this.clearAllButton.isVisible()) {
      await this.clearAllButton.click()
    }
  }

  /**
   * Click "Create Project" button to start the operation
   */
  async clickCreateProject(): Promise<void> {
    await this.createProjectButton.click()
  }

  /**
   * Get the current progress percentage from the UI
   */
  async getProgress(): Promise<number> {
    try {
      // Look for text like "50.0%" or "100%"
      const progressText = await this.page.locator('text=/\\d+\\.?\\d*%/').first().textContent()
      if (progressText) {
        const match = progressText.match(/(\d+\.?\d*)%/)
        if (match) {
          return parseFloat(match[1])
        }
      }
    } catch {
      // Progress element may not exist yet
    }
    return 0
  }

  /**
   * Wait for the file operation to complete
   * @param timeout Maximum time to wait in ms (default 5 minutes)
   */
  async waitForCompletion(timeout: number = 300000): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout })
  }

  /**
   * Check if the operation is complete
   */
  async isComplete(): Promise<boolean> {
    try {
      return await this.successMessage.isVisible()
    } catch {
      return false
    }
  }

  /**
   * Get the count of files in the file list
   */
  async getFileCount(): Promise<number> {
    // Count list items in the file list
    const items = this.page.locator('ul li')
    return items.count()
  }

  /**
   * Get all file names from the file list
   */
  async getFileNames(): Promise<string[]> {
    const items = this.page.locator('ul li')
    const count = await items.count()
    const names: string[] = []

    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent()
      if (text) names.push(text)
    }

    return names
  }

  /**
   * Update camera assignment for a file at index
   */
  async updateFileCamera(fileIndex: number, cameraNumber: number): Promise<void> {
    const selector = this.page.locator('select').nth(fileIndex)
    await selector.selectOption(String(cameraNumber))
  }

  /**
   * Delete a file at index
   */
  async deleteFile(fileIndex: number): Promise<void> {
    // Find the delete button (trash icon) in the file list item
    const deleteButtons = this.page.locator('ul li button')
    await deleteButtons.nth(fileIndex).click()
  }

  /**
   * Check if progress is visible (operation in progress)
   */
  async isProgressVisible(): Promise<boolean> {
    const progress = await this.getProgress()
    return progress > 0
  }

  /**
   * Check if Trello section is visible (shown after completion)
   */
  async isTrelloSectionVisible(): Promise<boolean> {
    try {
      return await this.trelloSection.isVisible()
    } catch {
      return false
    }
  }

  /**
   * Monitor progress updates during operation
   * Returns array of progress values captured during monitoring
   */
  async monitorProgress(durationMs: number, intervalMs: number = 100): Promise<number[]> {
    const progressValues: number[] = []
    const start = Date.now()

    while (Date.now() - start < durationMs) {
      const progress = await this.getProgress()
      progressValues.push(progress)

      if (await this.isComplete()) {
        progressValues.push(100)
        break
      }

      await this.page.waitForTimeout(intervalMs)
    }

    return progressValues
  }

  /**
   * Perform a complete project creation flow
   */
  async createProjectFlow(
    title: string,
    numCameras: number,
    options: {
      waitForCompletion?: boolean
      timeout?: number
    } = {}
  ): Promise<void> {
    const { waitForCompletion = true, timeout = 300000 } = options

    await this.fillProjectDetails(title, numCameras)
    await this.clickSelectDestination()
    await this.clickSelectFiles()
    await this.clickCreateProject()

    if (waitForCompletion) {
      await this.waitForCompletion(timeout)
    }
  }
}
