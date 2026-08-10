import { fingerprint } from '@shared/lib/fingerprint'
import { describe, expect, it } from 'vitest'

/**
 * Behaviour tests for issue #158 — B1: fingerprint(secret)
 *
 * The fingerprint replaces raw credentials as the cache-key discriminator.
 * It must be stable, collision-free across distinct credentials, and must
 * never reveal the secret it was derived from.
 */
describe('fingerprint (B1)', () => {
  it('B1.1 returns the same output for the same input across calls', () => {
    const secret = 'RAW_SPROUT_SECRET_KEY_12345'
    expect(fingerprint(secret)).toBe(fingerprint(secret))

    const another = 'RAW_TRELLO_TOKEN_67890'
    const first = fingerprint(another)
    const second = fingerprint(another)
    expect(first).toBe(second)
  })

  it('B1.2 returns different outputs for different inputs', () => {
    expect(fingerprint('RAW_KEY_A')).not.toBe(fingerprint('RAW_KEY_B'))
    // Near-identical secrets must still be distinguished
    expect(fingerprint('RAW_KEY_A1')).not.toBe(fingerprint('RAW_KEY_A2'))
    expect(fingerprint('')).not.toBe(fingerprint('RAW_KEY_A'))
  })

  it('B1.3 never contains the input, and is never a substring of it', () => {
    const secret = 'RAW_SPROUT_SECRET_KEY_12345'
    const fp = fingerprint(secret)
    expect(fp).not.toBe(secret)
    expect(fp.includes(secret)).toBe(false)
    expect(secret.includes(fp)).toBe(false)
  })

  it('B1.4 output is exactly 8 lowercase hex characters', () => {
    expect(fingerprint('RAW_SPROUT_SECRET_KEY_12345')).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint('')).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint('x')).toMatch(/^[0-9a-f]{8}$/)
  })
})
