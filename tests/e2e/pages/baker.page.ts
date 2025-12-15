import { expect, Locator, Page } from '@playwright/test'
import { CommonPage } from './common.page'

/**
 * Page object for the Baker workflow page
 * Route: /ingest/baker
 */
export class BakerPage extends CommonPage {
  // Baker-specific selectors
  readonly selectDriveButton: Locator
  readonly scanButton: Locator
  readonly scanResults: Locator
  readonly projectList: Locator
  readonly projectItems: Locator

  // Breadcrumbs management
  readonly breadcrumbsPreview: Locator
  readonly updateBreadcrumbsButton: Locator
  readonly createBreadcrumbsButton: Locator

  // Progress indicators
  readonly scanProgress: Locator
  readonly updateProgress: Locator

  // Filters and options
  readonly filterInput: Locator
  readonly showStaleOnly: Locator

  constructor(page: Page) {
    super(page)

    // Main actions
    this.selectDriveButton = page.locator(
      'button:has-text("Select"), button:has-text("Choose"), button:has-text("Browse")'
    )
    this.scanButton = page.locator(
      'button:has-text("Scan"), button:has-text("Start Scan")'
    )

    // Results
    this.scanResults = page.locator('[data-testid="scan-results"], .scan-results')
    this.projectList = page.locator(
      '[data-testid="project-list"], .project-list, ul, table'
    )
    this.projectItems = page.locator(
      '[data-testid="project-item"], .project-item, li, tr'
    )

    // Breadcrumbs
    this.breadcrumbsPreview = page.locator(
      '[data-testid="breadcrumbs-preview"], .breadcrumbs-preview'
    )
    this.updateBreadcrumbsButton = page.locator(
      'button:has-text("Update"), button:has-text("Apply")'
    )
    this.createBreadcrumbsButton = page.locator(
      'button:has-text("Create"), button:has-text("Generate")'
    )

    // Progress
    this.scanProgress = page.locator(
      '[data-testid="scan-progress"], [role="progressbar"]'
    )
    this.updateProgress = page.locator(
      '[data-testid="update-progress"], [role="progressbar"]'
    )

    // Filters
    this.filterInput = page.locator(
      'input[placeholder*="Filter"], input[placeholder*="Search"]'
    )
    this.showStaleOnly = page.locator(
      'input[type="checkbox"]:near(:text("stale")), label:has-text("stale") input'
    )
  }

  /**
   * Navigate to Baker page
   */
  async navigate(): Promise<void> {
    await this.goto('/ingest/baker')
  }

  /**
   * Select a root directory for scanning
   * Note: In E2E tests, file dialogs need to be mocked
   */
  async selectRootDirectory(): Promise<void> {
    await this.selectDriveButton.click()
  }

  /**
   * Start a scan of the selected directory
   */
  async startScan(): Promise<void> {
    await this.scanButton.click()
  }

  /**
   * Wait for scan to complete
   */
  async waitForScanComplete(): Promise<void> {
    // Wait for progress to appear then disappear
    await this.scanProgress.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    await this.scanProgress.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {})
    await this.waitForLoadingComplete()
  }

  /**
   * Get count of projects found
   */
  async getProjectCount(): Promise<number> {
    return await this.projectItems.count()
  }

  /**
   * Select a project by index
   */
  async selectProject(index: number): Promise<void> {
    await this.projectItems.nth(index).click()
  }

  /**
   * Select a project by name
   */
  async selectProjectByName(name: string): Promise<void> {
    await this.projectItems.filter({ hasText: name }).first().click()
  }

  /**
   * Filter projects by text
   */
  async filterProjects(text: string): Promise<void> {
    await this.filterInput.fill(text)
  }

  /**
   * Toggle show stale only filter
   */
  async toggleStaleOnly(): Promise<void> {
    await this.showStaleOnly.click()
  }

  /**
   * Update breadcrumbs for selected project
   */
  async updateBreadcrumbs(): Promise<void> {
    await this.updateBreadcrumbsButton.click()
  }

  /**
   * Create breadcrumbs for selected project
   */
  async createBreadcrumbs(): Promise<void> {
    await this.createBreadcrumbsButton.click()
  }

  /**
   * Expect scan results to be visible
   */
  async expectScanResults(): Promise<void> {
    await expect(this.scanResults).toBeVisible()
  }

  /**
   * Expect specific number of projects
   */
  async expectProjectCount(count: number): Promise<void> {
    await expect(this.projectItems).toHaveCount(count)
  }
}
