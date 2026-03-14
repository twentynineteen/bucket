/**
 * Logger utility for development and debugging
 *
 * This logger only outputs in development mode to prevent
 * information leakage and console clutter in production.
 *
 * Usage:
 *   import { logger } from 'utils/logger'
 *   logger.log('Debug info', data)
 *   logger.info('Info message')
 *   logger.debug('Detailed debug info')
 *   logger.error('Error occurred', error)
 *   logger.warn('Warning message', details)
 *
 * All logging methods (including error and warn) are disabled in production
 * to prevent console pollution and information leakage.
 */

const isDevelopment = import.meta.env.DEV

interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  trace: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  group: (label: string) => void
  groupEnd: () => void
  table: (data: unknown) => void
  time: (label: string) => void
  timeEnd: (label: string) => void
}

function createLogger(): Logger {
  const noop = () => {}

  if (!isDevelopment) {
    return {
      log: noop,
      info: noop,
      debug: noop,
      trace: noop,
      error: noop,
      warn: noop,
      group: noop,
      groupEnd: noop,
      table: noop,
      time: noop,
      timeEnd: noop
    }
  }

  return {
    log: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.log(...args)
    },
    info: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.info(...args)
    },
    debug: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.debug(...args)
    },
    trace: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.trace(...args)
    },
    error: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.error(...args)
    },
    warn: (...args: unknown[]) => {
      // eslint-disable-next-line no-console
      console.warn(...args)
    },
    group: (label: string) => {
      // eslint-disable-next-line no-console
      console.group(label)
    },
    groupEnd: () => {
      // eslint-disable-next-line no-console
      console.groupEnd()
    },
    table: (data: unknown) => {
      // eslint-disable-next-line no-console
      console.table(data)
    },
    time: (label: string) => {
      // eslint-disable-next-line no-console
      console.time(label)
    },
    timeEnd: (label: string) => {
      // eslint-disable-next-line no-console
      console.timeEnd(label)
    }
  }
}

export const logger = createLogger()

/**
 * Create a namespaced logger for a specific module
 *
 * Usage:
 *   const log = createNamespacedLogger('MyComponent')
 *   log.info('Component mounted') // Output: [MyComponent] Component mounted
 */
export function createNamespacedLogger(namespace: string): Logger {
  const baseLogger = createLogger()

  if (!isDevelopment) {
    return baseLogger
  }

  const prefix = `[${namespace}]`

  return {
    log: (...args: unknown[]) => baseLogger.log(prefix, ...args),
    info: (...args: unknown[]) => baseLogger.info(prefix, ...args),
    debug: (...args: unknown[]) => baseLogger.debug(prefix, ...args),
    trace: (...args: unknown[]) => baseLogger.trace(prefix, ...args),
    error: (...args: unknown[]) => baseLogger.error(prefix, ...args),
    warn: (...args: unknown[]) => baseLogger.warn(prefix, ...args),
    group: (label: string) => baseLogger.group(`${prefix} ${label}`),
    groupEnd: baseLogger.groupEnd,
    table: baseLogger.table,
    time: (label: string) => baseLogger.time(`${prefix} ${label}`),
    timeEnd: (label: string) => baseLogger.timeEnd(`${prefix} ${label}`)
  }
}
