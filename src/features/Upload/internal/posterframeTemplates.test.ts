/**
 * Tests for the posterframe template registry and layout resolution.
 * Issue #189 (B1.1-B1.5, B3.5, B4.2)
 *
 * Two templates (Classic and Rebrand) each declare their layout at a
 * reference resolution; every value scales by a single uniform factor
 * (imageHeight / referenceHeight) so word-wrap decisions are
 * resolution-invariant.
 */

import { describe, expect, it } from 'vitest'

import {
  POSTERFRAME_TEMPLATES,
  POSTERFRAME_TEMPLATE_STORAGE_KEY,
  isOffAspectBackground,
  resolveInitialTemplate,
  resolvePosterframeLayout,
  wrapPosterframeTitle
} from './posterframeTemplates'

/**
 * Cabrito-shaped metrics: only the ratio matters to the layout maths, so a
 * round 0.8 em ascent keeps expected values readable.
 */
const METRICS = { ascender: 800, unitsPerEm: 1000 }

/**
 * A font whose every glyph advances exactly `advance` units, so wrap
 * behaviour is a pure function of the layout values under test.
 */
function fixedWidthFont(advance = 500, unitsPerEm = 1000) {
  return {
    unitsPerEm,
    stringToGlyphs: (text: string) => Array.from(text, () => ({ advanceWidth: advance }))
  }
}

describe('resolvePosterframeLayout - reference resolutions (#189)', () => {
  it('b1_1_classic_at_1280x720_yields_exactly_todays_values', () => {
    const layout = resolvePosterframeLayout('classic', 1280, 720, METRICS)

    expect(layout.x).toBe(292)
    expect(layout.maxWidth).toBe(380)
    expect(layout.firstBaselineY).toBe(467)
    expect(layout.fontSize).toBe(37)
    expect(layout.lineHeight).toBe(45)
    expect(layout.letterSpacing).toBe(1.5)
  })

  it('b1_2_rebrand_at_1920x1080_matches_the_design_file', () => {
    const layout = resolvePosterframeLayout('rebrand', 1920, 1080, METRICS)

    expect(layout.x).toBe(96)
    expect(layout.maxWidth).toBe(457)
    expect(layout.boxTopY).toBe(424)
    expect(layout.fontSize).toBe(40)
    expect(layout.lineHeight).toBe(48)
    expect(layout.letterSpacing).toBeCloseTo(0.28, 5)
  })

  it('b1_2_rebrand_baseline_is_box_top_plus_the_scaled_font_ascent', () => {
    const layout = resolvePosterframeLayout('rebrand', 1920, 1080, METRICS)

    // 424 + (800 / 1000) * 40
    expect(layout.firstBaselineY).toBeCloseTo(456, 5)
  })
})

describe('resolvePosterframeLayout - uniform scaling (#189)', () => {
  it('b1_3_scales_every_classic_value_by_the_height_ratio', () => {
    const layout = resolvePosterframeLayout('classic', 1920, 1080, METRICS)
    const scale = 1080 / 720

    expect(layout.x).toBeCloseTo(292 * scale, 5)
    expect(layout.maxWidth).toBeCloseTo(380 * scale, 5)
    expect(layout.firstBaselineY).toBeCloseTo(467 * scale, 5)
    expect(layout.fontSize).toBeCloseTo(37 * scale, 5)
    expect(layout.lineHeight).toBeCloseTo(45 * scale, 5)
    expect(layout.letterSpacing).toBeCloseTo(1.5 * scale, 5)
  })

  it('b1_3_scales_every_rebrand_value_by_the_height_ratio', () => {
    const layout = resolvePosterframeLayout('rebrand', 1280, 720, METRICS)
    const scale = 720 / 1080

    expect(layout.x).toBeCloseTo(96 * scale, 5)
    expect(layout.maxWidth).toBeCloseTo(457 * scale, 5)
    expect(layout.boxTopY).toBeCloseTo(424 * scale, 5)
    expect(layout.fontSize).toBeCloseTo(40 * scale, 5)
    expect(layout.lineHeight).toBeCloseTo(48 * scale, 5)
    expect(layout.letterSpacing).toBeCloseTo(0.28 * scale, 5)
  })

  it('b1_3_uses_the_height_ratio_even_when_the_width_ratio_differs', () => {
    // A 4:3 image: width would give x1.0, height gives x1.5. Height must win
    // for both axes, or wrap decisions become resolution-dependent.
    const layout = resolvePosterframeLayout('classic', 1280, 1080, METRICS)

    expect(layout.fontSize).toBeCloseTo(37 * 1.5, 5)
    expect(layout.x).toBeCloseTo(292 * 1.5, 5)
  })
})

describe('wrapPosterframeTitle (#189)', () => {
  it('b1_4_wrap_decisions_are_identical_at_any_resolution', () => {
    const font = fixedWidthFont()
    const title = 'Managing Change Across Complex Organisations Every Term'

    const atReference = resolvePosterframeLayout('rebrand', 1920, 1080, METRICS)
    const atHalf = resolvePosterframeLayout('rebrand', 960, 540, METRICS)
    const atOdd = resolvePosterframeLayout('rebrand', 1366, 768, METRICS)

    const referenceLines = wrapPosterframeTitle(font, title, atReference)

    expect(referenceLines.length).toBeGreaterThan(1)
    expect(wrapPosterframeTitle(font, title, atHalf)).toEqual(referenceLines)
    expect(wrapPosterframeTitle(font, title, atOdd)).toEqual(referenceLines)
  })

  it('b1_4_preserves_the_current_wrap_algorithm_for_classic', () => {
    // The existing algorithm measures the candidate line WITH its trailing
    // space and adds letterSpacing per glyph. Reproduce a known wrap from
    // those rules so a "tidier" rewrite that shifts Classic line breaks fails.
    const font = fixedWidthFont(400)
    const layout = resolvePosterframeLayout('classic', 1280, 720, METRICS)
    // glyph width = 400/1000 * 37 = 14.8px + 1.5 spacing = 16.3px per glyph.
    // 'Strategic Thinking ' = 19 glyphs = 309.7px (fits 380);
    // 'Strategic Thinking Now ' = 23 glyphs = 374.9px (still fits);
    // adding 'Please ' pushes past 380 and wraps.
    const lines = wrapPosterframeTitle(font, 'Strategic Thinking Now Please', layout)

    expect(lines).toEqual(['Strategic Thinking Now', 'Please'])
  })

  it('b1_5_never_caps_the_line_count_at_the_design_box_height', () => {
    const font = fixedWidthFont(900)
    const layout = resolvePosterframeLayout('rebrand', 1920, 1080, METRICS)

    const lines = wrapPosterframeTitle(
      font,
      'One Two Three Four Five Six Seven Eight Nine Ten',
      layout
    )

    // Far more lines than the 189px design box holds - all of them kept.
    expect(lines.length).toBeGreaterThan(4)
    expect(lines.join(' ')).toBe('One Two Three Four Five Six Seven Eight Nine Ten')
  })
})

describe('isOffAspectBackground (#189)', () => {
  it('b4_2_accepts_16_9_backgrounds_at_any_size', () => {
    expect(isOffAspectBackground(1920, 1080)).toBe(false)
    expect(isOffAspectBackground(1280, 720)).toBe(false)
    expect(isOffAspectBackground(640, 360)).toBe(false)
  })

  it('b4_2_tolerates_a_rounding_sized_deviation', () => {
    // Within ~1% of 16:9, e.g. an export a couple of pixels off.
    expect(isOffAspectBackground(1920, 1082)).toBe(false)
  })

  it('b4_2_flags_genuinely_off_aspect_backgrounds', () => {
    expect(isOffAspectBackground(1440, 1080)).toBe(true) // 4:3
    expect(isOffAspectBackground(1080, 1080)).toBe(true) // square
    expect(isOffAspectBackground(1600, 1080)).toBe(true)
  })
})

describe('resolveInitialTemplate (#189)', () => {
  it('b3_4_honours_a_stored_choice_regardless_of_configuration', () => {
    expect(resolveInitialTemplate('classic', true)).toBe('classic')
    expect(resolveInitialTemplate('rebrand', false)).toBe('rebrand')
  })

  it('b3_5_defaults_to_rebrand_only_when_its_folder_is_configured', () => {
    expect(resolveInitialTemplate(null, true)).toBe('rebrand')
    expect(resolveInitialTemplate(null, false)).toBe('classic')
  })

  it('b3_5_treats_an_unrecognised_stored_value_like_no_stored_value', () => {
    expect(resolveInitialTemplate('garbage', true)).toBe('rebrand')
    expect(resolveInitialTemplate('garbage', false)).toBe('classic')
  })
})

describe('template registry (#189)', () => {
  it('labels_the_templates_classic_and_rebrand', () => {
    expect(POSTERFRAME_TEMPLATES.classic.label).toBe('Classic')
    expect(POSTERFRAME_TEMPLATES.rebrand.label).toBe('Rebrand')
  })

  it('b3_4_shares_one_storage_key_between_surfaces', () => {
    expect(POSTERFRAME_TEMPLATE_STORAGE_KEY).toBe('posterframe-template')
  })
})
