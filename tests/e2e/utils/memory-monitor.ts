/**
 * Memory Monitor Utilities
 *
 * Provides utilities for tracking memory usage during E2E tests
 * to detect memory leaks in long-running operations.
 *
 * Note: performance.memory is Chrome-only and requires
 * --enable-precise-memory-info flag
 */

import type { Page } from '@playwright/test'

export interface MemoryMetrics {
  available: boolean
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
}

export interface MemoryAnalysis {
  samples: MemoryMetrics[]
  initialHeap: number
  finalHeap: number
  peakHeap: number
  growthBytes: number
  growthPercent: number
  hasLeak: boolean
  leakThresholdBytes: number
}

/**
 * Measure current memory usage
 */
export async function measureMemory(page: Page): Promise<MemoryMetrics> {
  return page.evaluate(() => {
    const memory = (performance as Performance & { memory?: MemoryInfo }).memory
    if (!memory) {
      return { available: false }
    }
    return {
      available: true,
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }
  })
}

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

/**
 * Detect memory leaks by sampling heap size over time
 *
 * @param page - Playwright page
 * @param durationMs - How long to monitor
 * @param sampleIntervalMs - Interval between samples
 * @param leakThresholdBytes - Growth threshold to consider a leak (default 50MB)
 */
export async function detectMemoryLeak(
  page: Page,
  durationMs: number,
  sampleIntervalMs: number = 1000,
  leakThresholdBytes: number = 50 * 1024 * 1024
): Promise<MemoryAnalysis> {
  const samples: MemoryMetrics[] = []

  const start = Date.now()
  while (Date.now() - start < durationMs) {
    const sample = await measureMemory(page)
    samples.push(sample)
    await page.waitForTimeout(sampleIntervalMs)
  }

  // Calculate metrics
  const heapSizes = samples.filter((s) => s.available).map((s) => s.usedJSHeapSize!)

  if (heapSizes.length < 2) {
    return {
      samples,
      initialHeap: 0,
      finalHeap: 0,
      peakHeap: 0,
      growthBytes: 0,
      growthPercent: 0,
      hasLeak: false,
      leakThresholdBytes
    }
  }

  const initialHeap = heapSizes[0]
  const finalHeap = heapSizes[heapSizes.length - 1]
  const peakHeap = Math.max(...heapSizes)
  const growthBytes = finalHeap - initialHeap
  const growthPercent = (growthBytes / initialHeap) * 100

  return {
    samples,
    initialHeap,
    finalHeap,
    peakHeap,
    growthBytes,
    growthPercent,
    hasLeak: growthBytes > leakThresholdBytes,
    leakThresholdBytes
  }
}

/**
 * Memory sampler for continuous monitoring during tests
 */
export class MemorySampler {
  private page: Page
  private samples: MemoryMetrics[] = []
  private intervalId: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Start sampling memory at regular intervals
   */
  start(intervalMs: number = 1000): void {
    this.samples = []
    this.stopped = false
    this.intervalId = setInterval(async () => {
      if (this.stopped) return
      try {
        const sample = await measureMemory(this.page)
        if (!this.stopped) {
          this.samples.push(sample)
        }
      } catch {
        // Page was closed, stop sampling
        this.stop()
      }
    }, intervalMs)
  }

  /**
   * Stop sampling
   */
  stop(): void {
    this.stopped = true
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Get collected samples
   */
  getSamples(): MemoryMetrics[] {
    return [...this.samples]
  }

  /**
   * Analyze collected samples for leaks
   */
  analyze(leakThresholdBytes: number = 50 * 1024 * 1024): MemoryAnalysis {
    const heapSizes = this.samples.filter((s) => s.available).map((s) => s.usedJSHeapSize!)

    if (heapSizes.length < 2) {
      return {
        samples: this.samples,
        initialHeap: 0,
        finalHeap: 0,
        peakHeap: 0,
        growthBytes: 0,
        growthPercent: 0,
        hasLeak: false,
        leakThresholdBytes
      }
    }

    const initialHeap = heapSizes[0]
    const finalHeap = heapSizes[heapSizes.length - 1]
    const peakHeap = Math.max(...heapSizes)
    const growthBytes = finalHeap - initialHeap
    const growthPercent = (growthBytes / initialHeap) * 100

    return {
      samples: this.samples,
      initialHeap,
      finalHeap,
      peakHeap,
      growthBytes,
      growthPercent,
      hasLeak: growthBytes > leakThresholdBytes,
      leakThresholdBytes
    }
  }
}

/**
 * Force a garbage collection via the Chrome DevTools Protocol, so that a
 * follow-up measurement reports retained heap rather than garbage that simply
 * has not been collected yet. Resolves quietly where CDP is unavailable.
 */
export async function collectGarbage(page: Page): Promise<void> {
  try {
    const client = await page.context().newCDPSession(page)
    // Two passes with a settle between them. One pass leaves a variable amount
    // uncollected - locally it produced retained figures between 1.8MB and
    // 12MB for the same operation - which is enough noise to make a threshold
    // on the result flaky.
    await client.send('HeapProfiler.collectGarbage')
    await page.waitForTimeout(200)
    await client.send('HeapProfiler.collectGarbage')
    await client.detach()
  } catch {
    // No CDP session available (non-Chromium); callers treat GC as best effort.
  }
}

/**
 * Start recording, inside the page, the longest gap between consecutive
 * animation frames.
 *
 * This is the direct measurement of a frozen UI: the browser cannot serve an
 * animation frame while the main thread is executing, so a long task shows up
 * as a long gap and nothing else does. Timing an interaction from the test
 * process measures something different and much noisier - Playwright's
 * actionability polling on a re-rendering page, plus a round trip per call
 * (issue #200).
 *
 * Call `readLongestFrameGap` after the work under test to read the result.
 */
export async function startFrameGapProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __frameGap__?: { longest: number; last: number } }
    const state = { longest: 0, last: performance.now() }
    w.__frameGap__ = state
    const tick = (now: number) => {
      const gap = now - state.last
      if (gap > state.longest) state.longest = gap
      state.last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Longest gap in milliseconds between animation frames since
 * `startFrameGapProbe` was called. Returns 0 if the probe was never started.
 */
export async function readLongestFrameGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as Window & { __frameGap__?: { longest: number } }
    return w.__frameGap__?.longest ?? 0
  })
}

/**
 * Format bytes for display
 */
export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

// `measureUIResponsiveness` and `checkUIResponsivenessDuring` used to live here.
// Both timed an `await` on a Playwright locator and compared the elapsed time to
// a budget, which measures a round trip to the browser and the actionability
// polling of a re-rendering page - the runner, in other words, and not
// main-thread availability in the application. Three tests were built on them
// and all three now use `startFrameGapProbe` above instead: #200 converted one,
// #211 two, #229 the last. Deleted with no callers left, so the pattern is gone
// rather than merely unused (issue #229).
//
// A fourth site had the same stopwatch written out inline and so was never a
// caller of either - `external-drive.spec.ts`, converted in #229 as well. If you
// are looking for a survivor, grep `tests/e2e` for `Date.now()` around an `await`
// on a locator rather than for these names.
