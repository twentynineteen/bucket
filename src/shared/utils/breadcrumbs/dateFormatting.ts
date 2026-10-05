/**
 * Breadcrumbs Date Formatting Utilities
 *
 * Functions for parsing and formatting dates in breadcrumbs files.
 */

import { format, parse } from 'date-fns'
import { logger } from '../logger'

/**
 * Format breadcrumbs date strings with comprehensive fallback handling
 *
 * Supports multiple date formats:
 * - ISO 8601 strings (RFC3339 from Rust backend)
 * - Legacy format: 'dd/MM/yyyy, HH:mm:ss'
 * - Standard JavaScript Date constructor formats
 *
 * @param dateString - The date string to format
 * @param formatPattern - Optional date-fns format pattern (default: 'PPPpp' for full format)
 * @returns Formatted date string or fallback error message
 */
export function formatBreadcrumbDate(
  dateString: string | null | undefined,
  formatPattern: string = 'PPPpp'
): string {
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return 'Not set'
  }

  try {
    // Try parsing as ISO string first (most common case from Rust backend)
    const isoDate = new Date(dateString)
    if (!isNaN(isoDate.getTime())) {
      return format(isoDate, formatPattern)
    }

    // Fallback to parsing with legacy format (dd/MM/yyyy, HH:mm:ss)
    const parsedDate = parse(dateString, 'dd/MM/yyyy, HH:mm:ss', new Date())
    if (!isNaN(parsedDate.getTime())) {
      return format(parsedDate, formatPattern)
    }

    // Additional fallback for other common formats
    const commonFormats = [
      'yyyy-MM-dd HH:mm:ss',
      'MM/dd/yyyy HH:mm:ss',
      'dd-MM-yyyy HH:mm:ss'
    ]

    for (const fmt of commonFormats) {
      try {
        const testDate = parse(dateString, fmt, new Date())
        if (!isNaN(testDate.getTime())) {
          return format(testDate, formatPattern)
        }
      } catch {
        // Continue to next format
      }
    }

    logger.warn('Unable to parse date string:', dateString)
    return 'Invalid date'
  } catch (error) {
    logger.warn('Error parsing date:', dateString, error)
    return 'Invalid date'
  }
}

/**
 * Simple date formatting for basic locale string output
 * (backward compatibility version)
 */
export function formatBreadcrumbDateSimple(
  dateString: string | null | undefined
): string {
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return 'Not set'
  }

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      logger.warn('Invalid date string received:', dateString)
      return 'Invalid date'
    }
    return date.toLocaleString()
  } catch (error) {
    logger.warn('Error parsing date:', dateString, error)
    return 'Invalid date'
  }
}
