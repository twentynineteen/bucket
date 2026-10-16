/**
 * README exporter tests (issue #331)
 *
 * PR3.1: sections per selected target
 * PR3.2: mogrt-via-ae explains write-files preference and mogrt output
 * PR3.3: fonts section for built-in text templates
 * PR3.4: credits section from template credits
 * PR3.5: Premiere section describes both routes or video only
 * PR3.6: video target states codec, resolution and fps
 * PR3.7: exporter notes section, and image param source.png note
 */
import { describe, expect, it } from 'vitest'
import type { ExportInput, MotionFormat, MotionTemplate, ParamValues } from '../../types'
import { resolveTemplate } from '../resolve'
import { particlesFixture, textFixture } from '../testing/fixtures'
import { generateReadme } from './readme'

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

// ---------------------------------------------------------------------------
// PR3.1 - target sections
// ---------------------------------------------------------------------------

describe('PR3.1 target sections', () => {
  it('ae and resolve selected - has both install sections', () => {
    const input = makeInput(textFixture, {}, undefined, {
      targets: ['ae', 'resolve']
    })
    const md = generateReadme(input)

    // AE section
    expect(md).toMatch(/after\s*effects/i)
    expect(md).toMatch(/File\s*>\s*Scripts?\s*>\s*Run\s*Script/i)

    // Resolve section
    expect(md).toMatch(/resolve/i)
    expect(md).toMatch(/\.setting/i)
    // macOS path
    expect(md).toMatch(/Library/i)
    // Windows path
    expect(md).toMatch(/ProgramData|AppData/i)
  })

  it('unselected targets have no section', () => {
    const input = makeInput(textFixture, {}, undefined, {
      targets: ['ae']
    })
    const md = generateReadme(input)

    expect(md).toMatch(/after\s*effects/i)
    // Should not have a Resolve install section
    expect(md).not.toMatch(/\.setting/i)
  })
})

// ---------------------------------------------------------------------------
// PR3.2 - mogrt-via-ae
// ---------------------------------------------------------------------------

describe('PR3.2 mogrt-via-ae', () => {
  it('explains write-files preference and mogrt output', () => {
    const input = makeInput(textFixture, {}, undefined, {
      targets: ['mogrt-via-ae'],
      mogrt: true
    })
    const md = generateReadme(input)

    expect(md).toMatch(/Allow\s*Scripts?\s*to\s*Write\s*Files/i)
    expect(md).toMatch(/\.mogrt/i)
  })
})

// ---------------------------------------------------------------------------
// PR3.3 - fonts section
// ---------------------------------------------------------------------------

describe('PR3.3 fonts section', () => {
  it('lists Cabrito and describes AE fallback', () => {
    const input = makeInput(textFixture)
    const md = generateReadme(input)

    expect(md).toMatch(/Cabrito\s*Semi\s*Norm\s*Bold/i)
    expect(md).toMatch(/Arial/i)
  })
})

// ---------------------------------------------------------------------------
// PR3.4 - credits section
// ---------------------------------------------------------------------------

describe('PR3.4 credits section', () => {
  it('lists credits when template has them', () => {
    const withCredits: MotionTemplate = {
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
      withCredits,
      {},
      { width: 3840, height: 2160, fps: 50 }
    )
    const input: ExportInput = {
      template: withCredits,
      values: {},
      format: { width: 3840, height: 2160, fps: 50 },
      resolved,
      targets: ['video', 'prompt'],
      mogrt: false
    }
    const md = generateReadme(input)

    expect(md).toMatch(/credits/i)
    expect(md).toContain('Runner silhouette')
    expect(md).toContain('J. Smith')
    expect(md).toContain('https://example.com/photo')
    expect(md).toContain('CC0')
  })

  it('no credits section when template has none', () => {
    const input = makeInput(textFixture)
    const md = generateReadme(input)

    expect(md).not.toMatch(/^#{1,3}\s+Credits/im)
  })
})

// ---------------------------------------------------------------------------
// PR3.5 - Premiere section
// ---------------------------------------------------------------------------

describe('PR3.5 Premiere section', () => {
  it('non-particle: describes mogrt and video routes', () => {
    const input = makeInput(textFixture)
    const md = generateReadme(input)

    expect(md).toMatch(/premiere/i)
    expect(md).toMatch(/\.mogrt/i)
    expect(md).toMatch(/\.mov/i)
  })

  it('particle template: describes only the video route', () => {
    const resolved = resolveTemplate(
      particlesFixture,
      {},
      { width: 3840, height: 2160, fps: 50 }
    )
    const input: ExportInput = {
      template: particlesFixture,
      values: {},
      format: { width: 3840, height: 2160, fps: 50 },
      resolved,
      targets: ['video', 'prompt'],
      mogrt: false
    }
    const md = generateReadme(input)

    expect(md).toMatch(/premiere/i)
    expect(md).toMatch(/\.mov/i)
    // Should not mention mogrt route for particles
    expect(md).not.toMatch(/\.mogrt/i)
  })
})

// ---------------------------------------------------------------------------
// PR3.6 - video target details
// ---------------------------------------------------------------------------

describe('PR3.6 video target details', () => {
  it('states codec, resolution and fps', () => {
    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(textFixture, {}, format, {
      targets: ['video']
    })
    const md = generateReadme(input)

    expect(md).toMatch(/ProRes\s*4444/i)
    expect(md).toMatch(/alpha/i)
    expect(md).toContain('1920')
    expect(md).toContain('1080')
    expect(md).toMatch(/25\s*fps/i)
  })
})

// ---------------------------------------------------------------------------
// PR3.7 - notes section and image param
// ---------------------------------------------------------------------------

describe('PR3.7 notes and image param', () => {
  it('lists exporter notes when present', () => {
    const input = makeInput(textFixture, {}, undefined, {
      targets: ['resolve']
    })
    const notes = ['Follower delay rounded to 1 frame minimum']
    const md = generateReadme(input, notes)

    expect(md).toMatch(/notes/i)
    expect(md).toContain('Follower delay rounded to 1 frame minimum')
  })

  it('no notes section when empty', () => {
    const input = makeInput(textFixture)
    const md = generateReadme(input, [])

    expect(md).not.toMatch(/^#{1,3}\s+Notes/im)
  })

  it('image param notes about source.png and seed', () => {
    const resolved = resolveTemplate(
      particlesFixture,
      { image: { pickedPath: '/Users/test/photo.png' } },
      { width: 3840, height: 2160, fps: 50 }
    )
    const input: ExportInput = {
      template: particlesFixture,
      values: { image: { pickedPath: '/Users/test/photo.png' } },
      format: { width: 3840, height: 2160, fps: 50 },
      resolved,
      targets: ['video', 'prompt'],
      mogrt: false
    }
    const md = generateReadme(input)

    expect(md).toMatch(/source\.png/)
    expect(md).toMatch(/seed/i)
  })
})
