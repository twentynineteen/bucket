/**
 * Contract tests for issue #158 — credentials must never appear in query keys.
 *
 * B2: sprout key factories fingerprint the apiKey internally.
 * B3: trello.cardDetailsSync fingerprints apiKey and token internally.
 * B4.1: no credential-taking factory leaks a secret into any key segment.
 *
 * Sentinels are uppercase with underscores so no lowercase-hex fingerprint
 * (or fixed key segment) can collide with them by accident.
 */

import { describe, expect, test } from 'vitest'

import { fingerprint } from '@shared/lib/fingerprint'
import { queryKeys } from '@shared/lib/query-keys'

const SPROUT_KEY = 'RAW_SPROUT_API_KEY_SENTINEL'
const SPROUT_KEY_B = 'RAW_SPROUT_API_KEY_SENTINEL_B'
const TRELLO_KEY = 'RAW_TRELLO_API_KEY_SENTINEL'
const TRELLO_TOKEN = 'RAW_TRELLO_TOKEN_SENTINEL'

/** True if any string segment reveals the secret verbatim or as a truncation. */
function leaksSecret(key: readonly unknown[], secret: string): boolean {
  return key.some(
    (segment) =>
      typeof segment === 'string' &&
      segment.length > 0 &&
      (segment.includes(secret) || (segment.length >= 6 && secret.includes(segment)))
  )
}

describe('credential-free query keys (issue #158)', () => {
  describe('shape', () => {
    test('fingerprint is exported from @shared/lib', () => {
      expect(fingerprint).toBeTypeOf('function')
    })

    test('trello.cardDetailsSync factory exists', () => {
      expect(queryKeys.trello.cardDetailsSync).toBeTypeOf('function')
    })
  })

  describe('B2: sprout key factories', () => {
    test('B2.1 no segment equals or contains the raw apiKey', () => {
      expect(
        leaksSecret(queryKeys.sprout.folders(SPROUT_KEY, 'parent-1'), SPROUT_KEY)
      ).toBe(false)
      expect(leaksSecret(queryKeys.sprout.folders(SPROUT_KEY, null), SPROUT_KEY)).toBe(
        false
      )
      expect(leaksSecret(queryKeys.sprout.videos(SPROUT_KEY), SPROUT_KEY)).toBe(false)
      expect(leaksSecret(queryKeys.sprout.video(SPROUT_KEY, 'vid-1'), SPROUT_KEY)).toBe(
        false
      )
    })

    test('B2.2 different credentials produce distinct keys', () => {
      expect(queryKeys.sprout.folders(SPROUT_KEY, 'parent-1')).not.toEqual(
        queryKeys.sprout.folders(SPROUT_KEY_B, 'parent-1')
      )
      expect(queryKeys.sprout.videos(SPROUT_KEY)).not.toEqual(
        queryKeys.sprout.videos(SPROUT_KEY_B)
      )
      expect(queryKeys.sprout.video(SPROUT_KEY, 'vid-1')).not.toEqual(
        queryKeys.sprout.video(SPROUT_KEY_B, 'vid-1')
      )
    })

    test('B2.3 same credential produces an identical key across calls', () => {
      expect(queryKeys.sprout.folders(SPROUT_KEY, 'parent-1')).toEqual(
        queryKeys.sprout.folders(SPROUT_KEY, 'parent-1')
      )
      expect(queryKeys.sprout.videos(SPROUT_KEY)).toEqual(
        queryKeys.sprout.videos(SPROUT_KEY)
      )
      expect(queryKeys.sprout.video(SPROUT_KEY, 'vid-1')).toEqual(
        queryKeys.sprout.video(SPROUT_KEY, 'vid-1')
      )
    })

    test('B2.3 non-secret arguments remain verbatim (parentId, videoId)', () => {
      expect(queryKeys.sprout.folders(SPROUT_KEY, 'parent-1')).toContain('parent-1')
      expect(queryKeys.sprout.folders(SPROUT_KEY, null)).toContain('root')
      expect(queryKeys.sprout.video(SPROUT_KEY, 'vid-1')).toContain('vid-1')
    })
  })

  describe('B3: trello.cardDetailsSync', () => {
    test('B3.1 neither raw secret appears in any segment; cardId stays verbatim', () => {
      const key = queryKeys.trello.cardDetailsSync('card-1', TRELLO_KEY, TRELLO_TOKEN)
      expect(leaksSecret(key, TRELLO_KEY)).toBe(false)
      expect(leaksSecret(key, TRELLO_TOKEN)).toBe(false)
      expect(key).toContain('card-1')
    })

    test('B3.2 distinct credentials produce distinct keys; same credentials identical keys', () => {
      const key = queryKeys.trello.cardDetailsSync('card-1', TRELLO_KEY, TRELLO_TOKEN)
      expect(key).toEqual(
        queryKeys.trello.cardDetailsSync('card-1', TRELLO_KEY, TRELLO_TOKEN)
      )
      expect(key).not.toEqual(
        queryKeys.trello.cardDetailsSync('card-1', `${TRELLO_KEY}_B`, TRELLO_TOKEN)
      )
      expect(key).not.toEqual(
        queryKeys.trello.cardDetailsSync('card-1', TRELLO_KEY, `${TRELLO_TOKEN}_B`)
      )
    })
  })

  describe('B4.1: no credential-taking factory leaks its secret', () => {
    test('every credential-taking factory produces credential-free keys', () => {
      const keys: readonly unknown[][] = [
        [...queryKeys.sprout.folders(SPROUT_KEY, 'parent-1')],
        [...queryKeys.sprout.videos(SPROUT_KEY)],
        [...queryKeys.sprout.video(SPROUT_KEY, 'vid-1')],
        [...queryKeys.trello.cardDetailsSync('card-1', TRELLO_KEY, TRELLO_TOKEN)]
      ]
      for (const key of keys) {
        for (const secret of [SPROUT_KEY, TRELLO_KEY, TRELLO_TOKEN]) {
          expect(
            leaksSecret(key, secret),
            `secret leaked in ${JSON.stringify(key)}`
          ).toBe(false)
        }
      }
    })
  })
})
