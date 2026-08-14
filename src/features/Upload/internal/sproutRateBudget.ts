/**
 * Sprout request budget guard (issue #155, R6)
 *
 * Sprout allows **200 requests per minute per account**, returning HTTP 429 with
 * `X-RateLimit-Remaining` / `-Reset`. The limit is account-wide, so folder
 * browsing shares one budget with uploads, poster frame writes and video-detail
 * fetches -- and a picker that spends the budget can 429 the user's own upload.
 *
 * This guard exists to make that impossible. It is deliberately asymmetric:
 *
 * - **Folder browsing is throttled.** Serialised to one request in flight, and
 *   refused outright once the remaining budget drops below `RESERVE`.
 * - **Uploads and poster frame writes are never throttled.** The reserve exists
 *   for them. Browsing is interruptible and retryable; a 4 GB upload forty
 *   minutes in is neither.
 *
 * Pure and dependency-free -- no Tauri, no React, no timers beyond `Date.now`
 * -- so the accounting can be tested directly.
 */

/** Requests held back for uploads and poster frame writes. */
export const RESERVE = 20

/** Assumed wait when Sprout 429s without telling us when the window resets. */
export const DEFAULT_COOLOFF_MS = 60_000

/** Why a folder request was refused before reaching the network. */
export type BudgetRefusal =
  | { allowed: true }
  | { allowed: false; reason: 'cooloff'; retryAtEpochMs: number }
  | { allowed: false; reason: 'reserve'; remaining: number }

interface BudgetState {
  /** Last `X-RateLimit-Remaining` Sprout reported, or null if never seen. */
  remaining: number | null
  /** Epoch ms until which folder requests short-circuit after a 429. */
  cooloffUntil: number | null
}

const state: BudgetState = { remaining: null, cooloffUntil: null }

/**
 * Tail of the browse queue. Each request chains onto this and replaces it
 * **synchronously**, so callers that arrive in the same tick still queue behind
 * one another. Reading an `inFlight` slot instead would let every caller in a
 * single tick observe it as empty and run concurrently.
 */
let queueTail: Promise<unknown> = Promise.resolve()

/**
 * Records what Sprout told us about the budget. Call after every Sprout
 * response, throttled or not -- an upload's headers inform browsing decisions
 * just as much as a folder fetch's do.
 */
export function recordBudget(
  remaining: number | null | undefined,
  resetEpochSeconds?: number | null
): void {
  if (typeof remaining === 'number' && Number.isFinite(remaining)) {
    state.remaining = remaining
  }
  // A reset in the future only matters while we are in cooloff; recording it
  // here keeps the wait honest if a 429 follows.
  if (
    state.cooloffUntil !== null &&
    typeof resetEpochSeconds === 'number' &&
    Number.isFinite(resetEpochSeconds)
  ) {
    state.cooloffUntil = resetEpochSeconds * 1000
  }
}

/**
 * Opens a cooloff after a 429. Folder requests short-circuit until it expires;
 * uploads are unaffected.
 */
export function recordRateLimited(
  resetEpochSeconds?: number | null,
  now = Date.now()
): void {
  const reset =
    typeof resetEpochSeconds === 'number' && Number.isFinite(resetEpochSeconds)
      ? resetEpochSeconds * 1000
      : now + DEFAULT_COOLOFF_MS

  // Never shorten an existing cooloff, and never set one in the past.
  state.cooloffUntil = Math.max(state.cooloffUntil ?? 0, reset, now + 1)
  state.remaining = 0
}

/** Whether a *browsing* request may proceed right now. */
export function checkBrowseAllowed(now = Date.now()): BudgetRefusal {
  if (state.cooloffUntil !== null) {
    if (now < state.cooloffUntil) {
      return { allowed: false, reason: 'cooloff', retryAtEpochMs: state.cooloffUntil }
    }
    // Window has passed -- clear it and let the next request re-measure.
    state.cooloffUntil = null
    state.remaining = null
  }

  if (state.remaining !== null && state.remaining < RESERVE) {
    return { allowed: false, reason: 'reserve', remaining: state.remaining }
  }

  return { allowed: true }
}

/** Human-readable explanation for a refusal, for display in the picker. */
export function describeRefusal(
  refusal: Extract<BudgetRefusal, { allowed: false }>,
  now = Date.now()
): string {
  if (refusal.reason === 'cooloff') {
    const seconds = Math.max(1, Math.ceil((refusal.retryAtEpochMs - now) / 1000))
    return `Sprout's rate limit was reached. Folder browsing resumes in ${seconds}s -- uploads are unaffected.`
  }
  return `Sprout's request budget is nearly spent (${refusal.remaining} left). Folder browsing is paused so uploads keep working.`
}

/**
 * Runs a browsing request under the guard: refuses when the budget is short,
 * and serialises so a burst of submenu opens cannot fan out.
 *
 * Throws a `BudgetError` when refused, so React Query surfaces it like any other
 * failure rather than the caller having to special-case a sentinel value.
 */
export function runBrowseRequest<T>(request: () => Promise<T>): Promise<T> {
  // The budget is checked when the request reaches the front of the queue, not
  // when it joins it: a 429 arriving while it waits must still refuse it.
  const run = queueTail.then(() => {
    const verdict = checkBrowseAllowed()
    // `=== false`, not `!verdict.allowed`: strictNullChecks is off repo-wide,
    // and without it TypeScript will not narrow a union by the truthiness of a
    // boolean discriminant, only by an explicit comparison.
    if (verdict.allowed === false) {
      throw new BudgetError(describeRefusal(verdict), verdict.reason)
    }
    return request()
  })

  // Swallow failures on the queue itself so one rejected request cannot poison
  // the chain for every later one. The caller still sees its own rejection.
  queueTail = run.catch(() => undefined)

  return run
}

/** Refusal raised before a request reaches the network. */
export class BudgetError extends Error {
  readonly reason: 'cooloff' | 'reserve'

  constructor(message: string, reason: 'cooloff' | 'reserve') {
    super(message)
    this.name = 'BudgetError'
    this.reason = reason
  }
}

/**
 * Last remaining-request count Sprout reported, or null if unknown.
 *
 * Exposed so a long crawl can pace itself against the real budget rather than a
 * fixed guess -- fast while there is headroom, slower as it runs down.
 */
export function remainingBudget(): number | null {
  return state.remaining
}

/** Test seam -- resets all accounting. Not used in production code. */
export function __resetBudget(): void {
  state.remaining = null
  state.cooloffUntil = null
  queueTail = Promise.resolve()
}

/** Test seam -- current accounting, for assertions. */
export function __budgetState(): Readonly<BudgetState> {
  return { ...state }
}
