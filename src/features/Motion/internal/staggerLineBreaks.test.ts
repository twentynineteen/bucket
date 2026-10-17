/**
 * staggerLineBreaks tests (F1 from review)
 *
 * The helper computes a dy multiplier per stagger unit, so consecutive \n
 * produce the right number of blank lines and both renderers agree.
 */
import { describe, expect, it } from 'vitest'
import { staggerLineBreaks } from './staggerLineBreaks'
import type { StaggerUnit } from '../types'

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]

function unit(text: string): StaggerUnit {
  return { text, matrix: IDENTITY, opacity: 1, fill: '#fff' }
}

describe('staggerLineBreaks', () => {
  it('no newlines: every unit gets dy 0', () => {
    const units = [unit('H'), unit('i')]
    const result = staggerLineBreaks(units)
    expect(result).toEqual([0, 0])
  })

  it('single \\n: unit after gets dy 1', () => {
    const units = [unit('H'), unit('i'), unit('\n'), unit('Y'), unit('o')]
    const result = staggerLineBreaks(units)
    expect(result).toEqual([0, 0, -1, 1, 0])
  })

  it('consecutive \\n (blank line): "Hi.\\n\\nYes." gives 3 lines', () => {
    const units = [
      unit('H'),
      unit('i'),
      unit('.'),
      unit('\n'),
      unit('\n'),
      unit('Y'),
      unit('e'),
      unit('s'),
      unit('.')
    ]
    const result = staggerLineBreaks(units)
    // \n units get -1 (skip), unit after two \n gets dy 2
    expect(result[3]).toBe(-1) // first \n
    expect(result[4]).toBe(-1) // second \n
    expect(result[5]).toBe(2) // Y gets dy = 2 * lineAdvance
  })

  it('leading \\n: first visible unit gets dy for the blank line', () => {
    const units = [unit('\n'), unit('A')]
    const result = staggerLineBreaks(units)
    expect(result[0]).toBe(-1)
    expect(result[1]).toBe(1)
  })

  it('trailing \\n: no visible unit to attach to', () => {
    const units = [unit('A'), unit('\n')]
    const result = staggerLineBreaks(units)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(-1)
  })

  it('three consecutive \\n: dy is 3', () => {
    const units = [unit('A'), unit('\n'), unit('\n'), unit('\n'), unit('B')]
    const result = staggerLineBreaks(units)
    expect(result[4]).toBe(3)
  })
})
