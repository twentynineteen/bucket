/**
 * Stagger line-break computation (F1 from review, issue #348)
 *
 * Computes a dy multiplier per stagger unit. A \n unit gets -1 (skip);
 * the next visible unit gets the count of consecutive \n preceding it.
 * Both renderers use this to emit matching x/dy attributes.
 */
import type { StaggerUnit } from '../types'

/**
 * Return the dy multiplier for each unit. Values:
 *  -1: this unit is a \n and should not be rendered
 *   0: normal unit, no line break before it
 *   n > 0: this unit starts n lines below the previous visible unit
 */
export function staggerLineBreaks(units: StaggerUnit[]): number[] {
  const result = new Array<number>(units.length).fill(0)
  let pending = 0

  for (let i = 0; i < units.length; i++) {
    if (units[i].text === '\n') {
      result[i] = -1
      pending++
    } else if (pending > 0) {
      result[i] = pending
      pending = 0
    }
  }

  return result
}
