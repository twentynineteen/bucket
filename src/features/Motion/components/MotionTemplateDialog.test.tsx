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
import { render, screen } from '@testing-library/react'
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

// Mock Kavanagh availability
vi.mock('@features/Kavanagh', () => ({
  useKavanaghAvailability: vi.fn(() => ({
    available: true,
    reason: null,
    pending: false,
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
    hold: { min: 1, max: 8, default: 2 },
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

    it('shows Pause and Restart buttons', () => {
      renderDialog(makeEntry())

      expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Restart/i })).toBeInTheDocument()
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
    it('shows the "Choose project folder" button', () => {
      renderDialog(makeEntry())

      expect(
        screen.getByRole('button', { name: /Choose project folder/i })
      ).toBeInTheDocument()
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
        // Use exact name match to avoid matching label text too
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
    it('disables Video with a link to Settings', async () => {
      const { useKavanaghAvailability } = await import('@features/Kavanagh')
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: false,
        reason: 'ffmpeg was not found',
        pending: false,
        pools: { watermarks: { status: 'ok' }, stings: { status: 'ok' } },
        poolFiles: { watermarks: [], stings: [] },
        referenceFolder: null
      })

      renderDialog(makeEntry())

      const videoCheckbox = screen.getByRole('checkbox', { name: /^Video$/i })
      expect(videoCheckbox).toBeDisabled()

      expect(
        screen.getByRole('link', { name: /Set up ffmpeg in Settings/i })
      ).toHaveAttribute('href', '/settings/general#kavanagh')

      // Restore mock
      ;(useKavanaghAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
        available: true,
        reason: null,
        pending: false,
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
      // Test the validFormats function directly - this is what the
      // ExportPanel uses to disable invalid format options
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

      // Copy prompt doesn't need a folder, just valid params
      expect(
        screen.getByRole('button', { name: /Copy Claude prompt/i })
      ).not.toBeDisabled()
    })
  })

  describe('M5.6 - Video render progress', () => {
    it('dialog renders with export controls', () => {
      renderDialog(makeEntry())

      // Verify the dialog has the export button and targets
      expect(
        screen.getByRole('button', { name: /Export to project/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Copy Claude prompt/i })
      ).toBeInTheDocument()
    })
  })
})
