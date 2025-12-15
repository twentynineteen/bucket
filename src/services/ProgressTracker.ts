import { logger } from '@/utils/logger'

/**
 * Progress Tracker Service
 * Provides real-time progress tracking and user feedback during updates
 */

export interface ProgressUpdate {
  id: string
  phase: string
  step: string
  progress: number
  total: number
  message: string
  details?: string
  timestamp: Date
  estimatedTimeRemaining?: number
}

export interface ProgressSubscription {
  id: string
  callback: (update: ProgressUpdate) => void
  filter?: ProgressFilter
}

export interface ProgressFilter {
  phases?: string[]
  minProgress?: number
  maxProgress?: number
}

export interface ProgressSummary {
  totalPhases: number
  currentPhase: number
  overallProgress: number
  currentMessage: string
  timeElapsed: number
  estimatedTimeRemaining?: number
  errors: number
  warnings: number
}

export class ProgressTracker {
  private subscriptions: Map<string, ProgressSubscription> = new Map()
  private progressHistory: ProgressUpdate[] = []
  private startTime?: Date
  private currentProgress: ProgressUpdate | null = null
  private phaseWeights: Map<string, number> = new Map()

  constructor() {
    this.initializePhaseWeights()
  }

  /**
   * Initialize phase weights for overall progress calculation
   */
  private initializePhaseWeights(): void {
    this.phaseWeights.set('initialization', 5)
    this.phaseWeights.set('dependency-scanning', 10)
    this.phaseWeights.set('security-audit', 15)
    this.phaseWeights.set('unused-detection', 10)
    this.phaseWeights.set('breaking-change-analysis', 15)
    this.phaseWeights.set('compatibility-validation', 10)
    this.phaseWeights.set('update-execution', 25)
    this.phaseWeights.set('verification', 8)
    this.phaseWeights.set('cleanup', 2)
  }

  /**
   * Start tracking progress
   */
  public startTracking(): void {
    this.startTime = new Date()
    this.progressHistory = []
    this.currentProgress = null
  }

  /**
   * Update progress with new information
   */
  public updateProgress(
    update: Partial<ProgressUpdate> & { phase: string; step: string; message: string }
  ): void {
    const progressUpdate: ProgressUpdate = {
      id: this.generateUpdateId(),
      progress: update.progress || 0,
      total: update.total || 100,
      timestamp: new Date(),
      estimatedTimeRemaining: this.calculateEstimatedTime(
        update.progress || 0,
        update.total || 100
      ),
      ...update
    }

    this.currentProgress = progressUpdate
    this.progressHistory.push(progressUpdate)

    // Notify all subscribers
    this.notifySubscribers(progressUpdate)
  }

  /**
   * Generate unique update ID
   */
  private generateUpdateId(): string {
    return `update-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTime(current: number, total: number): number | undefined {
    if (!this.startTime || current <= 0) {
      return undefined
    }

    const timeElapsed = Date.now() - this.startTime.getTime()
    const progressRatio = current / total

    if (progressRatio <= 0) {
      return undefined
    }

    const estimatedTotalTime = timeElapsed / progressRatio
    return Math.max(0, estimatedTotalTime - timeElapsed)
  }

  /**
   * Subscribe to progress updates
   */
  public subscribe(
    callback: (update: ProgressUpdate) => void,
    filter?: ProgressFilter
  ): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      callback,
      filter
    })

    return subscriptionId
  }

  /**
   * Unsubscribe from progress updates
   */
  public unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId)
  }

  /**
   * Notify all subscribers of progress update
   */
  private notifySubscribers(update: ProgressUpdate): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(update, subscription.filter)) {
        try {
          subscription.callback(update)
        } catch (error) {
          logger.error(`Error in progress callback ${subscription.id}:`, error)
        }
      }
    }
  }

  /**
   * Check if update matches subscription filter
   */
  private matchesFilter(update: ProgressUpdate, filter?: ProgressFilter): boolean {
    if (!filter) {
      return true
    }

    if (filter.phases && !filter.phases.includes(update.phase)) {
      return false
    }

    if (filter.minProgress !== undefined && update.progress < filter.minProgress) {
      return false
    }

    if (filter.maxProgress !== undefined && update.progress > filter.maxProgress) {
      return false
    }

    return true
  }

  /**
   * Get current progress summary
   */
  public getProgressSummary(): ProgressSummary {
    const totalPhases = this.phaseWeights.size
    const currentPhaseIndex = this.getCurrentPhaseIndex()
    const overallProgress = this.calculateOverallProgress()
    const timeElapsed = this.startTime ? Date.now() - this.startTime.getTime() : 0

    const errors = this.progressHistory.filter((p) =>
      p.message.toLowerCase().includes('error')
    ).length
    const warnings = this.progressHistory.filter((p) =>
      p.message.toLowerCase().includes('warning')
    ).length

    return {
      totalPhases,
      currentPhase: currentPhaseIndex + 1,
      overallProgress,
      currentMessage: this.currentProgress?.message || 'No active progress',
      timeElapsed,
      estimatedTimeRemaining: this.currentProgress?.estimatedTimeRemaining,
      errors,
      warnings
    }
  }

  /**
   * Get current phase index
   */
  private getCurrentPhaseIndex(): number {
    if (!this.currentProgress) {
      return 0
    }

    const phases = Array.from(this.phaseWeights.keys())
    return phases.indexOf(this.currentProgress.phase)
  }

  /**
   * Calculate overall progress across all phases
   */
  private calculateOverallProgress(): number {
    if (!this.currentProgress) {
      return 0
    }

    const phases = Array.from(this.phaseWeights.keys())
    const totalWeight = Array.from(this.phaseWeights.values()).reduce(
      (sum, weight) => sum + weight,
      0
    )

    let completedWeight = 0
    const currentPhaseIndex = phases.indexOf(this.currentProgress.phase)

    // Add weight for completed phases
    for (let i = 0; i < currentPhaseIndex; i++) {
      completedWeight += this.phaseWeights.get(phases[i]) || 0
    }

    // Add partial weight for current phase
    const currentPhaseWeight = this.phaseWeights.get(this.currentProgress.phase) || 0
    const currentPhaseProgress =
      this.currentProgress.progress / this.currentProgress.total
    completedWeight += currentPhaseWeight * currentPhaseProgress

    return Math.min(100, (completedWeight / totalWeight) * 100)
  }

  /**
   * Get progress history
   */
  public getProgressHistory(): ProgressUpdate[] {
    return [...this.progressHistory]
  }

  /**
   * Clear progress history
   */
  public clearHistory(): void {
    this.progressHistory = []
  }

  /**
   * Format progress update for console output
   */
  public formatProgressForConsole(update: ProgressUpdate): string {
    const percentage = ((update.progress / update.total) * 100).toFixed(1)
    const progressBar = this.createProgressBar(update.progress, update.total, 20)

    const timeRemaining = update.estimatedTimeRemaining
      ? ` (ETA: ${this.formatDuration(update.estimatedTimeRemaining)})`
      : ''

    return `[${update.phase.toUpperCase()}] ${progressBar} ${percentage}% - ${update.message}${timeRemaining}`
  }

  /**
   * Create ASCII progress bar
   */
  private createProgressBar(current: number, total: number, width: number): string {
    const progress = current / total
    const completed = Math.floor(progress * width)
    const remaining = width - completed

    return '█'.repeat(completed) + '░'.repeat(remaining)
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Export progress data for analysis
   */
  public exportProgressData(): Record<string, unknown> {
    return {
      startTime: this.startTime,
      currentProgress: this.currentProgress,
      progressHistory: this.progressHistory,
      summary: this.getProgressSummary(),
      phaseWeights: Object.fromEntries(this.phaseWeights)
    }
  }
}
