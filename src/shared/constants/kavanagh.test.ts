/**
 * QC threshold constants (issue #180, B13)
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  KAVANAGH_THRESHOLDS,
  resolveMatchConfidenceOverride,
  validateMatchConfidence
} from './kavanagh'

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
    // Absence was measured as high as 0.0135, so a threshold under the floor would
    // pass a completely unbranded video.
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
    expect(
      validateMatchConfidence(String(KAVANAGH_THRESHOLDS.matchConfidenceMin))
    ).toBeNull()
    expect(
      validateMatchConfidence(String(KAVANAGH_THRESHOLDS.matchConfidenceMax))
    ).toBeNull()
  })

  it('keeps the default inside the measured band', () => {
    // Guards a retune rather than the value. Above the weakest measured presence it
    // fails a render whose watermark is plainly visible; below the strongest
    // measured absence it passes a video with no watermark at all. Both have
    // happened on real footage.
    expect(KAVANAGH_THRESHOLDS.matchConfidence).toBeGreaterThan(
      KAVANAGH_THRESHOLDS.measuredStrongestAbsence
    )
    expect(KAVANAGH_THRESHOLDS.matchConfidence).toBeLessThan(
      KAVANAGH_THRESHOLDS.measuredWeakestPresence
    )
  })

  it('keeps the override range reaching either side of the default', () => {
    // An override cannot work around a badly chosen default if the default sits at
    // the edge of what may be entered.
    expect(KAVANAGH_THRESHOLDS.matchConfidenceMin).toBeLessThan(
      KAVANAGH_THRESHOLDS.matchConfidence
    )
    expect(KAVANAGH_THRESHOLDS.matchConfidenceMax).toBeGreaterThan(
      KAVANAGH_THRESHOLDS.matchConfidence
    )
  })

  it('agrees with the Rust fallback, which is the other half of one source of truth', () => {
    // The UI always sends the threshold it shows, but a call that omits it falls back
    // to the Rust constant. Two different provisional values would produce two
    // different verdicts for the same render.
    // Resolved from this file rather than the working directory, so the test does
    // not depend on where the runner was started.
    const rust = readFileSync(
      path.resolve(__dirname, '../../../src-tauri/src/kavanagh/thresholds.rs'),
      'utf8'
    )

    expect(rust).toContain(
      `DEFAULT_MATCH_CONFIDENCE: f32 = ${KAVANAGH_THRESHOLDS.matchConfidence}`
    )
    expect(rust).toContain(
      `MATCH_CONFIDENCE_MIN: f32 = ${KAVANAGH_THRESHOLDS.matchConfidenceMin}`
    )
    expect(rust).toContain(
      `MATCH_CONFIDENCE_MAX: f32 = ${KAVANAGH_THRESHOLDS.matchConfidenceMax}`
    )
  })
})
