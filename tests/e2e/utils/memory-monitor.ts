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
 * Format bytes for display
 */
export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

/**
 * Measure UI responsiveness by timing a simple interaction
 */
export async function measureUIResponsiveness(
  page: Page,
  selector: string = 'body'
): Promise<number> {
  const start = Date.now()
  await page.locator(selector).isVisible()
  return Date.now() - start
}

/**
 * Check that UI remains responsive during operation
 * Returns array of response times for each check
 */
export async function checkUIResponsivenessDuring(
  page: Page,
  durationMs: number,
  checkIntervalMs: number = 500,
  maxResponseTimeMs: number = 100
): Promise<{ responseTimes: number[]; allResponsive: boolean }> {
  const responseTimes: number[] = []
  const start = Date.now()

  while (Date.now() - start < durationMs) {
    const responseTime = await measureUIResponsiveness(page)
    responseTimes.push(responseTime)
    await page.waitForTimeout(checkIntervalMs)
  }

  const allResponsive = responseTimes.every((t) => t < maxResponseTimeMs)

  return { responseTimes, allResponsive }
}
