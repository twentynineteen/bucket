/**
 * Motion Marketplace style-fit and layout e2e specs (issue #338).
 *
 * T3.1 - token equality under Light, Dark and Dracula
 * T3.2 - equal card heights with a 120-character name
 * T3.3 - no horizontal scroll at 1024 and 1440
 * T3.4 - 16:9 preview aspect ratio
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

/**
 * Assert no request left localhost during the test. The GitHub release check
 * is routed locally by stubReleaseCheck but still fires the request event,
 * so we exclude it from the check.
 */
function assertNoUnstubExternalRequests(page: Page): () => void {
  const external: string[] = []
  page.on('request', req => {
    const url = req.url()
    try {
      const parsed = new URL(url)
      if (
        parsed.hostname !== 'localhost' &&
        parsed.hostname !== '127.0.0.1' &&
        !url.includes('api.github.com/repos')
      ) {
        external.push(url)
      }
    } catch {
      // Ignore invalid URLs
    }
  })
  return () => expect(external).toEqual([])
}

/** Full setup: stub release check, install shared + motion mocks, freeze clock. */
async function setupAll(
  page: Page,
  motionOptions?: Parameters<typeof installMotionMocks>[1]
): Promise<() => void> {
  const assertNoExternal = assertNoUnstubExternalRequests(page)
  await stubReleaseCheck(page)
  await setupTauriMocks(page)
  await installMotionMocks(page, motionOptions)
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 1.0
  })
  return assertNoExternal
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

/** Set the next-themes theme via localStorage before navigation. */
async function setTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript((t: string) => {
    localStorage.setItem('theme', t)
  }, theme)
}

// A 120-character name for equal-height tests
const LONG_NAME = 'A'.repeat(120)

const LONG_NAME_TEMPLATE_JSON = JSON.stringify({
  schemaVersion: 1,
  id: 'long-name-template',
  version: '1.0.0',
  name: LONG_NAME,
  description: 'Template with a very long name for layout testing',
  category: 'accent',
  status: 'stable',
  tags: [],
  fonts: [],
  duration: 4,
  inEnd: 1,
  outStart: 3,
  params: {},
  layers: [
    {
      kind: 'rect',
      id: 'r1',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 100 } }],
      opacity: [{ t: 0, value: 1 }],
      width: 200,
      height: 50,
      fill: '#00ff00',
      radius: 0
    }
  ]
})

// ---------------------------------------------------------------------------
// T3.1: Token equality under Light, Dark and Dracula
// ---------------------------------------------------------------------------

test.describe('T3.1 style-fit: token equality', () => {
  const themes = ['light', 'dark', 'dracula'] as const

  for (const theme of themes) {
    test(`card tokens match bg-card border-border probe in ${theme} theme`, async ({
      page
    }) => {
      const assertNoExternal = await setupAll(page)
      await setTheme(page, theme)
      await gotoMarketplace(page)

      // Inject a probe element next to the grid
      const probeResult = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.className = 'bg-card border-border rounded-xl border'
        probe.style.position = 'fixed'
        probe.style.top = '-9999px'
        probe.style.left = '-9999px'
        probe.style.width = '100px'
        probe.style.height = '100px'
        document.body.appendChild(probe)

        const style = window.getComputedStyle(probe)
        const result = {
          backgroundColor: style.backgroundColor,
          borderTopColor: style.borderTopColor,
          borderTopLeftRadius: style.borderTopLeftRadius,
          fontFamily: style.fontFamily
        }

        probe.remove()
        return result
      })

      // Get the same values from an actual card
      const cardResult = await page.evaluate(() => {
        const card = document.querySelector('[data-template-id]')
        if (!card) throw new Error('No template card found')
        const style = window.getComputedStyle(card)
        return {
          backgroundColor: style.backgroundColor,
          borderTopColor: style.borderTopColor,
          borderTopLeftRadius: style.borderTopLeftRadius,
          fontFamily: style.fontFamily
        }
      })

      expect(cardResult.backgroundColor).toBe(probeResult.backgroundColor)
      expect(cardResult.borderTopColor).toBe(probeResult.borderTopColor)
      expect(cardResult.borderTopLeftRadius).toBe(probeResult.borderTopLeftRadius)
      expect(cardResult.fontFamily).toBe(probeResult.fontFamily)

      assertNoExternal()
    })
  }
})

// ---------------------------------------------------------------------------
// T3.2: Equal card heights with a long name
// ---------------------------------------------------------------------------

test.describe('T3.2 equal card heights', () => {
  test('all cards have the same height with a 120-character name at 1440px', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const assertNoExternal = await setupAll(page, {
      libraryFolder: {
        path: '/mock/library',
        files: [
          {
            name: 'long-name-template.json',
            contents: LONG_NAME_TEMPLATE_JSON
          }
        ]
      }
    })
    await gotoMarketplace(page)

    const grid = page.getByRole('list', { name: 'Templates' })
    await expect(grid).toBeVisible()

    // Get all card heights
    const heights = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-template-id]')
      return Array.from(items).map(el => el.getBoundingClientRect().height)
    })

    expect(heights.length).toBeGreaterThan(1)

    // All heights should be equal within 1px
    const maxHeight = Math.max(...heights)
    const minHeight = Math.min(...heights)
    expect(maxHeight - minHeight).toBeLessThanOrEqual(1)

    // The long name should be clamped to 2 lines (line-clamp-2)
    const longCard = page.locator('[data-template-id="long-name-template"]')
    await expect(longCard).toBeVisible()
    const lineClampResult = await longCard.evaluate(el => {
      const nameEl = el.querySelector('.line-clamp-2')
      if (!nameEl) return { hasCss: false }
      const style = window.getComputedStyle(nameEl)
      return {
        hasCss:
          style.webkitLineClamp === '2' ||
          style.getPropertyValue('-webkit-line-clamp') === '2'
      }
    })
    expect(lineClampResult.hasCss).toBe(true)

    assertNoExternal()
  })
})

// ---------------------------------------------------------------------------
// T3.3: No horizontal scroll at 1024 and 1440
// ---------------------------------------------------------------------------

test.describe('T3.3 no horizontal scroll', () => {
  const widths = [1024, 1440]

  for (const width of widths) {
    test(`no horizontal scroll at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const assertNoExternal = await setupAll(page)
      await gotoMarketplace(page)

      const scrollCheck = await page.evaluate(() => {
        const el = document.scrollingElement
        if (!el) return { overflow: false }
        return {
          overflow: el.scrollWidth > el.clientWidth
        }
      })

      expect(scrollCheck.overflow).toBe(false)

      assertNoExternal()
    })
  }
})

// ---------------------------------------------------------------------------
// T3.4: 16:9 preview aspect ratio
// ---------------------------------------------------------------------------

test.describe('T3.4 preview 16:9 aspect ratio', () => {
  test('card preview area has 16:9 aspect ratio within 1px', async ({ page }) => {
    const assertNoExternal = await setupAll(page)
    await gotoMarketplace(page)

    const ratioCheck = await page.evaluate(() => {
      const stage = document.querySelector('.preview-stage')
      if (!stage) return { width: 0, height: 0 }
      const rect = stage.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height
      }
    })

    const expected169 = 16 / 9
    const heightFromWidth = ratioCheck.width / expected169
    expect(Math.abs(ratioCheck.height - heightFromWidth)).toBeLessThanOrEqual(1)

    assertNoExternal()
  })
})
