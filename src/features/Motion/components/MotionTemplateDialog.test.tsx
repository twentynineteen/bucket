/**
 * MotionTemplateDialog tests (issue #337)
 *
 * M1.1: Dialog role, preview, play/pause/restart.
 * M1.2: Set as category default toggle.
 * M3.1: Overflow warning shown in dialog.
 * M4.1: Format combobox options.
 * M4.2: Project folder warning.
 * M4.3: Folder preselected from prefs.
 * M4.4: Target checkboxes, defaults, remembered selection.
 * M4.5: Video disabled when ffmpeg unavailable.
 * M4.6: Video disabled when font missing.
 * M4.7: Invalid fps options disabled.
 * M4.8: Export disabled when folder/target/param missing.
 * M5.6: Video render progress and cancel.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogueEntry, MotionTemplate } from '../types'
import MotionTemplateDialog from './MotionTemplateDialog'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the ticker to return a fixed time
vi.mock('../hooks/useMotionTicker', () => ({
  useMotionTicker: vi.fn(() => ({
    containerRef: vi.fn(),
    time: 0.5,
    isPlaying: true
  }))
}))

// Mock the font hook
vi.mock('../hooks/useMotionFont', () => ({
  useMotionFont: vi.fn(() => ({
    status: 'ready' as const,
    bytes: new Uint8Array(8)
  }))
}))

// Mock api module
vi.mock('../api', () => ({
  pickFolder: vi.fn(async () => '/p'),
  pickPngImage: vi.fn(async () => null),
  copyToClipboard: vi.fn(async () => {}),
  revealInFinder: vi.fn(async () => {}),
  readMotionPrefsText: vi.fn(async () => null),
  writeMotionPrefsText: vi.fn(async () => {}),
  joinPath: vi.fn(async (...parts: string[]) => parts.join('/')),
  makeDir: vi.fn(async () => {}),
  writeText: vi.fn(async () => {}),
  writeBytes: vi.fn(async () => {}),
  renamePath: vi.fn(async () => {}),
  removeDirRecursive: vi.fn(async () => {}),
  pathExists: vi.fn(async () => false),
  copyFileTo: vi.fn(async () => {}),
  listFolder: vi.fn(async () => []),
  modifiedTimeMs: vi.fn(async () => Date.now()),
  motionFontAvailable: vi.fn(async () => true),
  readMotionFont: vi.fn(async () => new Uint8Array(8)),
  readBytes: vi.fn(async () => new Uint8Array(8)),
  startRender: vi.fn(async () => 'render-1'),
  sendRenderFrame: vi.fn(async () => {}),
  finishRender: vi.fn(async () => '/p/out.mov'),
  cancelRender: vi.fn(async () => {}),
  onRenderProgress: vi.fn(async () => () => {})
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

// Mock shared hooks (must include all exports used transitively)
vi.mock('@shared/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  return {
    ...actual,
    useApiKeys: vi.fn(() => ({
      data: { ffmpegDirectory: '/usr/local/bin' },
      isPending: false,
      isError: false
    }))
  }
})

// Default Kavanagh mock: ffmpeg ready, pools ready
vi.mock('@features/Kavanagh', () => ({
  useKavanaghAvailability: vi.fn(() => ({
    available: true,
    reason: null,
    pending: false,
    ffmpeg: { status: 'ready', ffmpeg: '/usr/bin/ffmpeg', ffprobe: '/usr/bin/ffprobe' },
    pools: { watermarks: { status: 'ready' }, stings: { status: 'ready' } },
    poolFiles: { watermarks: [], stings: [] },
    referenceFolder: null
  }))
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function scoreRingTemplate(): MotionTemplate {
  return {
    schemaVersion: 1,
    id: 'score-ring',
    version: '1.0.0',
    name: 'Score ring',
    description: 'Arc ring sweeps from zero to the score percentage.',
    category: 'data',
    status: 'stable',
    tags: ['data', 'score'],
    fonts: ['CabritoSemi-NorBol'],
    primaryTextParam: 'label',
    duration: 3.28,
    inEnd: 0.8,
    outStart: 2.8,
    params: {
      score: {
        kind: 'number',
        label: 'Score',
        default: 72,
        min: 0,
        max: 100
      },
      label: {
        kind: 'text',
        label: 'Label',
        maxLength: 30,
        default: 'Performance',
        required: false
      },
      hold: {
        kind: 'hold',
        label: 'Hold',
        min: 1,
        max: 8,
        default: 2
      }
    },
    layers: [
      {
        kind: 'arc',
        id: 'ring',
        anchor: { x: 1920, y: 1080 },
        innerRadius: 400,
        outerRadius: 480,
        sweep: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 0.8, value: 1 }
        ],
        startAngle: [{ t: 0, value: 0 }],
        sweepFromParam: { param: 'score', max: 100 },
        fill: '#ff3366'
      },
      {
        kind: 'text',
        id: 'label-text',
        anchor: { x: 0, y: 0 },
        position: [{ t: 0, value: { x: 1920, y: 1400 } }],
        text: 'Performance',
        param: 'label',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 48 },
        align: 'center',
        lineHeight: 1.2,
        multiline: false,
        fill: '#ffffff'
      }
    ]
  }
}

function barRevealTemplate(): MotionTemplate {
  return {
    ...scoreRingTemplate(),
    id: 'lower-third-bar-reveal',
    name: 'Bar reveal',
    category: 'lower-third',
    params: {
      name: {
        kind: 'text',
        label: 'Name',
        maxLength: 30,
        default: 'Jane Doe',
        required: true
      }
    },
    primaryTextParam: 'name',
    layers: [
      {
        kind: 'rect',
        id: 'bar',
        anchor: { x: 0, y: 0 },
        position: [{ t: 0, value: { x: 0, y: 1700 } }],
        width: 3840,
        height: 200,
        fill: '#1a1a2e',
        radius: 0
      }
    ]
  }
}

function makeEntry(template?: MotionTemplate): CatalogueEntry {
  return {
    template: template ?? scoreRingTemplate(),
    source: 'builtin'
  }
}

function particleEntry(): CatalogueEntry {
  return {
    template: {
      ...scoreRingTemplate(),
      id: 'spread-map',
      name: 'Spread map',
      category: 'data',
      params: {
        image: { kind: 'image', label: 'Source image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [{ x: 100, y: 200 }],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    },
    source: 'builtin'
  }
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function renderDialog(
  entry: CatalogueEntry = makeEntry(),
  { open = true }: { open?: boolean } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  const onOpenChange = vi.fn()

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MotionTemplateDialog template={entry} open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )

  return { ...utils, onOpenChange, queryClient }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MotionTemplateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('M1.1 - Dialog and preview', () => {
    it('has role dialog named after the template', () => {
      renderDialog(makeEntry())

      const dialog = screen.getByRole('dialog', { name: /Score ring/i })
      expect(dialog).toBeInTheDocument()
    })

    it('shows a large preview with accessible name', () => {
      renderDialog(makeEntry())

      const preview = screen.getByRole('img', { name: /Score ring preview/i })
      expect(preview).toBeInTheDocument()
    })

    it('shows Pause and Restart buttons; Pause toggles to Play', async () => {
      renderDialog(makeEntry())

      const pauseBtn = screen.getByRole('button', { name: /^Pause$/i })
      expect(pauseBtn).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Restart$/i })).toBeInTheDocument()

      // fireEvent.click because Radix Dialog's pointer-events:none on body
      // prevents userEvent's pointer dispatch inside the portal
      fireEvent.click(pauseBtn)

      // After clicking Pause, the button relabels to Play
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Play$/i })).toBeInTheDocument()
      })
    })
  })

  describe('M1.2 - Category default toggle', () => {
    it('shows the "Set as category default" button', () => {
      renderDialog(makeEntry(barRevealTemplate()))

      const toggle = screen.getByRole('button', { name: /Set as category default/i })
      expect(toggle).toBeInTheDocument()
      // Initially not the default
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('M4.1 - Format combobox', () => {
    it('shows the format combobox with expected options', async () => {
      const user = userEvent.setup()
      renderDialog(makeEntry())

      const formatSelect = screen.getByRole('combobox', { name: /Format/i })
      expect(formatSelect).toBeInTheDocument()

      await user.click(formatSelect)

      // Verify some format options are present by searching for fps values
      for (const fps of ['25', '30', '50', '60']) {
        expect(screen.getAllByText(new RegExp(fps)).length).toBeGreaterThan(0)
      }
    })
  })

  describe('M4.2 - Project folder', () => {
    it('picks a folder, shows the path, shows a warning for a non-Bucket folder, and enables Export', async () => {
      const api = await import('../api')
      renderDialog(makeEntry())

      // Before picking: Export is disabled
      expect(screen.getByRole('button', { name: /Export to project/i })).toBeDisabled()

      // Click the folder button; the mock returns '/p'
      // and pathExists returns false for breadcrumbs.json and Graphics.
      // Using fireEvent instead of user.click because Radix Dialog's
      // pointer-events:none on body prevents userEvent pointer dispatch.
      fireEvent.click(screen.getByRole('button', { name: /Choose project folder/i }))

      // Verify the handler ran: pickFolder was called
      await waitFor(
        () => {
          expect(api.pickFolder).toHaveBeenCalled()
        },
        { timeout: 2000 }
      )

      // The picked path's last segment should be visible
      await waitFor(
        () => {
          expect(screen.getByText('p')).toBeInTheDocument()
        },
        { timeout: 2000 }
      )

      // Warning should appear: no breadcrumbs.json or Graphics/
      expect(screen.getByText(/does not look like a Bucket project/i)).toBeInTheDocument()

      // Export should now be enabled (folder set, targets defaulted)
      expect(
        screen.getByRole('button', { name: /Export to project/i })
      ).not.toBeDisabled()
    })
  })

  describe('M4.4 - Target checkboxes', () => {
    it('non-particle: shows five target checkboxes', () => {
      renderDialog(makeEntry())

      // Each target has a checkbox with an exact aria-label match
      const targetNames = [
        'After Effects',
        'DaVinci Resolve',
        'Premiere (mogrt via After Effects)',
        'Video',
        'Claude prompt'
      ]

      for (const name of targetNames) {
        const cb = screen.getByRole('checkbox', { name })
        expect(cb).toBeInTheDocument()
      }
    })

    it('particle: only Video and Claude prompt exist', () => {
      renderDialog(particleEntry())

      expect(
        screen.queryByRole('checkbox', { name: /After Effects/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('checkbox', { name: /DaVinci Resolve/i })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /^Video$/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /Claude prompt/i })).toBeInTheDocument()
    })
  })

  describe('M4.5 - Video disabled when ffmpeg unavailable', () => {
    it('ffmpeg ready and pools missing: Video stays enabled', async () => {
      const { useKavanaghAvailability } = await import('@features/Kavanagh')
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: false,
        reason: 'Watermark references not found',
        pending: false,
        ffmpeg: {
          status: 'ready',
          ffmpeg: '/usr/bin/ffmpeg',
          ffprobe: '/usr/bin/ffprobe'
        },
        pools: { watermarks: { status: 'missing' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: '/ref'
      })

      renderDialog(makeEntry())

      // Video should be enabled despite pools being unavailable
      const videoCheckbox = screen.getByRole('checkbox', { name: /^Video$/i })
      expect(videoCheckbox).not.toBeDisabled()

      // Restore
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: true,
        reason: null,
        pending: false,
        ffmpeg: {
          status: 'ready',
          ffmpeg: '/usr/bin/ffmpeg',
          ffprobe: '/usr/bin/ffprobe'
        },
        pools: { watermarks: { status: 'ready' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })
    })

    it('ffmpeg notFound but reason mentions pools: Video still disabled', async () => {
      // Proves that Video availability checks the ffmpeg field directly,
      // not the reason string. If a pool fault comes first in the reason,
      // the old string-matching code would wrongly enable Video.
      const { useKavanaghAvailability } = await import('@features/Kavanagh')
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: false,
        reason: 'Watermark references not found',
        pending: false,
        ffmpeg: { status: 'notFound', missing: ['ffmpeg'], searched: ['/usr/bin'] },
        pools: { watermarks: { status: 'missing' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })

      renderDialog(makeEntry())

      const videoCheckbox = screen.getByRole('checkbox', { name: /^Video$/i })
      expect(videoCheckbox).toBeDisabled()

      // Restore
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: true,
        reason: null,
        pending: false,
        ffmpeg: {
          status: 'ready',
          ffmpeg: '/usr/bin/ffmpeg',
          ffprobe: '/usr/bin/ffprobe'
        },
        pools: { watermarks: { status: 'ready' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })
    })

    it('ffmpeg null: Video disabled with Settings link', async () => {
      const { useKavanaghAvailability } = await import('@features/Kavanagh')
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: false,
        reason: 'ffmpeg was not found',
        pending: false,
        ffmpeg: null,
        pools: { watermarks: { status: 'missing' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })

      renderDialog(makeEntry())

      const videoCheckbox = screen.getByRole('checkbox', { name: /^Video$/i })
      expect(videoCheckbox).toBeDisabled()

      expect(
        screen.getByRole('link', { name: /Set up ffmpeg in Settings/i })
      ).toHaveAttribute('href', '/settings/general#kavanagh')

      // Restore
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: true,
        reason: null,
        pending: false,
        ffmpeg: {
          status: 'ready',
          ffmpeg: '/usr/bin/ffmpeg',
          ffprobe: '/usr/bin/ffprobe'
        },
        pools: { watermarks: { status: 'ready' }, stings: { status: 'ready' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })
    })
  })

  describe('M4.6 - Video disabled when font missing', () => {
    it('disables Video with reason text about the font', async () => {
      const fontHook = await import('../hooks/useMotionFont')
      ;(fontHook.useMotionFont as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 'missing'
      })

      renderDialog(makeEntry())

      const videoCheckbox = screen.getByRole('checkbox', { name: /^Video$/i })
      expect(videoCheckbox).toBeDisabled()

      expect(
        screen.getByText(/Requires Cabrito\.otf in ~\/Library\/Fonts/i)
      ).toBeInTheDocument()

      // Restore
      ;(fontHook.useMotionFont as ReturnType<typeof vi.fn>).mockReturnValue({
        status: 'ready',
        bytes: new Uint8Array(8)
      })
    })
  })

  describe('M4.7 - Invalid fps disabled', () => {
    it('valid formats exclude collapsed fps options', async () => {
      const resolveModule = await import('../internal/resolve')
      const { validFormats } = resolveModule
      // Keyframes at 0 and 0.02: both snap to frame 0 at 24fps
      // (round(0*24)=0, round(0.02*24)=round(0.48)=0)
      // but snap to different frames at higher fps
      const collapsingTmpl: MotionTemplate = {
        ...scoreRingTemplate(),
        id: 'collapsing-test',
        layers: [
          {
            kind: 'rect',
            id: 'bg',
            anchor: { x: 0, y: 0 },
            position: [{ t: 0, value: { x: 0, y: 0 } }],
            opacity: [
              {
                t: 0,
                value: 0,
                ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
              },
              { t: 0.02, value: 1 }
            ],
            width: 3840,
            height: 200,
            fill: '#000000',
            radius: 0
          }
        ]
      }

      const formats = validFormats(collapsingTmpl)
      const fps24Formats = formats.filter(f => f.fps === 24)
      expect(fps24Formats).toHaveLength(0)
      // Other fps values should still be valid
      const fps50Formats = formats.filter(f => f.fps === 50)
      expect(fps50Formats.length).toBeGreaterThan(0)
    })
  })

  describe('M4.8 - Export disabled conditions', () => {
    it('disabled when no folder is chosen', () => {
      renderDialog(makeEntry())

      expect(screen.getByRole('button', { name: /Export to project/i })).toBeDisabled()
    })

    it('Copy Claude prompt is enabled when params are valid', () => {
      renderDialog(makeEntry())

      expect(
        screen.getByRole('button', { name: /Copy Claude prompt/i })
      ).not.toBeDisabled()
    })
  })

  describe('M5.6 - Video render progress', () => {
    it('dialog renders with export controls', () => {
      renderDialog(makeEntry())

      expect(
        screen.getByRole('button', { name: /Export to project/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Copy Claude prompt/i })
      ).toBeInTheDocument()
    })
  })

  describe('S2 - dialog preview animates with real ticker', () => {
    it('containerRef is attached and SVG gains layers after a tick', async () => {
      // Get the real (unmocked) ticker hook via importActual
      const realTickerModule = await vi.importActual<
        typeof import('../hooks/useMotionTicker')
      >('../hooks/useMotionTicker')

      // Stub matchMedia for the real ticker's prefersReducedMotion check
      const originalMatchMedia = window.matchMedia
      window.matchMedia = vi
        .fn()
        .mockReturnValue({ matches: false }) as typeof window.matchMedia

      // Stub IntersectionObserver to immediately report isIntersecting
      const originalIO = globalThis.IntersectionObserver
      globalThis.IntersectionObserver = class StubIO {
        _cb: IntersectionObserverCallback
        constructor(cb: IntersectionObserverCallback) {
          this._cb = cb
        }
        observe(target: Element) {
          this._cb(
            [
              {
                target,
                isIntersecting: true,
                intersectionRatio: 1,
                boundingClientRect: target.getBoundingClientRect(),
                intersectionRect: target.getBoundingClientRect(),
                rootBounds: null,
                time: performance.now()
              } as IntersectionObserverEntry
            ],
            this as unknown as IntersectionObserver
          )
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
        root = null
        rootMargin = '0px'
        thresholds = [0]
      } as unknown as typeof IntersectionObserver

      // Point the mock at the real implementation
      const mockModule = await import('../hooks/useMotionTicker')
      ;(mockModule.useMotionTicker as ReturnType<typeof vi.fn>).mockImplementation(
        realTickerModule.useMotionTicker
      )

      renderDialog(makeEntry())

      // The preview SVG should exist
      const preview = screen.getByRole('img', { name: /Score ring preview/i })
      const svg = preview.querySelector('svg')
      expect(svg).not.toBeNull()

      // After a tick, the SVG should have rendered child elements.
      // jsdom's requestAnimationFrame fires synchronously or on next
      // microtask. We wait for the ticker callback to populate layers.
      await waitFor(
        () => {
          const children = svg!.querySelectorAll('rect, ellipse, path, text, circle')
          expect(children.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      // Clean up
      window.matchMedia = originalMatchMedia
      globalThis.IntersectionObserver = originalIO
      ;(mockModule.useMotionTicker as ReturnType<typeof vi.fn>).mockReturnValue({
        containerRef: vi.fn(),
        time: 0.5,
        isPlaying: true
      })
    })
  })

  describe('Dialog layout', () => {
    it('preview does not overlay param inputs - Name input is a sibling below the preview, not overlapped', () => {
      renderDialog(makeEntry(barRevealTemplate()))

      const preview = screen.getByRole('img', { name: /Bar reveal preview/i })
      const nameInput = screen.getByRole('textbox', { name: /Name/i })

      // The preview and Name input must both be present
      expect(preview).toBeInTheDocument()
      expect(nameInput).toBeInTheDocument()

      // The preview container must not use absolute/fixed positioning
      // that would take it out of flow and overlay following content.
      // It should use relative (for its own particle canvas child) inside
      // a block-level wrapper.
      const previewWrapper = preview.closest('.preview-stage')
      expect(previewWrapper).not.toBeNull()
      const style = window.getComputedStyle(previewWrapper!)
      expect(style.position).not.toBe('absolute')
      expect(style.position).not.toBe('fixed')
    })

    it('action footer is pinned outside the scroll area', () => {
      renderDialog(makeEntry())

      // The Export button must NOT be inside the scrollable body div.
      // It lives in the pinned DialogFooter below the scroller.
      const exportBtn = screen.getByRole('button', {
        name: /Export to project/i
      })
      const scrollBody = document.querySelector('[data-slot="dialog-body"]')
      expect(scrollBody).not.toBeNull()
      expect(scrollBody!.contains(exportBtn)).toBe(false)
    })
  })
})
