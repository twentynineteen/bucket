/**
 * Motion text spacing e2e spec.
 *
 * Verifies that per-character staggered text (rendered as individual tspans)
 * has the same rendered width as the same string in a single text run. SVG
 * collapses whitespace inside tspans unless xml:space="preserve" is set, and
 * splitting text into tspans can break kerning. This spec measures the actual
 * rendered dimensions in a real browser.
 */
import { expect, test, type Page } from '@playwright/test'
import { setupTauriMocks } from '../fixtures/mocks.fixture'
import { installMotionMocks } from '../fixtures/motion.fixture'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function stubReleaseCheck(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/*/*/releases/latest', route =>
    route.fulfill({
      json: { tag_name: 'v0.0.0', name: 'v0.0.0', body: '', html_url: '' }
    })
  )
}

async function setupAll(page: Page): Promise<void> {
  await stubReleaseCheck(page)
  await setupTauriMocks(page)
  await installMotionMocks(page)
  // Freeze the clock at hold time so stagger animation is fully settled
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 2.0
  })
}

async function gotoMarketplace(page: Page): Promise<void> {
  await page.goto('/')
  const group = page.getByRole('button', { name: /Motion graphics/i })
  await expect(group).toBeVisible()
  await group.click()
  const item = page.getByRole('link', { name: /Marketplace/i })
  await item.click()
  await expect(page).toHaveURL(/\/motion\/marketplace/)
  await expect(page.getByRole('heading', { name: /Motion marketplace/i })).toBeVisible()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Motion text spacing', () => {
  test('staggered tspan text width matches single-run text width', async ({ page }) => {
    await setupAll(page)
    await gotoMarketplace(page)

    // Open the Glide dialog (has staggered text with "Jane Doe" including a space)
    const card = page.locator('[data-template-id="lower-third-glide"]')
    await expect(card).toBeVisible()
    await card.getByRole('button').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Wait for the SVG to render
    await page.waitForTimeout(300)

    // Measure the width of the staggered text and compare to a reference.
    // The dialog preview lives inside a div[role="img"] > svg structure.
    const result = await page.evaluate(() => {
      // Find the preview SVG inside the dialog. The first SVG is likely a
      // button icon, so target the one with the 3840x2160 viewBox.
      const dialogEl = document.querySelector('[role="dialog"]')
      if (!dialogEl) return { error: 'No dialog found' }

      const svg = dialogEl.querySelector('svg[viewBox="0 0 3840 2160"]')
      if (!svg) return { error: 'No preview SVG found in dialog' }

      // Find a text element with tspan children (staggered text).
      // The stagger creates one tspan per grapheme cluster.
      const textEls = svg.querySelectorAll('text')
      let staggeredText: SVGTextElement | null = null
      for (const t of textEls) {
        const tspanCount = t.querySelectorAll('tspan').length
        if (tspanCount > 1) {
          staggeredText = t
          break
        }
      }
      if (!staggeredText) {
        // Debug: what texts are in the SVG
        const info = Array.from(textEls).map(t => ({
          content: t.textContent?.slice(0, 30),
          tspans: t.querySelectorAll('tspan').length,
          childNodes: t.childNodes.length
        }))
        return {
          error: `No staggered text. Found ${textEls.length} text elements: ${JSON.stringify(info)}`
        }
      }

      // Get the staggered text's rendered width
      const staggeredWidth = staggeredText.getComputedTextLength()
      const fullText = staggeredText.textContent ?? ''

      // Create a reference text element with the same text as a single run
      const ns = 'http://www.w3.org/2000/svg'
      const refText = document.createElementNS(ns, 'text')
      refText.setAttribute('font-family', staggeredText.getAttribute('font-family') ?? '')
      refText.setAttribute('font-size', staggeredText.getAttribute('font-size') ?? '')
      refText.setAttribute('opacity', '0')
      refText.textContent = fullText
      svg.appendChild(refText)
      const refWidth = refText.getComputedTextLength()
      svg.removeChild(refText)

      return {
        staggeredWidth,
        refWidth,
        diff: Math.abs(staggeredWidth - refWidth),
        text: fullText,
        hasPreserve: staggeredText.getAttribute('xml:space') === 'preserve'
      }
    })

    // If there was an error, fail with the diagnostic message
    if ('error' in result && result.error) {
      throw new Error(String(result.error))
    }

    const r = result as {
      staggeredWidth: number
      refWidth: number
      diff: number
      text: string
      hasPreserve: boolean
    }

    // xml:space="preserve" must be set
    expect(r.hasPreserve).toBe(true)

    // The text must contain a space (the whole point of this test)
    expect(r.text).toContain(' ')

    // Widths must match within 2px tolerance
    expect(r.diff).toBeLessThanOrEqual(2)
  })
})
