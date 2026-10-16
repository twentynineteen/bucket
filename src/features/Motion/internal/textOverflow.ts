/**
 * Text overflow detection (issue #337)
 *
 * Pure function that checks whether a text layer's content exceeds its box
 * width. The measurer is injected so tests can provide a stub.
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  layers: Array<{
    kind: string
    id: string
    text: string
    font: { family: string; size: number }
    width?: number
  }>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  measurer: TextMeasurer
): OverflowResult[] {
  throw new Error('not implemented')
}
