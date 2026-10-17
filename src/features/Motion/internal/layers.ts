/**
 * Layer utilities (refactored from duplicated walkers in schema, resolve,
 * readme, prompt and generateSetting).
 */
import type { Layer } from '../types'

/**
 * Check whether the template contains a particles layer at any depth,
 * walking into groups recursively.
 */
export function hasParticles(layers: readonly Layer[]): boolean {
  for (const layer of layers) {
    if (layer.kind === 'particles') return true
    if (layer.kind === 'group') {
      if (hasParticles(layer.children)) return true
    }
  }
  return false
}
