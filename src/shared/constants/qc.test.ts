/**
 * QC threshold constants (issue #180, B13)
 */

import { describe, expect, it } from 'vitest'

import {
  QC_THRESHOLDS,
  resolveMatchConfidenceOverride,
  validateMatchConfidence
} from './qc'

describe('QC match confidence', () => {
  it('B13.1 sends no override when the field is empty, so the default applies', () => {
    expect(resolveMatchConfidenceOverride('')).toBeUndefined()
    expect(resolveMatchConfidenceOverride(null)).toBeUndefined()
  })

  it('B13.2 sends a valid override through to the run', () => {
    expect(resolveMatchConfidenceOverride('0.92')).toBe(0.92)
  })

  it('B13.3 rejects a value above the range rather than clamping it', () => {
    const problem = validateMatchConfidence('1.5')

    expect(problem).toMatch(/rejected rather than adjusted/i)
    expect(problem).toContain('1.5')
  })

  it('B13.3 rejects a value below the range', () => {
    // 0.0115 was measured for a region with no watermark in it, so a threshold
    // under the floor would pass a completely unbranded video.
    expect(validateMatchConfidence('0.05')).toMatch(/must be between/i)
  })

  it('B13.3 rejects text that is not a number', () => {
    expect(validateMatchConfidence('high')).toMatch(/Enter a number/i)
  })

  it('B13.3 never lets a rejected value reach a run', () => {
    // The field's validation is what tells the operator; a run must not quietly
    // apply a threshold that was refused on screen.
    expect(resolveMatchConfidenceOverride('1.5')).toBeUndefined()
    expect(resolveMatchConfidenceOverride('high')).toBeUndefined()
  })

  it('accepts the range bounds themselves', () => {
    expect(validateMatchConfidence(String(QC_THRESHOLDS.matchConfidenceMin))).toBeNull()
    expect(validateMatchConfidence(String(QC_THRESHOLDS.matchConfidenceMax))).toBeNull()
  })

  it('keeps the default inside the measured separation', () => {
    // Guards the calibration: 0.9826 for a genuine match, 0.0115 for a mark-free
    // region. A default drifting to either edge of that band is worth failing on.
    expect(QC_THRESHOLDS.matchConfidence).toBeGreaterThan(0.5)
    expect(QC_THRESHOLDS.matchConfidence).toBeLessThan(0.98)
  })
})
