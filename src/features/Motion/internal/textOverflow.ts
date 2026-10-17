/**
 * Text overflow detection (issue #337)
 *
 * Pure function that checks whether a text layer's content exceeds its box
 * width. The measurer is injected so tests can provide a stub without
 * needing a real canvas or font.
 */

export interface TextMeasurer {
  measure(text: string, font: { family: string; size: number }): number
}

export interface OverflowResult {
  layerId: string
  overflowing: boolean
  measuredWidth: number
  boxWidth: number
}

/**
 * Check whether any text layer in the resolved template overflows.
 * Returns one result per text layer that has a `width` property.
 */
export function checkTextOverflow(
  layers: Array<{
    kind: string
    id: string
    text: string
    font: { family: string; size: number }
    width?: number
  }>,
  measurer: TextMeasurer
): OverflowResult[] {
  const results: OverflowResult[] = []

  for (const layer of layers) {
    if (layer.kind !== 'text') continue
    if (layer.width == null) continue

    // Measure the widest \n-separated line, not the whole string.
    // Wrapped or multiline text would show a false overflow if the whole
    // string were measured as one run.
    const lines = layer.text.split('\n')
    let widest = 0
    for (const line of lines) {
      const w = measurer.measure(line, layer.font)
      if (w > widest) widest = w
    }
    const measuredWidth = widest
    results.push({
      layerId: layer.id,
      overflowing: measuredWidth > layer.width,
      measuredWidth,
      boxWidth: layer.width
    })
  }

  return results
}

/**
 * Create a measurer that uses canvas.measureText with the template font.
 *
 * The font must already be loaded via document.fonts (useMotionFont registers
 * Cabrito Semi as a FontFace). When the canvas or font is unavailable (jsdom,
 * or before the font finishes loading), falls back to an approximation:
 * `length * fontSize * 0.6`, which is a coarse estimate tuned to monospaced-ish
 * bold fonts. The injected-measurer seam in checkTextOverflow lets unit tests
 * bypass this entirely.
 */
export function createCanvasMeasurer(): TextMeasurer {
  // Try to get a 2D canvas context. jsdom doesn't implement getContext, so
  // this returns null in the test environment.
  let ctx: CanvasRenderingContext2D | null = null
  try {
    const canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
  } catch {
    // No canvas available
  }

  return {
    measure(text: string, font: { family: string; size: number }): number {
      if (ctx) {
        ctx.font = `${font.size}px "${font.family}"`
        return ctx.measureText(text).width
      }
      // Fallback: coarse approximation when no canvas is available.
      // 0.6 is a rough average width-to-em ratio for a bold sans font.
      return text.length * font.size * 0.6
    }
  }
}
