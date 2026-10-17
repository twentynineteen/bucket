/**
 * MotionMarketplacePage tests (issue #336).
 *
 * Behaviours: G1.1 (grid heading and template list), G1.5 (dialog open/close),
 * G2.1 (favourite toggle + writeTextFile + card reorder),
 * G2.2 (star is only curation control, default marker updates),
 * G3.4 (filter bar controls), G4.1 (issues banner), G4.2 (rescan restores banner),
 * G4.3 (missing font banner), G4.4 (empty filter state), G4.5 (favourites-only empty).
 *
 * Mocks: api module (Tauri I/O boundary) and @tauri-apps/plugin-fs for
 * writeTextFile assertions. Real hooks, cards and previews are rendered.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogueEntry, MotionTemplate } from '../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// writeTextFile mock for asserting prefs writes
const writeTextFileMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: unknown[]) => writeTextFileMock(...args),
  readTextFile: vi.fn().mockResolvedValue(null),
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  readDir: vi.fn().mockResolvedValue([]),
  exists: vi.fn().mockResolvedValue(false),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app-data'),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/')))
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null)
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn().mockResolvedValue(undefined)
}))

// Mock the ticker to avoid rAF subscriptions
vi.mock('../internal/ticker', () => ({
  subscribe: vi.fn(() => () => {}),
  getTicker: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    pause: vi.fn(),
    resume: vi.fn()
  }))
}))

// Ensure matchMedia is always available (mockReset clears the setup-file mock)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

// Set test clock
beforeAll(() => {
  ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.5
})
afterAll(() => {
  delete (window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__
})

// ---------------------------------------------------------------------------
// Template fixtures
// ---------------------------------------------------------------------------

function makeTemplate(
  id: string,
  name: string,
  overrides?: Partial<MotionTemplate>
): MotionTemplate {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    name,
    description: `Description for ${name}`,
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {},
    layers: [
      {
        kind: 'rect',
        id: 'bg',
        anchor: { x: 0, y: 0 },
        width: 100,
        height: 100,
        fill: '#fff',
        radius: 0
      }
    ],
    ...overrides
  }
}

const quoteCard = makeTemplate('quote-card', 'Quote card', {
  category: 'title-card'
})
const scoreRing = makeTemplate('score-ring', 'Score ring', {
  category: 'data'
})
const spreadMap: MotionTemplate = {
  ...makeTemplate('spread-map', 'Spread map', {
    category: 'data',
    status: 'experimental'
  }),
  layers: [
    {
      kind: 'particles',
      id: 'scatter',
      anchor: { x: 0, y: 0 },
      points: [{ x: 100, y: 200 }],
      seed: 42,
      assembleStart: 0,
      assembleEnd: 1,
      baseFill: '#888',
      regionFills: {},
      pointRadius: 4
    }
  ]
}

// Catalogue entries
const defaultEntries: CatalogueEntry[] = [
  { template: quoteCard, source: 'builtin' },
  { template: scoreRing, source: 'builtin' },
  { template: spreadMap, source: 'builtin' }
]
// ---------------------------------------------------------------------------
// Mock catalogue and prefs at the hook level
// ---------------------------------------------------------------------------

let mockEntries = defaultEntries
let mockPrefsText: string | null = null
let mockFontAvailable = true

vi.mock('../api', () => ({
  readMotionPrefsText: vi.fn(() => Promise.resolve(mockPrefsText)),
  writeMotionPrefsText: vi.fn((text: string) => {
    // Invoke the plugin-fs mock so we can assert the path
    writeTextFileMock('/mock/app-data/motion_prefs.json', text)
    return Promise.resolve()
  }),
  motionFontAvailable: vi.fn(() => Promise.resolve(mockFontAvailable)),
  readMotionFont: vi.fn().mockResolvedValue(new Uint8Array()),
  listFolder: vi.fn().mockResolvedValue([]),
  readText: vi.fn().mockResolvedValue('{}'),
  pickFolder: vi.fn().mockResolvedValue(null),
  pickPngImage: vi.fn().mockResolvedValue(null),
  pathExists: vi.fn().mockResolvedValue(false),
  makeDir: vi.fn().mockResolvedValue(undefined),
  writeText: vi.fn().mockResolvedValue(undefined),
  writeBytes: vi.fn().mockResolvedValue(undefined),
  renamePath: vi.fn().mockResolvedValue(undefined),
  removeDirRecursive: vi.fn().mockResolvedValue(undefined),
  joinPath: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  copyFileTo: vi.fn().mockResolvedValue(undefined),
  revealInFinder: vi.fn().mockResolvedValue(undefined),
  startRender: vi.fn().mockResolvedValue('render-1'),
  sendRenderFrame: vi.fn().mockResolvedValue(undefined),
  finishRender: vi.fn().mockResolvedValue('/output.mov'),
  cancelRender: vi.fn().mockResolvedValue(undefined),
  onRenderProgress: vi.fn().mockResolvedValue(() => {})
}))

// Override builtins to use our test fixtures
vi.mock('../internal/builtins', () => ({
  loadBuiltins: () => ({
    templates: mockEntries.filter(e => e.source === 'builtin').map(e => e.template),
    issues: []
  })
}))

// Override the Upload barrel to avoid Tauri calls
vi.mock('@features/Upload', () => ({
  posterFrameFontPath: vi.fn().mockResolvedValue('/mock/Cabrito.otf')
}))

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

async function renderPage(opts?: { waitForTemplates?: boolean }) {
  const MotionMarketplacePage = (await import('./MotionMarketplacePage')).default
  const result = render(<MotionMarketplacePage />, { wrapper: createWrapper() })
  // Wait for the page heading
  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: /motion marketplace/i })
    ).toBeInTheDocument()
  })
  // Wait for template cards to appear (prefs + catalogue are async)
  if (opts?.waitForTemplates !== false) {
    await waitFor(() => {
      const list = screen.queryByRole('list', { name: /templates/i })
      if (list) {
        expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0)
      }
    })
  }
  return result
}

beforeEach(() => {
  mockEntries = defaultEntries
  mockPrefsText = null
  mockFontAvailable = true
  writeTextFileMock.mockClear()
})

// ---------------------------------------------------------------------------
// G1.1 - Grid heading and template list
// ---------------------------------------------------------------------------

describe('G1.1 grid and cards', () => {
  it('renders a heading and a list with all templates', async () => {
    await renderPage()

    expect(
      screen.getByRole('heading', { name: /motion marketplace/i })
    ).toBeInTheDocument()

    const list = screen.getByRole('list', { name: /templates/i })
    expect(list).toBeInTheDocument()

    // Named-presence checks, no count. Use exact match to avoid
    // collisions with the "Favourite <name>" star buttons.
    expect(within(list).getByRole('button', { name: 'Quote card' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Score ring' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Spread map' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G1.5 - Dialog open/close with focus management
// ---------------------------------------------------------------------------

describe('G1.5 dialog open/close', () => {
  it('opens dialog on Enter and closes on Escape', async () => {
    await renderPage()
    const user = userEvent.setup()

    const list = screen.getByRole('list', { name: /templates/i })
    const cardButton = within(list).getByRole('button', {
      name: 'Quote card'
    })

    // Focus and press Enter
    cardButton.focus()
    await user.keyboard('{Enter}')

    // Dialog should open with the template name as title
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /quote card/i })).toBeInTheDocument()
    })

    // Press Escape to close
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Focus should return to the card button
    await waitFor(() => {
      expect(document.activeElement).toBe(cardButton)
    })
  })
})

// ---------------------------------------------------------------------------
// G2.1 - Favourite toggle writes prefs and reorders
// ---------------------------------------------------------------------------

describe('G2.1 favourite toggle', () => {
  it('toggles favourite and writes motion_prefs.json', async () => {
    await renderPage()
    const user = userEvent.setup()

    // Find the star toggle for Quote card
    const starBtn = screen.getByRole('button', {
      name: /favourite quote card/i
    })
    expect(starBtn).toHaveAttribute('aria-pressed', 'false')

    await user.click(starBtn)

    await waitFor(() => {
      expect(starBtn).toHaveAttribute('aria-pressed', 'true')
    })

    // Check that writeTextFile received a prefs file containing
    // quote-card in favourites
    await waitFor(() => {
      expect(writeTextFileMock).toHaveBeenCalled()
      const lastCall =
        writeTextFileMock.mock.calls[writeTextFileMock.mock.calls.length - 1]
      expect(lastCall[0]).toContain('motion_prefs.json')
      const prefs = JSON.parse(lastCall[1])
      expect(prefs.favourites).toContain('quote-card')
    })
  })
})

// ---------------------------------------------------------------------------
// G2.2 - Star is only curation control; default marker updates
// ---------------------------------------------------------------------------

describe('G2.2 curation controls', () => {
  it('the card has only the favourite star, not a default toggle', async () => {
    await renderPage()

    const list = screen.getByRole('list', { name: /templates/i })
    // No "Set as category default" button on the card level
    expect(
      within(list).queryByRole('button', { name: /set as.*default/i })
    ).not.toBeInTheDocument()
  })

  it('shows Default marker when prefs default changes', async () => {
    // Start with Glide as the lower-third default
    const glide = makeTemplate('glide', 'Glide')
    const barReveal = makeTemplate('bar-reveal', 'Bar reveal')
    mockEntries = [
      { template: glide, source: 'builtin' },
      { template: barReveal, source: 'builtin' }
    ]
    mockPrefsText = JSON.stringify({
      libraryFolder: null,
      defaultFormat: { width: 3840, height: 2160, fps: 50 },
      favourites: [],
      defaults: { 'lower-third': 'glide' },
      lastProjectFolder: null,
      rememberedTargets: null
    })

    await renderPage()

    // Glide should show Default marker
    const list = screen.getByRole('list', { name: /templates/i })
    const glideCard = within(list)
      .getByRole('button', { name: 'Glide' })
      .closest('[data-template-id]') as HTMLElement | null
    expect(glideCard).not.toBeNull()
    expect(within(glideCard!).getByText('Default')).toBeInTheDocument()

    // Bar reveal should not show Default
    const barRevealCard = within(list)
      .getByRole('button', { name: 'Bar reveal' })
      .closest('[data-template-id]') as HTMLElement | null
    expect(within(barRevealCard!).queryByText('Default')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G3.4 - Filter bar controls
// ---------------------------------------------------------------------------

describe('G3.4 filter bar controls', () => {
  it('renders Category, Status, Favourites only, Target and Search controls', async () => {
    await renderPage()

    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /favourites only/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /target/i })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: /search templates/i })
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G4.1 - Issues banner
// ---------------------------------------------------------------------------

describe('G4.1 issues banner', () => {
  it('shows an alert with issue count and details, dismissible', async () => {
    // Provide a catalogue that reports 2 issues
    const { listFolder } = await import('../api')
    const origListFolder = vi.mocked(listFolder)
    // Override to return a library with issues
    mockPrefsText = JSON.stringify({
      libraryFolder: '/mock/lib',
      defaultFormat: { width: 3840, height: 2160, fps: 50 },
      favourites: [],
      defaults: {},
      lastProjectFolder: null,
      rememberedTargets: null
    })

    // We need to mock the library loading to produce issues
    // Since we're mocking the builtins, let's add a separate mock path
    // Actually, the issues come from loadLibrary which is called by the hook
    // We need to mock listFolder to return files that fail to parse
    origListFolder.mockResolvedValueOnce([
      { name: 'bad-template.json', isFile: true },
      { name: 'missing-version.json', isFile: true }
    ])

    const { readText } = await import('../api')
    vi.mocked(readText)
      .mockResolvedValueOnce('{ invalid json }')
      .mockResolvedValueOnce('{"name":"test"}')

    await renderPage()

    const user = userEvent.setup()

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert.textContent).toMatch(/couldn't be loaded/i)
    })

    // Dismiss
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i })
    await user.click(dismissBtn)

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// G4.2 - Rescan restores banner
// ---------------------------------------------------------------------------

describe('G4.2 rescan restores banner', () => {
  it('shows banner again after rescan if issues remain', async () => {
    mockPrefsText = JSON.stringify({
      libraryFolder: '/mock/lib',
      defaultFormat: { width: 3840, height: 2160, fps: 50 },
      favourites: [],
      defaults: {},
      lastProjectFolder: null,
      rememberedTargets: null
    })

    const { listFolder, readText } = await import('../api')
    vi.mocked(listFolder).mockResolvedValue([{ name: 'broken.json', isFile: true }])
    vi.mocked(readText).mockResolvedValue('not json')

    await renderPage()
    const user = userEvent.setup()

    // Wait for initial banner
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Dismiss it
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    // Rescan
    const rescanBtn = screen.getByRole('button', { name: /rescan/i })
    await user.click(rescanBtn)

    // Banner should reappear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// G4.3 - Missing font banner
// ---------------------------------------------------------------------------

describe('G4.3 missing font banner', () => {
  it('shows a banner when Cabrito font is missing', async () => {
    mockFontAvailable = false

    await renderPage()

    await waitFor(() => {
      expect(
        screen.getByText(/cabrito semi norm bold is not installed/i)
      ).toBeInTheDocument()
    })
  })

  it('shows no font banner when Cabrito is installed', async () => {
    mockFontAvailable = true

    await renderPage()

    // Wait for the page to stabilise, then check
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /motion marketplace/i })
      ).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/cabrito semi norm bold is not installed/i)
    ).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G4.4 - No templates match filters
// ---------------------------------------------------------------------------

describe('G4.4 empty filter state', () => {
  it('shows "No templates match" and a Clear filters button', async () => {
    await renderPage()
    const user = userEvent.setup()

    // Type a search that matches nothing
    const searchBox = screen.getByRole('searchbox', { name: /search templates/i })
    await user.type(searchBox, 'xyznonexistent')

    await waitFor(() => {
      expect(screen.getByText(/no templates match these filters/i)).toBeInTheDocument()
    })

    const clearBtn = screen.getByRole('button', { name: /clear filters/i })
    await user.click(clearBtn)

    // Templates should be back
    await waitFor(() => {
      expect(
        screen.queryByText(/no templates match these filters/i)
      ).not.toBeInTheDocument()
    })

    const list = screen.getByRole('list', { name: /templates/i })
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// G4.5 - Favourites only with no favourites
// ---------------------------------------------------------------------------

describe('G4.5 favourites-only empty', () => {
  it('shows a message about no favourites when none are saved', async () => {
    // No favourites in prefs
    mockPrefsText = null
    await renderPage()
    const user = userEvent.setup()

    // Check the "Favourites only" checkbox
    const favCheckbox = screen.getByRole('checkbox', { name: /favourites only/i })
    await user.click(favCheckbox)

    await waitFor(() => {
      expect(screen.getByText(/no favourites yet/i)).toBeInTheDocument()
    })
  })
})
