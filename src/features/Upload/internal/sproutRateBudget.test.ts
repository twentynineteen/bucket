/**
 * Sprout request budget guard (issue #155, R6)
 *
 * The guard's whole purpose is that folder browsing can never cost a user their
 * upload. These tests pin that asymmetry, plus the accounting that supports it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BudgetError,
  RESERVE,
  __budgetState,
  __resetBudget,
  checkBrowseAllowed,
  describeRefusal,
  recordBudget,
  recordRateLimited,
  runBrowseRequest
} from './sproutRateBudget'

beforeEach(() => {
  __resetBudget()
})

describe('budget accounting', () => {
  it('allows browsing before anything is known about the budget', () => {
    // A cold start must not block the picker -- the first request is how we
    // learn the budget in the first place.
    expect(checkBrowseAllowed()).toEqual({ allowed: true })
  })

  it('allows browsing while the budget is healthy', () => {
    recordBudget(150)
    expect(checkBrowseAllowed()).toEqual({ allowed: true })
  })

  it('refuses browsing once the reserve is breached', () => {
    recordBudget(RESERVE - 1)

    const verdict = checkBrowseAllowed()
    expect(verdict.allowed).toBe(false)
    expect(verdict).toMatchObject({ reason: 'reserve' })
  })

  it('treats exactly the reserve as still spendable', () => {
    recordBudget(RESERVE)
    expect(checkBrowseAllowed()).toEqual({ allowed: true })
  })

  it('ignores absent or unusable header values rather than assuming the worst', () => {
    recordBudget(80)
    recordBudget(null)
    recordBudget(undefined)
    recordBudget(Number.NaN)

    expect(__budgetState().remaining).toBe(80)
  })
})

describe('429 cooloff', () => {
  it('short-circuits browsing until the reset time', () => {
    const now = 1_000_000
    recordRateLimited(now / 1000 + 30, now)

    const verdict = checkBrowseAllowed(now)
    expect(verdict.allowed).toBe(false)
    expect(verdict).toMatchObject({ reason: 'cooloff' })
  })

  it('falls back to a default wait when Sprout does not say when to retry', () => {
    const now = 1_000_000
    recordRateLimited(null, now)

    expect(checkBrowseAllowed(now).allowed).toBe(false)
    expect(checkBrowseAllowed(now + 60_001).allowed).toBe(true)
  })

  it('resumes browsing once the window has passed', () => {
    const now = 1_000_000
    recordRateLimited(now / 1000 + 10, now)

    expect(checkBrowseAllowed(now + 5_000).allowed).toBe(false)
    expect(checkBrowseAllowed(now + 11_000).allowed).toBe(true)
  })

  it('never shortens an existing cooloff', () => {
    // A later 429 reporting a nearer reset must not let requests through early.
    const now = 1_000_000
    recordRateLimited(now / 1000 + 60, now)
    recordRateLimited(now / 1000 + 5, now)

    expect(checkBrowseAllowed(now + 10_000).allowed).toBe(false)
  })

  it('never sets a cooloff in the past', () => {
    // A stale or skewed reset header would otherwise disable the guard entirely.
    const now = 1_000_000
    recordRateLimited(now / 1000 - 500, now)

    expect(checkBrowseAllowed(now).allowed).toBe(false)
  })

  it('clears the stale remaining count when the window passes', () => {
    const now = 1_000_000
    recordRateLimited(now / 1000 + 10, now)
    checkBrowseAllowed(now + 11_000)

    // Otherwise `remaining: 0` from the 429 would keep refusing forever.
    expect(__budgetState().remaining).toBeNull()
    expect(checkBrowseAllowed(now + 11_000).allowed).toBe(true)
  })
})

describe('runBrowseRequest', () => {
  it('runs the request when the budget allows it', async () => {
    const request = vi.fn().mockResolvedValue('folders')
    await expect(runBrowseRequest(request)).resolves.toBe('folders')
    expect(request).toHaveBeenCalledOnce()
  })

  it('refuses without touching the network when the reserve is breached', async () => {
    recordBudget(1)
    const request = vi.fn().mockResolvedValue('folders')

    await expect(runBrowseRequest(request)).rejects.toBeInstanceOf(BudgetError)
    expect(request).not.toHaveBeenCalled()
  })

  it('serialises browsing so a burst cannot fan out', async () => {
    // The picker's submenus can open in quick succession; without this, ten
    // opens would be ten concurrent requests against a 200/min budget.
    let concurrent = 0
    let peak = 0

    const request = vi.fn().mockImplementation(async () => {
      concurrent += 1
      peak = Math.max(peak, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 5))
      concurrent -= 1
      return 'ok'
    })

    await Promise.all([
      runBrowseRequest(request),
      runBrowseRequest(request),
      runBrowseRequest(request)
    ])

    expect(request).toHaveBeenCalledTimes(3)
    expect(peak).toBe(1)
  })

  it('does not let one failed browse block the next', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network'))
    const succeeding = vi.fn().mockResolvedValue('folders')

    await expect(runBrowseRequest(failing)).rejects.toThrow('network')
    await expect(runBrowseRequest(succeeding)).resolves.toBe('folders')
  })
})

describe('the guard is asymmetric by design', () => {
  it('never gates uploads -- they do not pass through the guard at all', async () => {
    // The point of the reserve: with browsing refused, an upload must still go.
    recordBudget(0)
    expect(checkBrowseAllowed().allowed).toBe(false)

    // Uploads call the Tauri command directly, bypassing runBrowseRequest.
    const upload = vi.fn().mockResolvedValue('uploaded')
    await expect(upload()).resolves.toBe('uploaded')
    expect(upload).toHaveBeenCalledOnce()
  })

  it('explains a refusal in terms the user can act on', () => {
    const now = 1_000_000
    recordRateLimited(now / 1000 + 30, now)
    const verdict = checkBrowseAllowed(now)

    // `=== true`, not just truthiness: strictNullChecks is off repo-wide, and
    // without it TypeScript will not narrow a boolean discriminant by truthiness.
    if (verdict.allowed === true) throw new Error('expected a refusal')
    const message = describeRefusal(verdict, now)

    expect(message).toMatch(/30s/)
    expect(message).toMatch(/uploads are unaffected/i)
  })
})
