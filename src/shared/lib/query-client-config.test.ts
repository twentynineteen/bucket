import { createPersistedQueryClient } from '@shared/lib/query-client-config'
import type { QueryClient } from '@tanstack/react-query'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Pins the retry policy actually installed on the QueryClient, not just the
 * predicate in isolation. #156's defect was a correct intention wired to a
 * predicate that could never see a Tauri rejection, so the wiring is the thing
 * worth guarding: a query that fails with a bare-string 429 must not be retried
 * into a rate-limit window that is still closed.
 */
describe('createPersistedQueryClient retry policy', () => {
  let client: QueryClient

  beforeAll(async () => {
    client = await createPersistedQueryClient({ enabled: false })
  })

  const retryFor = (scope: 'queries' | 'mutations') => {
    const retry = client.getDefaultOptions()[scope]?.retry
    if (typeof retry !== 'function') {
      throw new Error(`expected a ${scope} retry predicate, got ${typeof retry}`)
    }
    // React Query's mutation predicate takes the same (failureCount, error) shape.
    return retry as (failureCount: number, error: unknown) => boolean
  }

  describe.each(['queries', 'mutations'] as const)('%s', (scope) => {
    it('does not retry a bare-string 429', () => {
      expect(
        retryFor(scope)(
          0,
          'Sprout rate limit reached (HTTP 429). Try again in 30 seconds.'
        )
      ).toBe(false)
    })

    it('does not retry a bare-string 401 or 403', () => {
      expect(retryFor(scope)(0, 'Sprout rejected the request: HTTP 401')).toBe(false)
      expect(retryFor(scope)(0, 'Sprout rejected the request: HTTP 403')).toBe(false)
    })

    it('retries a bare-string 503', () => {
      expect(retryFor(scope)(0, 'Sprout returned HTTP 503 Service Unavailable')).toBe(
        true
      )
    })
  })

  it('allows mutations fewer attempts than queries', () => {
    // Mutations retry less because a retried mutation can duplicate an upload.
    expect(retryFor('queries')(2, 'HTTP 503')).toBe(true)
    expect(retryFor('mutations')(2, 'HTTP 503')).toBe(false)
  })
})
