/**
 * Progress Event Generator
 *
 * Generates realistic progress events that mirror the Rust backend logic
 * from src-tauri/src/utils/file_copy.rs
 *
 * Backend formula:
 *   overall_progress = (files_completed + file_progress) / total_files * 100
 */

import type { SimulatedFileSet, MockFile } from './large-file-simulator'

export interface ProgressEvent {
  percent: number
  timestamp: number // ms since operation start
  fileIndex: number
  fileProgress: number // 0-1 within current file
}

export interface FailureConfig {
  failingFileIndices: number[]
  errorMessage: string
}

export interface SimulationOptions {
  speedMultiplier?: number // Speed up for CI (default: 1)
  failureConfig?: FailureConfig // Inject failures at specific files
  onProgress?: (percent: number) => void
  onComplete?: (files: string[]) => void
  onError?: (error: string, fileIndex: number) => void
}

/**
 * Calculate overall progress matching Rust backend logic
 */
export function calculateOverallProgress(
  fileIndex: number,
  fileProgress: number,
  totalFiles: number
): number {
  return ((fileIndex + fileProgress) / totalFiles) * 100
}

/**
 * Generate expected progress events for a scenario
 * Used for verification in tests
 */
export function generateExpectedProgressEvents(
  scenario: SimulatedFileSet,
  eventsPerFile: number = 10
): ProgressEvent[] {
  const events: ProgressEvent[] = []
  let timestamp = 0

  for (let fileIndex = 0; fileIndex < scenario.fileCount; fileIndex++) {
    for (let i = 0; i < eventsPerFile; i++) {
      const fileProgress = (i + 1) / eventsPerFile
      const percent = calculateOverallProgress(fileIndex, fileProgress, scenario.fileCount)

      events.push({
        percent,
        timestamp,
        fileIndex,
        fileProgress
      })

      timestamp += scenario.progressIntervalMs
    }
  }

  return events
}

/**
 * Progress Event Generator class for use in E2E mocks
 *
 * Simulates the file copy progress events emitted by the Tauri backend
 */
export class ProgressEventGenerator {
  private scenario: SimulatedFileSet
  private options: SimulationOptions
  private aborted: boolean = false
  private emittedEvents: ProgressEvent[] = []

  constructor(scenario: SimulatedFileSet, options: SimulationOptions = {}) {
    this.scenario = scenario
    this.options = {
      speedMultiplier: 1,
      ...options
    }
  }

  /**
   * Get all events emitted during simulation (for verification)
   */
  getEmittedEvents(): ProgressEvent[] {
    return [...this.emittedEvents]
  }

  /**
   * Abort the simulation
   */
  abort(): void {
    this.aborted = true
  }

  /**
   * Reset state for new simulation
   */
  reset(): void {
    this.aborted = false
    this.emittedEvents = []
  }

  /**
   * Run the file operation simulation
   * Emits progress events at realistic intervals
   */
  async simulate(): Promise<{ success: boolean; completedFiles: string[]; errors: string[] }> {
    const { speedMultiplier = 1, failureConfig, onProgress, onComplete, onError } = this.options

    const completedFiles: string[] = []
    const errors: string[] = []
    const startTime = Date.now()
    const intervalMs = this.scenario.progressIntervalMs / speedMultiplier

    // Emit ~10 progress events per file (throttled like real backend)
    const eventsPerFile = 10

    for (let fileIndex = 0; fileIndex < this.scenario.fileCount; fileIndex++) {
      if (this.aborted) break

      // Check for injected failure
      if (failureConfig?.failingFileIndices.includes(fileIndex)) {
        const errorMsg = `${failureConfig.errorMessage} (file ${fileIndex})`
        errors.push(errorMsg)
        onError?.(errorMsg, fileIndex)
        continue // Skip to next file
      }

      // Simulate progress within this file
      for (let i = 0; i < eventsPerFile; i++) {
        if (this.aborted) break

        const fileProgress = (i + 1) / eventsPerFile
        const percent = calculateOverallProgress(fileIndex, fileProgress, this.scenario.fileCount)

        const event: ProgressEvent = {
          percent,
          timestamp: Date.now() - startTime,
          fileIndex,
          fileProgress
        }

        this.emittedEvents.push(event)
        onProgress?.(percent)

        // Wait for interval (simulates real I/O time)
        await this.sleep(intervalMs)
      }

      completedFiles.push(`file_${fileIndex}`)
    }

    // Emit completion
    if (!this.aborted) {
      onProgress?.(100)
      onComplete?.(completedFiles)
    }

    return {
      success: errors.length === 0 && !this.aborted,
      completedFiles,
      errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(1, ms)))
  }
}

/**
 * Create a progress tracker for test assertions
 */
export function createProgressTracker() {
  const events: number[] = []
  let startTime = 0

  return {
    start() {
      events.length = 0
      startTime = Date.now()
    },

    record(percent: number) {
      events.push(percent)
    },

    getEvents(): number[] {
      return [...events]
    },

    /**
     * Verify progress is monotonically increasing
     */
    isMonotonic(): boolean {
      return events.every((val, i) => i === 0 || val >= events[i - 1])
    },

    /**
     * Get the final progress value
     */
    getFinalProgress(): number {
      return events.length > 0 ? events[events.length - 1] : 0
    },

    /**
     * Check if progress reached 100%
     */
    reachedCompletion(): boolean {
      return events.some((val) => val >= 100)
    },

    /**
     * Get average interval between progress updates
     */
    getAverageInterval(): number {
      if (events.length < 2) return 0
      const duration = Date.now() - startTime
      return duration / (events.length - 1)
    }
  }
}
