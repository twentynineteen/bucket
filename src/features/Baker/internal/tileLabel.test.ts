import { describe, expect, it } from 'vitest'
import { fitTileName } from './tileLabel'

// One unit per character keeps the expected line breaks readable.
const byLength = (text: string) => text.length

describe('fitTileName', () => {
  it('keeps a name that fits on one line', () => {
    expect(fitTileName('Open Day Reel', 20, 3, byLength)).toEqual(['Open Day Reel'])
  })

  it('wraps between words, filling each line before starting the next', () => {
    expect(fitTileName('Leadership Lab Session Recording', 16, 3, byLength)).toEqual([
      'Leadership Lab',
      'Session',
      'Recording'
    ])
  })

  it('ends on a whole word with an ellipsis when it runs out of lines', () => {
    expect(fitTileName('Global Online MBA Welcome Film', 12, 2, byLength)).toEqual([
      'Global',
      'Online MBA…'
    ])
  })

  it('drops a word to make room for the ellipsis', () => {
    // "Online MBA" is 10 wide: with the ellipsis it is 11, over the limit of 10.
    expect(fitTileName('Global Online MBA Welcome', 10, 2, byLength)).toEqual([
      'Global',
      'Online…'
    ])
  })

  it('keeps a lone dash on the word before it and never leaves it dangling', () => {
    expect(fitTileName('Dean Interview - Annual Review', 16, 3, byLength)).toEqual([
      'Dean Interview -',
      'Annual Review'
    ])
    expect(fitTileName('Dean Interview - Annual Review', 16, 1, byLength)).toEqual([
      'Dean Interview…'
    ])
  })

  it('stops on a whole word when a later word is wider than the tile', () => {
    // "Walkthroughs" is 12 wide and can never fit an 11-wide line.
    expect(fitTileName('Strategy Simulation Walkthroughs', 11, 3, byLength)).toEqual([
      'Strategy',
      'Simulation…'
    ])
  })

  it('gives up a line when its only word leaves no room for the ellipsis', () => {
    // "Simulation" fills the 10-wide line exactly, so the ellipsis moves up.
    expect(fitTileName('Strategy Simulation Walkthrough', 10, 3, byLength)).toEqual([
      'Strategy…'
    ])
  })

  it('cuts inside the first word only when that word alone is too wide', () => {
    expect(fitTileName('Walkthrough Notes', 8, 3, byLength)).toEqual(['Walkthr…'])
  })

  it('returns nothing when there is no room for a line', () => {
    expect(fitTileName('Anything', 20, 0, byLength)).toEqual([])
  })

  it('returns nothing when not even one character and an ellipsis fit', () => {
    expect(fitTileName('Anything', 1, 2, byLength)).toEqual([])
  })
})
