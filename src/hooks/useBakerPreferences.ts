/**
 * useBakerPreferences Hook
 *
 * Custom React hook for managing Baker user preferences.
 * Handles localStorage persistence and validation.
 */

import { useCallback, useState } from 'react'

import type { ScanPreferences, UseBakerPreferencesResult } from '@/types/baker'
import { logger } from '@/utils/logger'

const STORAGE_KEY = 'baker-preferences'

const DEFAULT_PREFERENCES: ScanPreferences = {
  autoUpdate: false,
  createMissing: true,
  backupOriginals: true,
  maxDepth: 10,
  includeHidden: false,
  confirmBulkOperations: true
}

function validatePreferences(prefs: Partial<ScanPreferences>): ScanPreferences {
  return {
    autoUpdate:
      typeof prefs.autoUpdate === 'boolean'
        ? prefs.autoUpdate
        : DEFAULT_PREFERENCES.autoUpdate,
    createMissing:
      typeof prefs.createMissing === 'boolean'
        ? prefs.createMissing
        : DEFAULT_PREFERENCES.createMissing,
    backupOriginals:
      typeof prefs.backupOriginals === 'boolean'
        ? prefs.backupOriginals
        : DEFAULT_PREFERENCES.backupOriginals,
    maxDepth:
      typeof prefs.maxDepth === 'number' && prefs.maxDepth > 0 && prefs.maxDepth <= 100
        ? prefs.maxDepth
        : DEFAULT_PREFERENCES.maxDepth,
    includeHidden:
      typeof prefs.includeHidden === 'boolean'
        ? prefs.includeHidden
        : DEFAULT_PREFERENCES.includeHidden,
    confirmBulkOperations:
      typeof prefs.confirmBulkOperations === 'boolean'
        ? prefs.confirmBulkOperations
        : DEFAULT_PREFERENCES.confirmBulkOperations
  }
}

function loadPreferencesFromStorage(): ScanPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return validatePreferences(parsed)
    }
  } catch (error) {
    logger.warn('Failed to load Baker preferences from localStorage:', error)
  }

  return DEFAULT_PREFERENCES
}

function savePreferencesToStorage(preferences: ScanPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    logger.warn('Failed to save Baker preferences to localStorage:', error)
  }
}

export function useBakerPreferences(): UseBakerPreferencesResult {
  const [preferences, setPreferences] = useState<ScanPreferences>(
    loadPreferencesFromStorage
  )

  const updatePreferences = useCallback((newPrefs: Partial<ScanPreferences>) => {
    setPreferences((currentPrefs) => {
      const validatedPrefs = validatePreferences({ ...currentPrefs, ...newPrefs })
      savePreferencesToStorage(validatedPrefs)
      return validatedPrefs
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    savePreferencesToStorage(DEFAULT_PREFERENCES)
  }, [])

  return {
    preferences,
    updatePreferences,
    resetToDefaults
  }
}
