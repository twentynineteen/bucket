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
export function staggerLineBreaks(_units: StaggerUnit[]): number[] {
  throw new Error('not implemented')
}
