/**
 * ProgressTracker Service Tests
 * Purpose: Test real-time progress tracking and user feedback
 */

import {
  ProgressTracker,
  type ProgressFilter,
  type ProgressUpdate
} from '@/services/ProgressTracker'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('ProgressTracker', () => {
  let tracker: ProgressTracker

  beforeEach(() => {
    tracker = new ProgressTracker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with empty state', () => {
      const summary = tracker.getProgressSummary()

      expect(summary.currentMessage).toBe('No active progress')
      expect(summary.errors).toBe(0)
      expect(summary.warnings).toBe(0)
    })

    it('should initialize phase weights', () => {
      const summary = tracker.getProgressSummary()

      expect(summary.totalPhases).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Start Tracking Tests
  // ============================================================================

  describe('startTracking', () => {
    it('should reset progress state when starting tracking', () => {
      // Add some progress
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up',
        progress: 50,
        total: 100
      })

      tracker.startTracking()
      const history = tracker.getProgressHistory()

      expect(history).toHaveLength(0)
    })

    it('should set start time', () => {
      const beforeStart = Date.now()
      vi.setSystemTime(beforeStart)

      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test',
        progress: 10,
        total: 100
      })

      const summary = tracker.getProgressSummary()
      expect(summary.timeElapsed).toBeGreaterThanOrEqual(0)
    })
  })

  // ============================================================================
  // Update Progress Tests
  // ============================================================================

  describe('updateProgress', () => {
    beforeEach(() => {
      tracker.startTracking()
    })

    it('should create progress update with all required fields', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up dependencies',
        progress: 25,
        total: 100
      })

      const history = tracker.getProgressHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up dependencies',
        progress: 25,
        total: 100
      })
      expect(history[0].id).toBeDefined()
      expect(history[0].timestamp).toBeInstanceOf(Date)
    })

    it('should use default values for optional fields', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      const history = tracker.getProgressHistory()
      expect(history[0].progress).toBe(0)
      expect(history[0].total).toBe(100)
    })

    it('should add updates to history', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'step1',
        message: 'Step 1',
        progress: 25,
        total: 100
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'step2',
        message: 'Step 2',
        progress: 50,
        total: 100
      })

      const history = tracker.getProgressHistory()
      expect(history).toHaveLength(2)
    })

    it('should update current progress', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Current message',
        progress: 50,
        total: 100
      })

      const summary = tracker.getProgressSummary()
      expect(summary.currentMessage).toBe('Current message')
    })

    it('should generate unique update IDs', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'step1',
        message: 'Test 1'
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'step2',
        message: 'Test 2'
      })

      const history = tracker.getProgressHistory()
      expect(history[0].id).not.toBe(history[1].id)
    })
  })

  // ============================================================================
  // Subscription Tests
  // ============================================================================

  describe('subscribe and unsubscribe', () => {
    beforeEach(() => {
      tracker.startTracking()
    })

    it('should notify subscribers when progress updates', () => {
      const callback = vi.fn()
      tracker.subscribe(callback)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test',
        progress: 10,
        total: 100
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'initialization',
          message: 'Test'
        })
      )
    })

    it('should return subscription ID', () => {
      const callback = vi.fn()
      const subscriptionId = tracker.subscribe(callback)

      expect(subscriptionId).toMatch(/^sub-/)
      expect(typeof subscriptionId).toBe('string')
    })

    it('should stop notifying after unsubscribe', () => {
      const callback = vi.fn()
      const subscriptionId = tracker.subscribe(callback)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test 1'
      })

      tracker.unsubscribe(subscriptionId)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test 2'
      })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      tracker.subscribe(callback1)
      tracker.subscribe(callback2)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should handle errors in subscriber callbacks', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const normalCallback = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      tracker.subscribe(errorCallback)
      tracker.subscribe(normalCallback)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      expect(errorCallback).toHaveBeenCalled()
      expect(normalCallback).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  // ============================================================================
  // Filter Tests
  // ============================================================================

  describe('subscription filters', () => {
    beforeEach(() => {
      tracker.startTracking()
    })

    it('should filter by phase', () => {
      const callback = vi.fn()
      const filter: ProgressFilter = { phases: ['security-audit'] }

      tracker.subscribe(callback, filter)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Init'
      })

      tracker.updateProgress({
        phase: 'security-audit',
        step: 'scan',
        message: 'Scanning'
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'security-audit'
        })
      )
    })

    it('should filter by minimum progress', () => {
      const callback = vi.fn()
      const filter: ProgressFilter = { minProgress: 50 }

      tracker.subscribe(callback, filter)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Low progress',
        progress: 25,
        total: 100
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'High progress',
        progress: 75,
        total: 100
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 75
        })
      )
    })

    it('should filter by maximum progress', () => {
      const callback = vi.fn()
      const filter: ProgressFilter = { maxProgress: 50 }

      tracker.subscribe(callback, filter)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Low progress',
        progress: 25,
        total: 100
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'High progress',
        progress: 75,
        total: 100
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 25
        })
      )
    })

    it('should apply multiple filter criteria', () => {
      const callback = vi.fn()
      const filter: ProgressFilter = {
        phases: ['initialization'],
        minProgress: 25,
        maxProgress: 75
      }

      tracker.subscribe(callback, filter)

      tracker.updateProgress({
        phase: 'security-audit',
        step: 'scan',
        message: 'Wrong phase',
        progress: 50,
        total: 100
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Too low',
        progress: 10,
        total: 100
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Just right',
        progress: 50,
        total: 100
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Just right'
        })
      )
    })
  })

  // ============================================================================
  // Progress Summary Tests
  // ============================================================================

  describe('getProgressSummary', () => {
    beforeEach(() => {
      tracker.startTracking()
    })

    it('should calculate overall progress across phases', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Initializing',
        progress: 50,
        total: 100
      })

      const summary = tracker.getProgressSummary()

      expect(summary.overallProgress).toBeGreaterThan(0)
      expect(summary.overallProgress).toBeLessThanOrEqual(100)
    })

    it('should count errors in history', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Error occurred during setup'
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Normal message'
      })

      const summary = tracker.getProgressSummary()
      expect(summary.errors).toBe(1)
    })

    it('should count warnings in history', () => {
      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Warning: deprecated dependency'
      })

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Normal message'
      })

      const summary = tracker.getProgressSummary()
      expect(summary.warnings).toBe(1)
    })

    it('should track time elapsed', () => {
      const startTime = Date.now()
      vi.setSystemTime(startTime)

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Starting'
      })

      vi.advanceTimersByTime(5000) // 5 seconds

      const summary = tracker.getProgressSummary()
      expect(summary.timeElapsed).toBe(5000)
    })
  })

  // ============================================================================
  // History Management Tests
  // ============================================================================

  describe('getProgressHistory and clearHistory', () => {
    it('should return copy of progress history', () => {
      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      const history = tracker.getProgressHistory()
      history.push({} as any) // Mutate the returned array

      const history2 = tracker.getProgressHistory()
      expect(history2).toHaveLength(1) // Original not affected
    })

    it('should clear progress history', () => {
      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      tracker.clearHistory()

      const history = tracker.getProgressHistory()
      expect(history).toHaveLength(0)
    })
  })

  // ============================================================================
  // Formatting Tests
  // ============================================================================

  describe('formatProgressForConsole', () => {
    it('should format progress update with percentage and bar', () => {
      const update: ProgressUpdate = {
        id: 'test-1',
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up',
        progress: 50,
        total: 100,
        timestamp: new Date()
      }

      const formatted = tracker.formatProgressForConsole(update)

      expect(formatted).toContain('INITIALIZATION')
      expect(formatted).toContain('50.0%')
      expect(formatted).toContain('Setting up')
      expect(formatted).toMatch(/[█░]+/) // Progress bar characters
    })

    it('should include estimated time remaining if available', () => {
      const update: ProgressUpdate = {
        id: 'test-1',
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up',
        progress: 50,
        total: 100,
        timestamp: new Date(),
        estimatedTimeRemaining: 30000 // 30 seconds
      }

      const formatted = tracker.formatProgressForConsole(update)

      expect(formatted).toContain('ETA:')
      expect(formatted).toContain('30s')
    })
  })

  // ============================================================================
  // Export Tests
  // ============================================================================

  describe('exportProgressData', () => {
    it('should export all progress data', () => {
      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test',
        progress: 50,
        total: 100
      })

      const exported = tracker.exportProgressData()

      expect(exported).toHaveProperty('startTime')
      expect(exported).toHaveProperty('currentProgress')
      expect(exported).toHaveProperty('progressHistory')
      expect(exported).toHaveProperty('summary')
      expect(exported).toHaveProperty('phaseWeights')
    })

    it('should include phase weights as object', () => {
      const exported = tracker.exportProgressData()

      expect(exported.phaseWeights).toBeDefined()
      expect(typeof exported.phaseWeights).toBe('object')
    })
  })

  // ============================================================================
  // Estimated Time Calculation Tests
  // ============================================================================

  describe('estimated time calculation', () => {
    it('should calculate estimated time remaining based on progress', () => {
      const startTime = Date.now()
      vi.setSystemTime(startTime)

      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Starting',
        progress: 25,
        total: 100
      })

      vi.advanceTimersByTime(10000) // 10 seconds elapsed for 25% progress

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Continuing',
        progress: 25,
        total: 100
      })

      const history = tracker.getProgressHistory()
      const lastUpdate = history[history.length - 1]

      // At 25% progress after 10s, estimated total time is 40s
      // So 30s remaining
      expect(lastUpdate.estimatedTimeRemaining).toBeGreaterThan(0)
    })

    it('should return undefined when progress is zero', () => {
      tracker.startTracking()

      tracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Starting',
        progress: 0,
        total: 100
      })

      const history = tracker.getProgressHistory()
      expect(history[0].estimatedTimeRemaining).toBeUndefined()
    })
  })
})
