/**
 * Seeded PRNG for Motion (issue #327)
 *
 * Used by the particle sampler (#332) and particle state evaluator (#328).
 * Determinism is asserted through E6.1 and S1.1, so this file has no test
 * of its own.
 *
 * Uses the Mulberry32 algorithm - simple, fast, 32-bit state, adequate
 * distribution for visual scatter and delays.
 */

/**
 * Create a seeded pseudo-random number generator.
 * Returns a function that yields values in [0, 1) on each call.
 */
export function createRng(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
