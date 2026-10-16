/**
 * Claude prompt exporter tests (issue #331)
 *
 * PR1.3: backtick-containing text param does not break the markdown fence
 * PR2.1: all sections present in order
 * PR2.2: embeds unexpanded template and values separately, both parseable
 * PR2.3: timing section states in/hold/out durations in seconds and frames
 * PR2.4: format section states resolution, fps and transparency
 * PR2.5: constraints section has per-target subsections
 * PR2.6: no local file paths, no references to other exported files
 * PR2.7: deterministic output (no timestamps)
 * PR2.8: particle template has no point list, has summary instead
 */
import { describe, expect, it } from 'vitest'
import type { ExportInput, MotionFormat, MotionTemplate, ParamValues } from '../../types'
import { resolveTemplate } from '../resolve'
import { holdParamFixture, particlesFixture, textFixture } from '../testing/fixtures'
import { generatePrompt } from './prompt'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
  template: MotionTemplate,
  values: ParamValues = {},
  format: MotionFormat = { width: 3840, height: 2160, fps: 50 },
  overrides?: Partial<ExportInput>
): ExportInput {
  const resolved = resolveTemplate(template, values, format)
  return {
    template,
    values,
    format,
    resolved,
    targets: ['ae', 'resolve', 'mogrt-via-ae', 'video', 'prompt'],
    mogrt: false,
    ...overrides
  }
}

function makeParticleInput(
  values: ParamValues = {},
  format: MotionFormat = { width: 3840, height: 2160, fps: 50 }
): ExportInput {
  const resolved = resolveTemplate(particlesFixture, values, format)
  return {
    template: particlesFixture,
    values,
    format,
    resolved,
    targets: ['video', 'prompt'],
    mogrt: false
  }
}

// ---------------------------------------------------------------------------
// PR1.3 - backtick safety in rendered markdown
// ---------------------------------------------------------------------------

describe('PR1.3 fence safety with react-markdown', () => {
  it('template JSON with triple backticks renders as a single code element', async () => {
    // Template with text param value containing triple backticks
    const template: MotionTemplate = {
      ...textFixture,
      id: 'backtick-test',
      name: 'Backtick test',
      description: 'Template for testing ```backtick``` safety'
    }
    const input = makeInput(template, { name: 'Hello ```world```' })
    const md = generatePrompt(input)

    // Use react-markdown in jsdom to parse
    const React = await import('react')
    const { render } = await import('@testing-library/react')
    const ReactMarkdown = (await import('react-markdown')).default

    const { container } = render(React.createElement(ReactMarkdown, null, md))

    // Find all code blocks (pre > code) - the template JSON fence must be intact
    const codeBlocks = container.querySelectorAll('pre code')
    expect(codeBlocks.length).toBeGreaterThan(0)

    // Find the code block that contains the template JSON
    let foundTemplateJson = false
    codeBlocks.forEach(block => {
      const text = block.textContent ?? ''
      try {
        const parsed = JSON.parse(text)
        if (parsed.schemaVersion === 1) {
          foundTemplateJson = true
          // The parsed JSON must deep-equal the template
          expect(parsed).toEqual(template)
        }
      } catch {
        // Not JSON, skip
      }
    })
    expect(foundTemplateJson).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PR2.1 - section order
// ---------------------------------------------------------------------------

describe('PR2.1 section order', () => {
  it('contains all five sections in order', () => {
    const input = makeInput(textFixture, { name: 'Jane Doe' })
    const md = generatePrompt(input)

    // Each section under its own heading
    const headingPattern = /^#{1,3}\s+(.+)$/gm
    const headings: string[] = []
    let match: RegExpExecArray | null
    while ((match = headingPattern.exec(md)) !== null) {
      headings.push(match[1].toLowerCase())
    }

    // Find indices of the required section headings
    const intentIdx = headings.findIndex(
      h => h.includes('intent') || h.includes(textFixture.name.toLowerCase())
    )
    const templateIdx = headings.findIndex(h => h.includes('template'))
    const timingIdx = headings.findIndex(
      h => h.includes('timing') || h.includes('easing')
    )
    const formatIdx = headings.findIndex(h => h.includes('format'))
    const constraintsIdx = headings.findIndex(h => h.includes('constraint'))

    expect(intentIdx).toBeGreaterThanOrEqual(0)
    expect(templateIdx).toBeGreaterThanOrEqual(0)
    expect(timingIdx).toBeGreaterThanOrEqual(0)
    expect(formatIdx).toBeGreaterThanOrEqual(0)
    expect(constraintsIdx).toBeGreaterThanOrEqual(0)

    // Order: intent < template < timing < format < constraints
    expect(intentIdx).toBeLessThan(templateIdx)
    expect(templateIdx).toBeLessThan(timingIdx)
    expect(timingIdx).toBeLessThan(formatIdx)
    expect(formatIdx).toBeLessThan(constraintsIdx)
  })
})

// ---------------------------------------------------------------------------
// PR2.2 - unexpanded template JSON and separate values
// ---------------------------------------------------------------------------

describe('PR2.2 unexpanded template and values', () => {
  it('embeds the original template and values as parseable JSON', () => {
    const values: ParamValues = { name: 'Jane Doe' }
    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(textFixture, values, format)
    const md = generatePrompt(input)

    // Extract all JSON code blocks
    const jsonBlocks: string[] = []
    const fencePattern = /(`{3,})json\n([\s\S]*?)\n\1/g
    let m: RegExpExecArray | null
    while ((m = fencePattern.exec(md)) !== null) {
      jsonBlocks.push(m[2])
    }

    // Should have at least two JSON blocks: template and values
    expect(jsonBlocks.length).toBeGreaterThanOrEqual(2)

    // Find the template block (has schemaVersion)
    const templateBlock = jsonBlocks.find(b => {
      try {
        return JSON.parse(b).schemaVersion === 1
      } catch {
        return false
      }
    })
    expect(templateBlock).toBeDefined()
    const parsedTemplate = JSON.parse(templateBlock!)
    // Must be the unexpanded original (macro layers intact)
    expect(parsedTemplate).toEqual(textFixture)

    // Find the values block
    const valuesBlock = jsonBlocks.find(b => {
      try {
        const parsed = JSON.parse(b)
        return parsed.name !== undefined && !parsed.schemaVersion
      } catch {
        return false
      }
    })
    expect(valuesBlock).toBeDefined()
    expect(JSON.parse(valuesBlock!)).toEqual({ name: 'Jane Doe' })
  })
})

// ---------------------------------------------------------------------------
// PR2.3 - timing section
// ---------------------------------------------------------------------------

describe('PR2.3 timing section', () => {
  it('states in, hold and out durations in seconds and frames', () => {
    const format: MotionFormat = { width: 3840, height: 2160, fps: 25 }
    const values: ParamValues = { hold: 5 }
    const input = makeInput(holdParamFixture, values, format)
    const md = generatePrompt(input)

    // inEnd = 1, hold default = 2, user hold = 5, delta = 3
    // outStart = 3 + 3 = 6, duration = 4 + 3 = 7 (before snap, approximately)
    // in duration: 0 to inEnd = 1s
    // out duration: outStart to duration
    // hold: inEnd to outStart

    // The timing section should mention seconds
    expect(md).toMatch(/\bin[\s-]?duration\b.*\d+(\.\d+)?\s*s/i)

    // Should state frame counts at the chosen fps
    expect(md).toMatch(/\d+\s*frame/i)

    // Should list at least one distinct ease with cubic-bezier values
    expect(md).toMatch(/cubic.?bezier|0\.\d+[,\s]+\d/i)
  })
})

// ---------------------------------------------------------------------------
// PR2.4 - format section
// ---------------------------------------------------------------------------

describe('PR2.4 format section', () => {
  it('states resolution, fps and transparency', () => {
    const format: MotionFormat = { width: 3840, height: 2160, fps: 50 }
    const input = makeInput(textFixture, {}, format)
    const md = generatePrompt(input)

    expect(md).toContain('3840')
    expect(md).toContain('2160')
    expect(md).toMatch(/50\s*fps/i)
    expect(md).toMatch(/transparent/i)
  })
})

// ---------------------------------------------------------------------------
// PR2.5 - constraints section
// ---------------------------------------------------------------------------

describe('PR2.5 constraints section', () => {
  it('non-particle: has AE, Resolve and video subsections plus v1 exclusions', () => {
    const input = makeInput(textFixture)
    const md = generatePrompt(input)

    // After Effects constraints
    expect(md).toMatch(/after\s*effects/i)
    expect(md).toMatch(/ES3/i)
    expect(md).toMatch(/ASCII/i)
    expect(md).toMatch(/\bJSON\b/)
    expect(md).toMatch(/precomp/i)

    // Resolve constraints
    expect(md).toMatch(/resolve/i)
    expect(md).toMatch(/fusion\s*macro/i)
    expect(md).toMatch(/free/i)

    // Video note
    expect(md).toMatch(/ProRes\s*4444/i)
    expect(md).toMatch(/alpha/i)

    // v1 exclusions
    expect(md).toMatch(/blur/i)
    expect(md).toMatch(/glow/i)
    expect(md).toMatch(/3D/i)
    expect(md).toMatch(/mask/i)
    expect(md).toMatch(/expression/i)
  })

  it('particle template: only video note, no AE or Resolve subsections', () => {
    const input = makeParticleInput()
    const md = generatePrompt(input)

    expect(md).toMatch(/ProRes\s*4444/i)

    // Should NOT have detailed AE or Resolve constraint blocks
    // (no ES3, no Fusion macro instructions for authoring)
    expect(md).not.toMatch(/ES3/i)
    expect(md).not.toMatch(/fusion\s*macro/i)
  })
})

// ---------------------------------------------------------------------------
// PR2.6 - self-contained, no local paths
// ---------------------------------------------------------------------------

describe('PR2.6 self-contained', () => {
  it('references no local file path and no other exported file', () => {
    const input = makeInput(textFixture, { name: 'Test' })
    const md = generatePrompt(input)

    // No absolute paths
    expect(md).not.toMatch(/\/Users\//i)
    expect(md).not.toMatch(/\/home\//i)
    expect(md).not.toMatch(/C:\\/i)

    // No references to sibling export files
    expect(md).not.toMatch(/\.jsx\b/)
    expect(md).not.toMatch(/\.setting\b/)
    expect(md).not.toMatch(/\.mov\b/)
    expect(md).not.toMatch(/README\.md/)
    expect(md).not.toMatch(/params\.json/)
  })
})

// ---------------------------------------------------------------------------
// PR2.7 - deterministic
// ---------------------------------------------------------------------------

describe('PR2.7 deterministic output', () => {
  it('same input produces byte-identical output', () => {
    const input = makeInput(textFixture, { name: 'Determinism test' })
    const first = generatePrompt(input)
    const second = generatePrompt(input)
    expect(first).toBe(second)
  })
})

// ---------------------------------------------------------------------------
// PR2.8 - particle template point list replacement
// ---------------------------------------------------------------------------

describe('PR2.8 particle point list replacement', () => {
  it('replaces points with summary in template JSON', () => {
    const input = makeParticleInput()
    const md = generatePrompt(input)

    // Extract the template JSON block
    const fencePattern = /(`{3,})json\n([\s\S]*?)\n\1/g
    let templateJson: Record<string, unknown> | null = null
    let m: RegExpExecArray | null
    while ((m = fencePattern.exec(md)) !== null) {
      try {
        const parsed = JSON.parse(m[2])
        if (parsed.schemaVersion === 1) {
          templateJson = parsed
          break
        }
      } catch {
        // skip
      }
    }
    expect(templateJson).not.toBeNull()

    // Find the particles layer
    const layers = templateJson.layers as Record<string, unknown>[]
    const particlesLayer = layers.find(
      (l: Record<string, unknown>) => l.kind === 'particles'
    )
    expect(particlesLayer).toBeDefined()
    const points = particlesLayer!.points as Record<string, unknown>

    // Points should be replaced with summary
    expect(points).toHaveProperty('count')
    expect(points).toHaveProperty('bounds')
    expect(points).toHaveProperty('regions')
    expect(points).toHaveProperty('seed')
    expect(points.count).toBe(5) // 5 points in the fixture

    // Regions should list region names with counts
    expect(points.regions).toBeDefined()
  })

  it('user-picked image references only source.png, no absolute path', () => {
    const input = makeParticleInput({ image: { pickedPath: '/Users/test/photo.png' } })
    const md = generatePrompt(input)

    expect(md).not.toContain('/Users/test/photo.png')
    expect(md).toMatch(/source\.png/)
  })

  it('built-in image source uses credit title', () => {
    const templateWithCredits: MotionTemplate = {
      ...particlesFixture,
      credits: [
        {
          title: 'Runner silhouette',
          author: 'J. Smith',
          url: 'https://example.com/photo',
          licence: 'CC0'
        }
      ]
    }
    const resolved = resolveTemplate(
      templateWithCredits,
      {},
      { width: 3840, height: 2160, fps: 50 }
    )
    const input: ExportInput = {
      template: templateWithCredits,
      values: {},
      format: { width: 3840, height: 2160, fps: 50 },
      resolved,
      targets: ['video', 'prompt'],
      mogrt: false
    }
    const md = generatePrompt(input)
    expect(md).toMatch(/Runner silhouette/)
  })
})
