/**
 * TemplateCard tests (issue #336).
 *
 * Behaviours: G1.2 (name, category chip, target icons),
 * G1.3 (Experimental, Default, Library markers),
 * G1.4 (particle-only card shows Video and Claude prompt only),
 * G1.6 (card contains MotionPreview with role img).
 */
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CatalogueEntry, MotionCategory, MotionFormat, ParamValues } from '../types'

// Mock the api module for font loading and Tauri calls
vi.mock('../api', () => ({
  motionFontAvailable: vi.fn().mockResolvedValue(false),
  readMotionFont: vi.fn().mockResolvedValue(new Uint8Array()),
  readMotionPrefsText: vi.fn().mockResolvedValue(null),
  writeMotionPrefsText: vi.fn().mockResolvedValue(undefined),
  listFolder: vi.fn().mockResolvedValue([]),
  readText: vi.fn().mockResolvedValue('{}')
}))

// Mock the ticker to avoid rAF subscriptions in tests
vi.mock('../internal/ticker', () => ({
  subscribe: vi.fn(() => () => {}),
  getTicker: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    pause: vi.fn(),
    resume: vi.fn()
  }))
}))

// Set test clock so preview renders at a fixed time
beforeAll(() => {
  ;(window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.5
})
afterAll(() => {
  delete (window as unknown as Record<string, unknown>).__BUCKET_MOTION_CLOCK__
})

// ---------------------------------------------------------------------------
// Lazy import TemplateCard (not yet written, will fail)
// ---------------------------------------------------------------------------

type TemplateCardModule = typeof import('./TemplateCard')
let TemplateCard: TemplateCardModule['default']

beforeAll(async () => {
  const mod = await import('./TemplateCard')
  TemplateCard = mod.default
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  id: string,
  overrides?: Partial<{
    name: string
    category: MotionCategory
    status: 'stable' | 'experimental'
    source: 'builtin' | 'library'
    hasParticles: boolean
  }>
): CatalogueEntry {
  const layers = overrides?.hasParticles
    ? [
        {
          kind: 'particles' as const,
          id: 'p',
          anchor: { x: 0, y: 0 },
          points: [{ x: 100, y: 200 }],
          seed: 1,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4
        }
      ]
    : [
        {
          kind: 'rect' as const,
          id: 'bg',
          anchor: { x: 0, y: 0 },
          width: 100,
          height: 100,
          fill: '#fff',
          radius: 0
        }
      ]

  return {
    template: {
      schemaVersion: 1,
      id,
      version: '1.0.0',
      name: overrides?.name ?? id.replace(/-/g, ' '),
      description: `Description for ${id}`,
      category: overrides?.category ?? 'lower-third',
      status: overrides?.status ?? 'stable',
      tags: [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers
    },
    source: overrides?.source ?? 'builtin'
  }
}

const defaultFormat: MotionFormat = { width: 3840, height: 2160, fps: 50 }
const defaultValues: ParamValues = {}

function renderCard(
  entry: CatalogueEntry,
  props?: {
    isFavourite?: boolean
    isDefault?: boolean
    onToggleFavourite?: () => void
    onSelect?: () => void
    time?: number | null
  }
) {
  return render(
    <TemplateCard
      entry={entry}
      format={defaultFormat}
      values={defaultValues}
      isFavourite={props?.isFavourite ?? false}
      isDefault={props?.isDefault ?? false}
      onToggleFavourite={props?.onToggleFavourite ?? (() => {})}
      onSelect={props?.onSelect ?? (() => {})}
      time={props?.time ?? 0.5}
    />
  )
}

// ---------------------------------------------------------------------------
// G1.2 - Card shows name, category chip and target icons
// ---------------------------------------------------------------------------

describe('G1.2 TemplateCard content', () => {
  it('shows the template name', () => {
    const e = makeEntry('quote-card', { name: 'Quote card' })
    renderCard(e)
    expect(screen.getByText('Quote card')).toBeInTheDocument()
  })

  it('shows a category chip with the category label', () => {
    const e = makeEntry('score-ring', {
      name: 'Score ring',
      category: 'data'
    })
    renderCard(e)
    expect(screen.getByText('Data')).toBeInTheDocument()
  })

  it('shows target icons with accessible names for non-particle templates', () => {
    const e = makeEntry('glide', { name: 'Glide' })
    renderCard(e)

    // Non-particle templates get all five targets
    expect(screen.getByLabelText('After Effects')).toBeInTheDocument()
    expect(screen.getByLabelText('DaVinci Resolve')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Premiere (mogrt via After Effects)')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Video')).toBeInTheDocument()
    expect(screen.getByLabelText('Claude prompt')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G1.3 - Experimental, Default and Library markers
// ---------------------------------------------------------------------------

describe('G1.3 TemplateCard markers', () => {
  it('shows "Experimental" for status experimental', () => {
    const e = makeEntry('stat-reveal', {
      name: 'Stat reveal',
      status: 'experimental'
    })
    renderCard(e)
    expect(screen.getByText('Experimental')).toBeInTheDocument()
  })

  it('shows "Default" when isDefault is true', () => {
    const e = makeEntry('glide', { name: 'Glide' })
    renderCard(e, { isDefault: true })
    expect(screen.getByText('Default')).toBeInTheDocument()
  })

  it('shows "Library" for source library', () => {
    const e = makeEntry('custom-lt', { name: 'Custom LT', source: 'library' })
    renderCard(e)
    expect(screen.getByText('Library')).toBeInTheDocument()
  })

  it('shows no markers for a stable built-in non-default card', () => {
    const e = makeEntry('bar-reveal', { name: 'Bar reveal' })
    renderCard(e, { isDefault: false })
    expect(screen.queryByText('Experimental')).not.toBeInTheDocument()
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
    expect(screen.queryByText('Library')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G1.4 - Particle template shows video and Claude prompt only
// ---------------------------------------------------------------------------

describe('G1.4 TemplateCard particle targets', () => {
  it('shows only Video and Claude prompt icons for a particle template', () => {
    const e = makeEntry('spread-map', {
      name: 'Spread map',
      category: 'data',
      hasParticles: true
    })
    renderCard(e)

    expect(screen.getByLabelText('Video')).toBeInTheDocument()
    expect(screen.getByLabelText('Claude prompt')).toBeInTheDocument()
    expect(screen.queryByLabelText('After Effects')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('DaVinci Resolve')).not.toBeInTheDocument()
  })

  it('shows "Video and Claude prompt only" text', () => {
    const e = makeEntry('spread-map', {
      name: 'Spread map',
      category: 'data',
      hasParticles: true
    })
    renderCard(e)
    expect(screen.getByText('Video and Claude prompt only')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// G1.6 - Card contains MotionPreview with role img
// ---------------------------------------------------------------------------

describe('G1.6 TemplateCard preview', () => {
  it('contains a MotionPreview with role img and accessible name', () => {
    const e = makeEntry('glide', { name: 'Glide' })
    renderCard(e)
    expect(screen.getByRole('img', { name: 'Glide preview' })).toBeInTheDocument()
  })

  it('wraps the preview in a dark stage with a fixed dark background', () => {
    const e = makeEntry('glide', { name: 'Glide' })
    const { container } = renderCard(e)
    const stage = container.querySelector('.preview-stage') as HTMLElement
    expect(stage).not.toBeNull()
    // The stage has a hard-coded dark background, not theme tokens
    const bg = stage.style.backgroundColor
    expect(bg === '#1c1c1c' || bg === 'rgb(28, 28, 28)').toBe(true)
  })
})
