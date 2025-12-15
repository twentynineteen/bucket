import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * Test suite for logger utility
 *
 * This test suite follows TDD methodology to ensure:
 * 1. Logger works correctly in development mode
 * 2. Logger is silent in production mode
 * 3. Namespaced loggers work correctly
 * 4. Error and warn levels are supported
 * 5. All console methods are properly wrapped
 */

describe('logger utility', () => {
  let originalEnv: string | undefined
  let consoleSpies: Record<string, ReturnType<typeof vi.spyOn>>

  beforeEach(() => {
    // Save original environment
    originalEnv = import.meta.env.DEV

    // Create spies for all console methods
    consoleSpies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      table: vi.spyOn(console, 'table').mockImplementation(() => {}),
      time: vi.spyOn(console, 'time').mockImplementation(() => {}),
      timeEnd: vi.spyOn(console, 'timeEnd').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    // Restore all spies
    Object.values(consoleSpies).forEach(spy => spy.mockRestore())

    // Restore environment
    if (originalEnv !== undefined) {
      import.meta.env.DEV = originalEnv
    }

    // Clear module cache to get fresh logger instance
    vi.resetModules()
  })

  describe('development mode', () => {
    beforeEach(async () => {
      import.meta.env.DEV = true
      vi.resetModules()
    })

    describe('basic logging methods', () => {
      test('log() should call console.log', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.log('test message', { data: 'value' })

        expect(consoleSpies.log).toHaveBeenCalledWith('test message', { data: 'value' })
        expect(consoleSpies.log).toHaveBeenCalledTimes(1)
      })

      test('info() should call console.info', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.info('info message')

        expect(consoleSpies.info).toHaveBeenCalledWith('info message')
        expect(consoleSpies.info).toHaveBeenCalledTimes(1)
      })

      test('debug() should call console.debug', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.debug('debug message', 123)

        expect(consoleSpies.debug).toHaveBeenCalledWith('debug message', 123)
        expect(consoleSpies.debug).toHaveBeenCalledTimes(1)
      })

      test('trace() should call console.trace', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.trace('trace message')

        expect(consoleSpies.trace).toHaveBeenCalledWith('trace message')
        expect(consoleSpies.trace).toHaveBeenCalledTimes(1)
      })
    })

    describe('error and warn methods (NEW)', () => {
      test('error() should call console.error', async () => {
        const { logger } = await import('../../../src/utils/logger')
        const error = new Error('test error')
        logger.error('Error occurred:', error)

        expect(consoleSpies.error).toHaveBeenCalledWith('Error occurred:', error)
        expect(consoleSpies.error).toHaveBeenCalledTimes(1)
      })

      test('warn() should call console.warn', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.warn('Warning message', { detail: 'info' })

        expect(consoleSpies.warn).toHaveBeenCalledWith('Warning message', {
          detail: 'info'
        })
        expect(consoleSpies.warn).toHaveBeenCalledTimes(1)
      })

      test('error() should handle multiple arguments', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.error('Multiple', 'error', 'arguments', 123)

        expect(consoleSpies.error).toHaveBeenCalledWith(
          'Multiple',
          'error',
          'arguments',
          123
        )
      })

      test('warn() should handle objects and primitives', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.warn('Warning:', { code: 404 }, 'Not found')

        expect(consoleSpies.warn).toHaveBeenCalledWith(
          'Warning:',
          { code: 404 },
          'Not found'
        )
      })
    })

    describe('grouping methods', () => {
      test('group() should call console.group', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.group('Test Group')

        expect(consoleSpies.group).toHaveBeenCalledWith('Test Group')
        expect(consoleSpies.group).toHaveBeenCalledTimes(1)
      })

      test('groupEnd() should call console.groupEnd', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.groupEnd()

        expect(consoleSpies.groupEnd).toHaveBeenCalledTimes(1)
      })

      test('group and groupEnd should work together', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.group('Nested logs')
        logger.log('Inside group')
        logger.groupEnd()

        expect(consoleSpies.group).toHaveBeenCalledWith('Nested logs')
        expect(consoleSpies.log).toHaveBeenCalledWith('Inside group')
        expect(consoleSpies.groupEnd).toHaveBeenCalledTimes(1)
      })
    })

    describe('utility methods', () => {
      test('table() should call console.table', async () => {
        const { logger } = await import('../../../src/utils/logger')
        const data = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 }
        ]
        logger.table(data)

        expect(consoleSpies.table).toHaveBeenCalledWith(data)
        expect(consoleSpies.table).toHaveBeenCalledTimes(1)
      })

      test('time() should call console.time', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.time('operation')

        expect(consoleSpies.time).toHaveBeenCalledWith('operation')
        expect(consoleSpies.time).toHaveBeenCalledTimes(1)
      })

      test('timeEnd() should call console.timeEnd', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.timeEnd('operation')

        expect(consoleSpies.timeEnd).toHaveBeenCalledWith('operation')
        expect(consoleSpies.timeEnd).toHaveBeenCalledTimes(1)
      })

      test('time and timeEnd should work together', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.time('test-timer')
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10))
        logger.timeEnd('test-timer')

        expect(consoleSpies.time).toHaveBeenCalledWith('test-timer')
        expect(consoleSpies.timeEnd).toHaveBeenCalledWith('test-timer')
      })
    })

    describe('multiple arguments support', () => {
      test('should handle no arguments', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.log()

        expect(consoleSpies.log).toHaveBeenCalledWith()
      })

      test('should handle single argument', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.log('single')

        expect(consoleSpies.log).toHaveBeenCalledWith('single')
      })

      test('should handle multiple mixed-type arguments', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.log('string', 123, true, { obj: 'value' }, ['array'])

        expect(consoleSpies.log).toHaveBeenCalledWith(
          'string',
          123,
          true,
          { obj: 'value' },
          ['array']
        )
      })
    })
  })

  describe('production mode', () => {
    beforeEach(async () => {
      import.meta.env.DEV = false
      vi.resetModules()
    })

    test('log() should not call console.log', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.log('test message')

      expect(consoleSpies.log).not.toHaveBeenCalled()
    })

    test('info() should not call console.info', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.info('info message')

      expect(consoleSpies.info).not.toHaveBeenCalled()
    })

    test('debug() should not call console.debug', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.debug('debug message')

      expect(consoleSpies.debug).not.toHaveBeenCalled()
    })

    test('trace() should not call console.trace', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.trace('trace message')

      expect(consoleSpies.trace).not.toHaveBeenCalled()
    })

    describe('error and warn in production', () => {
      test('error() should NOT call console.error in production', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.error('Error message')

        expect(consoleSpies.error).not.toHaveBeenCalled()
      })

      test('warn() should NOT call console.warn in production', async () => {
        const { logger } = await import('../../../src/utils/logger')
        logger.warn('Warning message')

        expect(consoleSpies.warn).not.toHaveBeenCalled()
      })
    })

    test('group() should not call console.group', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.group('Group')

      expect(consoleSpies.group).not.toHaveBeenCalled()
    })

    test('groupEnd() should not call console.groupEnd', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.groupEnd()

      expect(consoleSpies.groupEnd).not.toHaveBeenCalled()
    })

    test('table() should not call console.table', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.table([])

      expect(consoleSpies.table).not.toHaveBeenCalled()
    })

    test('time() should not call console.time', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.time('timer')

      expect(consoleSpies.time).not.toHaveBeenCalled()
    })

    test('timeEnd() should not call console.timeEnd', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.timeEnd('timer')

      expect(consoleSpies.timeEnd).not.toHaveBeenCalled()
    })

    test('all methods should be callable without errors', async () => {
      const { logger } = await import('../../../src/utils/logger')

      expect(() => {
        logger.log('test')
        logger.info('test')
        logger.debug('test')
        logger.trace('test')
        logger.error('test')
        logger.warn('test')
        logger.group('test')
        logger.groupEnd()
        logger.table([])
        logger.time('test')
        logger.timeEnd('test')
      }).not.toThrow()
    })
  })

  describe('createNamespacedLogger', () => {
    beforeEach(async () => {
      import.meta.env.DEV = true
      vi.resetModules()
    })

    test('should prefix log messages with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('MyComponent')

      log.log('test message')

      expect(consoleSpies.log).toHaveBeenCalledWith('[MyComponent]', 'test message')
    })

    test('should prefix info messages with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('Service')

      log.info('info message', { data: 123 })

      expect(consoleSpies.info).toHaveBeenCalledWith('[Service]', 'info message', {
        data: 123
      })
    })

    test('should prefix debug messages with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('Utils')

      log.debug('debug message')

      expect(consoleSpies.debug).toHaveBeenCalledWith('[Utils]', 'debug message')
    })

    test('should prefix trace messages with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('API')

      log.trace('trace message')

      expect(consoleSpies.trace).toHaveBeenCalledWith('[API]', 'trace message')
    })

    test('should prefix error messages with namespace (NEW)', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('ErrorHandler')

      log.error('error occurred', new Error('test'))

      expect(consoleSpies.error).toHaveBeenCalledWith(
        '[ErrorHandler]',
        'error occurred',
        expect.any(Error)
      )
    })

    test('should prefix warn messages with namespace (NEW)', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('Validator')

      log.warn('validation warning')

      expect(consoleSpies.warn).toHaveBeenCalledWith('[Validator]', 'validation warning')
    })

    test('should prefix group labels with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('Module')

      log.group('Operation')

      expect(consoleSpies.group).toHaveBeenCalledWith('[Module] Operation')
    })

    test('should prefix time labels with namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('Performance')

      log.time('operation')
      log.timeEnd('operation')

      expect(consoleSpies.time).toHaveBeenCalledWith('[Performance] operation')
      expect(consoleSpies.timeEnd).toHaveBeenCalledWith('[Performance] operation')
    })

    test('should not prefix in production mode', async () => {
      import.meta.env.DEV = false
      vi.resetModules()

      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('MyComponent')

      log.log('test message')
      log.error('error message')
      log.warn('warn message')

      expect(consoleSpies.log).not.toHaveBeenCalled()
      expect(consoleSpies.error).not.toHaveBeenCalled()
      expect(consoleSpies.warn).not.toHaveBeenCalled()
    })

    test('should handle special characters in namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('My-Component:v2.0')

      log.info('test')

      expect(consoleSpies.info).toHaveBeenCalledWith('[My-Component:v2.0]', 'test')
    })

    test('should handle empty namespace', async () => {
      const { createNamespacedLogger } = await import('../../../src/utils/logger')
      const log = createNamespacedLogger('')

      log.log('test')

      expect(consoleSpies.log).toHaveBeenCalledWith('[]', 'test')
    })
  })

  describe('edge cases', () => {
    beforeEach(async () => {
      import.meta.env.DEV = true
      vi.resetModules()
    })

    test('should handle null values', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.log(null)

      expect(consoleSpies.log).toHaveBeenCalledWith(null)
    })

    test('should handle undefined values', async () => {
      const { logger } = await import('../../../src/utils/logger')
      logger.log(undefined)

      expect(consoleSpies.log).toHaveBeenCalledWith(undefined)
    })

    test('should handle circular references', async () => {
      const { logger } = await import('../../../src/utils/logger')
      const circular: any = { name: 'test' }
      circular.self = circular

      expect(() => {
        logger.log(circular)
      }).not.toThrow()
    })

    test('should handle very long strings', async () => {
      const { logger } = await import('../../../src/utils/logger')
      const longString = 'x'.repeat(10000)

      expect(() => {
        logger.log(longString)
      }).not.toThrow()

      expect(consoleSpies.log).toHaveBeenCalledWith(longString)
    })

    test('should handle Error objects', async () => {
      const { logger } = await import('../../../src/utils/logger')
      const error = new Error('Test error')
      error.stack = 'Mock stack trace'

      logger.error('Error occurred:', error)

      expect(consoleSpies.error).toHaveBeenCalledWith('Error occurred:', error)
    })
  })

  describe('type safety', () => {
    test('logger should have correct method signatures', async () => {
      const { logger } = await import('../../../src/utils/logger')

      // These should compile without errors (checked by TypeScript)
      logger.log('string')
      logger.info(123)
      logger.debug(true)
      logger.trace({ obj: 'value' })
      logger.error(new Error('test'))
      logger.warn('warning', { detail: 'info' })
      logger.group('label')
      logger.groupEnd()
      logger.table([1, 2, 3])
      logger.time('timer')
      logger.timeEnd('timer')

      // Type check passes if this compiles
      expect(true).toBe(true)
    })
  })
})
