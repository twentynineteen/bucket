/**
 * Fence utility tests (issue #331)
 *
 * PR1.1: no backticks - fence is 3 backticks
 * PR1.2: longest run of N backticks - fence is N+1
 */
import { describe, expect, it } from 'vitest'
import { fence } from './fence'

describe('fence', () => {
  it('PR1.1 uses 3 backticks when content has none', () => {
    const result = fence('json', '{"hello": "world"}')
    const lines = result.split('\n')
    expect(lines[0]).toBe('```json')
    expect(lines[lines.length - 1]).toBe('```')
  })

  it('PR1.2 uses N+1 backticks when longest run is N (run of 3)', () => {
    const content = 'some ```code``` here'
    const result = fence('json', content)
    const lines = result.split('\n')
    expect(lines[0]).toBe('````json')
    expect(lines[lines.length - 1]).toBe('````')
  })

  it('PR1.2 uses N+1 backticks when longest run is N (run of 7)', () => {
    const content = 'some ```````code``````` here'
    const result = fence('json', content)
    const lines = result.split('\n')
    expect(lines[0]).toBe('````````json')
    expect(lines[lines.length - 1]).toBe('````````')
  })

  it('handles content with mixed backtick runs', () => {
    const content = '``` and ````` and ``'
    const result = fence('md', content)
    const lines = result.split('\n')
    // Longest run is 5, so fence should be 6
    expect(lines[0]).toBe('``````md')
    expect(lines[lines.length - 1]).toBe('``````')
  })
})
