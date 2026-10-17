import { describe, expect, it } from 'vitest'
import type { GroupLayer, ParticlesLayer, RectLayer, TextLayer } from '../types'
import { hasParticles } from './layers'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rect: RectLayer = {
  id: 'r1',
  kind: 'rect',
  width: 100,
  height: 50,
  fill: '#ff0000',
  radius: 0,
  anchor: { x: 0, y: 0 }
}

const text: TextLayer = {
  id: 't1',
  kind: 'text',
  text: 'hello',
  font: { family: 'Arial', style: 'normal', size: 24 },
  align: 'left',
  lineHeight: 1.2,
  multiline: false,
  fill: '#000000',
  anchor: { x: 0, y: 0 }
}

const particles: ParticlesLayer = {
  id: 'p1',
  kind: 'particles',
  points: [{ x: 10, y: 20 }],
  seed: 42,
  assembleStart: 0,
  assembleEnd: 1,
  baseFill: '#ffffff',
  regionFills: {},
  pointRadius: 3,
  anchor: { x: 0, y: 0 }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hasParticles', () => {
  it('returns false for an empty layer list', () => {
    expect(hasParticles([])).toBe(false)
  })

  it('returns false when no particles layer exists', () => {
    expect(hasParticles([rect, text])).toBe(false)
  })

  it('returns true for a top-level particles layer', () => {
    expect(hasParticles([rect, particles])).toBe(true)
  })

  it('returns true for a particles layer nested in a group', () => {
    const group: GroupLayer = {
      id: 'g1',
      kind: 'group',
      children: [rect, particles],
      anchor: { x: 0, y: 0 }
    }
    expect(hasParticles([group])).toBe(true)
  })

  it('returns true for a particles layer nested two groups deep', () => {
    const inner: GroupLayer = {
      id: 'g-inner',
      kind: 'group',
      children: [particles],
      anchor: { x: 0, y: 0 }
    }
    const outer: GroupLayer = {
      id: 'g-outer',
      kind: 'group',
      children: [rect, inner],
      anchor: { x: 0, y: 0 }
    }
    expect(hasParticles([outer])).toBe(true)
  })

  it('returns false for groups that contain only non-particle layers', () => {
    const group: GroupLayer = {
      id: 'g1',
      kind: 'group',
      children: [rect, text],
      anchor: { x: 0, y: 0 }
    }
    expect(hasParticles([group])).toBe(false)
  })
})
