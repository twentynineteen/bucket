/**
 * Video QC thresholds (issue #180, D18, B13)
 *
 * One source of truth for the numbers a QC verdict depends on, so a verdict is
 * reproducible from the constants rather than from whatever the UI happened to
 * send. The Rust side mirrors these in `src-tauri/src/qc/thresholds.rs` as the
 * fallback for a call that omits them; the two must be changed together.
 *
 * # Calibration
 *
 * Measured on two real UHD renders, after the matcher was corrected to build its
 * template from the reference's alpha map rather than from the reference composited
 * over a backdrop. The brand assets are a flat colour plus a varying alpha mask
 * peaking at 137 of 255, so the mark is never more than 54% opaque and its
 * composited appearance depends entirely on the footage behind it. The alpha map is
 * the backdrop-invariant, and normalised correlation absorbs the rest as a scale
 * factor.
 *
 * Presence measured **0.9803 to 0.9973** across two renders, two colour variants and
 * two backdrop types at 4K. Absence measured **-0.1483 to 0.0135**. The narrowest
 * separation is about 0.83, so 0.85 sits in a very wide empty band.
 */

/** Defaults applied when nothing is overridden. */
export const QC_THRESHOLDS = {
  /**
   * Match confidence a watermark sample must reach to count as present.
   *
   * Deliberately well below the weakest measured match (0.9803): the margin absorbs
   * a heavier encode or a new asset without anyone having to retune.
   */
  matchConfidence: 0.85,
  /**
   * Bounds for an operator override. The floor is not zero: a mark-free region
   * measured up to 0.0135, so a threshold near zero would pass every frame of a
   * completely unbranded video and report a green tick. It still sits well below the
   * default so a badly calibrated default can be worked around without a release.
   */
  matchConfidenceMin: 0.3,
  matchConfidenceMax: 0.999,
  /** The weakest score measured on a render whose watermark was plainly visible. */
  measuredWeakestPresence: 0.9803,
  /** The strongest score measured on a region with no watermark in it. */
  measuredStrongestAbsence: 0.0135
} as const

/** Why an override was refused, or null when it is usable. */
export type QcThresholdProblem = string | null

/**
 * Validates an operator's match confidence override.
 *
 * Rejected rather than clamped (B13.3): silently turning 8.5 into 0.999 leaves
 * someone believing they set something they did not, and the next surprising
 * verdict is then unattributable.
 *
 * An empty string is not an error - it means "no override", which is how the
 * field is cleared back to the default.
 */
export function validateMatchConfidence(raw: string): QcThresholdProblem {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return `Enter a number between ${QC_THRESHOLDS.matchConfidenceMin} and ${QC_THRESHOLDS.matchConfidenceMax}, or leave it empty for the default.`
  }

  if (
    value < QC_THRESHOLDS.matchConfidenceMin ||
    value > QC_THRESHOLDS.matchConfidenceMax
  ) {
    return `The match confidence must be between ${QC_THRESHOLDS.matchConfidenceMin} and ${QC_THRESHOLDS.matchConfidenceMax}. ${trimmed} was rejected rather than adjusted.`
  }

  return null
}

/**
 * The override to send with a run, or undefined to use the calibrated default.
 *
 * Returns undefined for anything unusable rather than throwing: the field's own
 * validation is what tells the operator, and a run should not be able to apply a
 * threshold that was rejected on screen.
 */
export function resolveMatchConfidenceOverride(raw: string | null): number | undefined {
  if (raw === null) return undefined
  if (validateMatchConfidence(raw) !== null) return undefined

  const trimmed = raw.trim()
  if (trimmed === '') return undefined

  return Number(trimmed)
}
