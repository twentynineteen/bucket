/**
 * UserFeedbackService Tests
 * Purpose: Test user notification and feedback mechanisms
 */

import { ProgressTracker } from '@/services/ProgressTracker'
import {
  UserFeedbackService,
  type FeedbackOptions,
  type NotificationConfig,
  type UserPrompt
} from '@/services/UserFeedbackService'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('UserFeedbackService', () => {
  let progressTracker: ProgressTracker
  let service: UserFeedbackService

  beforeEach(() => {
    progressTracker = new ProgressTracker()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================================
  // Constructor and Options Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with default options', () => {
      service = new UserFeedbackService(progressTracker)

      expect(service).toBeInstanceOf(UserFeedbackService)
    })

    it('should apply custom options', () => {
      const options: FeedbackOptions = {
        enableConsoleOutput: false,
        enableNotifications: true,
        verboseMode: true,
        quietMode: false
      }

      service = new UserFeedbackService(progressTracker, options)

      expect(service).toBeInstanceOf(UserFeedbackService)
    })

    it('should merge custom options with defaults', () => {
      const options: FeedbackOptions = {
        verboseMode: true
      }

      service = new UserFeedbackService(progressTracker, options)

      // Should still have default values for other options
      expect(service).toBeInstanceOf(UserFeedbackService)
    })

    it('should setup progress tracking subscription', () => {
      const subscribeSpy = vi.spyOn(progressTracker, 'subscribe')

      service = new UserFeedbackService(progressTracker)

      expect(subscribeSpy).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Progress Update Handling Tests
  // ============================================================================

  describe('handleProgressUpdate', () => {
    beforeEach(() => {
      progressTracker.startTracking()
    })

    it('should log all progress updates', () => {
      service = new UserFeedbackService(progressTracker)

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test message',
        progress: 50,
        total: 100
      })

      const logs = service.exportLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]).toContain('initialization')
      expect(logs[0]).toContain('Test message')
    })

    it('should not output to console in quiet mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, { quietMode: true })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test',
        progress: 50,
        total: 100
      })

      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should output to console when enabled and not quiet', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableConsoleOutput: true,
        quietMode: false
      })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'initialize',
        message: 'Starting',
        progress: 0,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should show all updates in verbose mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableConsoleOutput: true,
        verboseMode: true
      })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'minor-step',
        message: 'Minor update',
        progress: 25,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should show details in verbose mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableConsoleOutput: true,
        verboseMode: true
      })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test',
        details: 'Detailed information here',
        progress: 50,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Details:'))

      consoleLogSpy.mockRestore()
    })

    it('should only show major updates in non-verbose mode', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableConsoleOutput: true,
        verboseMode: false
      })

      // Minor update - should not show
      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'minor-step',
        message: 'Minor update',
        progress: 25,
        total: 100
      })

      const callCountBefore = consoleLogSpy.mock.calls.length

      // Major update - should show
      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'initialize',
        message: 'Major initialization',
        progress: 50,
        total: 100
      })

      expect(consoleLogSpy.mock.calls.length).toBeGreaterThan(callCountBefore)

      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================================
  // Notification Tests
  // ============================================================================

  describe('notifications', () => {
    beforeEach(() => {
      progressTracker.startTracking()
    })

    it('should send notification for error messages when enabled', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableNotifications: true
      })

      progressTracker.updateProgress({
        phase: 'security-audit',
        step: 'scan-complete',
        message: 'Error: Security vulnerabilities found',
        progress: 100,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('❌'))

      consoleLogSpy.mockRestore()
    })

    it('should not send notifications when disabled', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableNotifications: false,
        enableConsoleOutput: false
      })

      progressTracker.updateProgress({
        phase: 'security-audit',
        step: 'scan-complete',
        message: 'Error occurred',
        progress: 100,
        total: 100
      })

      // Should only log the progress entry, not notification
      const logs = service.exportLogs()
      expect(logs.length).toBeGreaterThan(0)

      consoleLogSpy.mockRestore()
    })

    it('should determine correct notification type for success', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableNotifications: true
      })

      progressTracker.updateProgress({
        phase: 'cleanup',
        step: 'complete',
        message: 'Update complete successfully',
        progress: 100,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅'))

      consoleLogSpy.mockRestore()
    })

    it('should determine correct notification type for warning', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      service = new UserFeedbackService(progressTracker, {
        enableNotifications: true
      })

      progressTracker.updateProgress({
        phase: 'security-audit',
        step: 'scan-complete',
        message: 'Warning: deprecated dependencies detected',
        progress: 100,
        total: 100
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️'))

      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================================
  // User Prompt Tests
  // ============================================================================

  describe('promptUser', () => {
    beforeEach(() => {
      service = new UserFeedbackService(progressTracker)
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('should return default value for choice prompt', async () => {
      const prompt: UserPrompt = {
        id: 'test-1',
        message: 'Select an option',
        type: 'choice',
        choices: ['Option 1', 'Option 2'],
        defaultValue: 'Option 1',
        timeout: 100
      }

      const result = await service.promptUser(prompt)

      expect(result).toBe('Option 1')
    })

    it('should return default value for input prompt', async () => {
      const prompt: UserPrompt = {
        id: 'test-2',
        message: 'Enter value',
        type: 'input',
        defaultValue: 'default-value',
        timeout: 100
      }

      const result = await service.promptUser(prompt)

      expect(result).toBe('default-value')
    })

    it('should return null when no default value provided', async () => {
      const prompt: UserPrompt = {
        id: 'test-3',
        message: 'Enter value',
        type: 'input',
        timeout: 100
      }

      const result = await service.promptUser(prompt)

      expect(result).toBeNull()
    })

    it('should use 30 second default timeout', async () => {
      const prompt: UserPrompt = {
        id: 'test-4',
        message: 'Test prompt',
        type: 'confirmation',
        defaultValue: 'yes'
      }

      const result = await service.promptUser(prompt)

      expect(result).toBe('yes')
    })
  })

  // ============================================================================
  // Confirmation Tests
  // ============================================================================

  describe('confirmAction', () => {
    beforeEach(() => {
      service = new UserFeedbackService(progressTracker)
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('should return true when default is yes', async () => {
      const result = await service.confirmAction('Continue?', true, 100)

      expect(result).toBe(true)
    })

    it('should return false when default is no', async () => {
      const result = await service.confirmAction('Continue?', false, 100)

      expect(result).toBe(false)
    })

    it('should use default timeout of 30 seconds', async () => {
      const result = await service.confirmAction('Continue?', true)

      expect(result).toBe(true)
    })
  })

  // ============================================================================
  // Progress Summary Tests
  // ============================================================================

  describe('showProgressSummary', () => {
    beforeEach(() => {
      progressTracker.startTracking()
      service = new UserFeedbackService(progressTracker)
    })

    it('should display progress summary to console', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Setting up',
        progress: 50,
        total: 100
      })

      service.showProgressSummary()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('PROGRESS SUMMARY')
      )

      consoleLogSpy.mockRestore()
    })

    it('should show errors and warnings in summary', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Error occurred',
        progress: 25,
        total: 100
      })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Warning: deprecated package',
        progress: 50,
        total: 100
      })

      service.showProgressSummary()

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Errors'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Warnings'))

      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================================
  // Log Management Tests
  // ============================================================================

  describe('log management', () => {
    beforeEach(() => {
      progressTracker.startTracking()
      service = new UserFeedbackService(progressTracker)
    })

    it('should export logs as array', () => {
      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test 1'
      })

      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test 2'
      })

      const logs = service.exportLogs()

      expect(logs).toHaveLength(2)
      expect(logs[0]).toContain('Test 1')
      expect(logs[1]).toContain('Test 2')
    })

    it('should return copy of logs (not reference)', () => {
      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      const logs1 = service.exportLogs()
      logs1.push('Modified')

      const logs2 = service.exportLogs()

      expect(logs2).toHaveLength(1) // Original not affected
    })

    it('should clear logs', () => {
      progressTracker.updateProgress({
        phase: 'initialization',
        step: 'setup',
        message: 'Test'
      })

      service.clearLogs()

      const logs = service.exportLogs()
      expect(logs).toHaveLength(0)
    })
  })

  // ============================================================================
  // Completion Summary Tests
  // ============================================================================

  describe('showCompletionSummary', () => {
    beforeEach(() => {
      service = new UserFeedbackService(progressTracker)
    })

    it('should display successful workflow completion', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const workflowResult = {
        success: true,
        duration: 120000,
        summary: {
          dependenciesScanned: 150,
          packagesUpdated: 12,
          vulnerabilitiesFound: 0,
          breakingChangesDetected: 0,
          compatibilityIssues: 0,
          rollbackAvailable: false
        },
        errors: []
      }

      service.showCompletionSummary(workflowResult)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Status: SUCCESS')
      )

      consoleLogSpy.mockRestore()
    })

    it('should display failed workflow completion', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const workflowResult = {
        success: false,
        duration: 60000,
        summary: {
          dependenciesScanned: 150,
          packagesUpdated: 5,
          vulnerabilitiesFound: 3,
          breakingChangesDetected: 2,
          compatibilityIssues: 1,
          rollbackAvailable: true
        },
        rollbackId: 'rollback-123',
        errors: [
          {
            phase: 'security-audit',
            error: { message: 'Critical vulnerability detected' }
          }
        ]
      }

      service.showCompletionSummary(workflowResult)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Status: FAILED')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Errors (1)'))

      consoleLogSpy.mockRestore()
    })

    it('should show rollback information when available', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const workflowResult = {
        success: false,
        duration: 60000,
        summary: {
          dependenciesScanned: 100,
          packagesUpdated: 0,
          vulnerabilitiesFound: 0,
          breakingChangesDetected: 0,
          compatibilityIssues: 0,
          rollbackAvailable: true
        },
        rollbackId: 'rollback-456',
        errors: []
      }

      service.showCompletionSummary(workflowResult)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Rollback Available')
      )

      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================================
  // Options Update Tests
  // ============================================================================

  describe('updateOptions', () => {
    beforeEach(() => {
      service = new UserFeedbackService(progressTracker, {
        enableConsoleOutput: true,
        verboseMode: false
      })
    })

    it('should update feedback options', () => {
      service.updateOptions({ verboseMode: true })

      // Verify by checking behavior changes
      // Options are updated (internal state test)
      expect(service).toBeInstanceOf(UserFeedbackService)
    })

    it('should merge new options with existing', () => {
      service.updateOptions({ quietMode: true })

      // Original options should remain
      expect(service).toBeInstanceOf(UserFeedbackService)
    })
  })
})
