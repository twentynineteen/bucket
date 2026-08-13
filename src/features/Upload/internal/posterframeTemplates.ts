/**
 * Posterframe template registry and layout resolution (issue #189).
 *
 * Two templates exist while the rebrand transition runs: Classic (the
 * pre-2026 branding) and Rebrand. Each declares its text layout at the
 * resolution its backgrounds are authored at; every value scales by one
 * uniform factor (imageHeight / referenceHeight) so word-wrap decisions are
 * identical at any resolution.
 */

export type PosterframeTemplateId = 'classic' | 'rebrand'

export interface PosterframeTemplate {
  id: PosterframeTemplateId
  label: string
  reference: { width: number; height: number }
  /** Left edge and width of the text box, px at reference resolution. */
  box: { x: number; width: number }
  /**
   * Vertical anchor. Classic predates the box-top convention: its 467px value
   * IS the first-line baseline, and changing how it is derived would move
   * every Classic thumbnail. The Rebrand value comes straight from the design
   * file's text box, whose top is what the PSD records.
   */
  anchor: { firstBaselineY: number } | { boxTopY: number }
  fontSize: number
  lineHeight: number
  letterSpacing: number
}

export const POSTERFRAME_TEMPLATES: Record<PosterframeTemplateId, PosterframeTemplate> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    // The production classic backgrounds are 1920x1080; the pre-template code
    // drew these coordinates unscaled onto them, so 1080p is the size at
    // which output must stay pixel-identical. (An earlier 1280x720 assumption
    // shipped text at 1.5x on every real background - #189 field report.)
    reference: { width: 1920, height: 1080 },
    box: { x: 292, width: 380 },
    anchor: { firstBaselineY: 467 },
    fontSize: 37,
    lineHeight: 45,
    letterSpacing: 1.5
  },
  rebrand: {
    id: 'rebrand',
    label: 'Rebrand',
    reference: { width: 1920, height: 1080 },
    box: { x: 96, width: 457 },
    anchor: { boxTopY: 424 },
    fontSize: 40,
    lineHeight: 48,
    // Photoshop tracking 7 = 7/1000 em at 40px.
    letterSpacing: 0.28
  }
}

export const POSTERFRAME_TEMPLATE_IDS = Object.keys(
  POSTERFRAME_TEMPLATES
) as PosterframeTemplateId[]

/** Both surfaces remember the last-used template under this one key. */
export const POSTERFRAME_TEMPLATE_STORAGE_KEY = 'posterframe-template'

/** The subset of opentype.js font metrics the vertical anchor maths needs. */
export interface FontVerticalMetrics {
  ascender: number
  unitsPerEm: number
}

export interface ResolvedPosterframeLayout {
  x: number
  firstBaselineY: number
  boxTopY: number
  maxWidth: number
  fontSize: number
  lineHeight: number
  letterSpacing: number
}

/**
 * Resolves a template's layout for an actual image. One uniform scale factor
 * for every value: scaling x by width but sizes by height would make the
 * wrap point depend on the image's aspect ratio.
 */
export function resolvePosterframeLayout(
  templateId: PosterframeTemplateId,
  imageWidth: number,
  imageHeight: number,
  metrics: FontVerticalMetrics
): ResolvedPosterframeLayout {
  const template = POSTERFRAME_TEMPLATES[templateId]
  const scale = imageHeight / template.reference.height

  const fontSize = template.fontSize * scale
  const ascent = (metrics.ascender / metrics.unitsPerEm) * fontSize

  let firstBaselineY: number
  let boxTopY: number
  if ('firstBaselineY' in template.anchor) {
    firstBaselineY = template.anchor.firstBaselineY * scale
    boxTopY = firstBaselineY - ascent
  } else {
    boxTopY = template.anchor.boxTopY * scale
    firstBaselineY = boxTopY + ascent
  }

  return {
    x: template.box.x * scale,
    firstBaselineY,
    boxTopY,
    maxWidth: template.box.width * scale,
    fontSize,
    lineHeight: template.lineHeight * scale,
    letterSpacing: template.letterSpacing * scale
  }
}

/** The glyph-measuring subset of an opentype.js Font. */
export interface WrapFont {
  unitsPerEm: number
  stringToGlyphs: (text: string) => { advanceWidth: number }[]
}

/**
 * Word-wraps a title into lines for the given layout.
 *
 * This reproduces the algorithm the canvas hook has always used, quirks
 * included: the candidate line is measured WITH its trailing space, and
 * letterSpacing is added once per glyph. Changing either would shift line
 * breaks on every existing Classic thumbnail. There is deliberately no line
 * cap - long titles grow past the design's box height (issue #189 B1.5).
 */
export function wrapPosterframeTitle(
  font: WrapFont,
  title: string,
  layout: Pick<ResolvedPosterframeLayout, 'fontSize' | 'letterSpacing' | 'maxWidth'>
): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of title.split(' ')) {
    const testLine = line + word + ' '
    const glyphs = font.stringToGlyphs(testLine)
    let widthPx = 0
    for (const glyph of glyphs) {
      widthPx +=
        glyph.advanceWidth * (layout.fontSize / font.unitsPerEm) + layout.letterSpacing
    }
    if (widthPx > layout.maxWidth && line) {
      lines.push(line.trim())
      line = word + ' '
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line.trim())

  return lines
}

/**
 * Tolerance for calling a background 16:9. Covers exports a pixel or two off
 * from rounding without waving through genuinely different shapes.
 */
const ASPECT_TOLERANCE = 0.01
const SIXTEEN_NINE = 16 / 9

/** True when a background's shape would visibly misplace the text layout. */
export function isOffAspectBackground(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return true
  return Math.abs(width / height - SIXTEEN_NINE) / SIXTEEN_NINE > ASPECT_TOLERANCE
}

/**
 * Which template a surface starts on: an explicit stored choice wins, else
 * Rebrand once its folder is configured, else Classic. The fallback exists so
 * updating the app never strands a working Classic setup on an unconfigured
 * Rebrand template (issue #189 B3.5).
 */
export function resolveInitialTemplate(
  stored: string | null,
  rebrandFolderConfigured: boolean
): PosterframeTemplateId {
  if (stored === 'classic' || stored === 'rebrand') return stored
  return rebrandFolderConfigured ? 'rebrand' : 'classic'
}
