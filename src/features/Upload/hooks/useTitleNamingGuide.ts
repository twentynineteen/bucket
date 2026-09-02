/**
 * useTitleNamingGuide (issue #270, B1/B2)
 *
 * Remembers whether the Sprout title naming guide is shown and which category is
 * selected. localStorage-backed, read defensively, the same shape as the
 * Kavanagh upload preference next door - a preference that cannot be remembered
 * is never worth failing an upload for, and a corrupt or partial stored value
 * must fall back rather than throw.
 *
 * The guide shows by default: a new operator benefits from it, and anyone who
 * finds it in the way unticks it once and it stays gone.
 */

import { logger } from '@shared/utils'
import React from 'react'

import { DEFAULT_CATEGORY_ID, isKnownCategory } from '../internal/namingConventions'

const PREFS_KEY = 'sprout-title-guide-preferences'

interface TitleGuidePreferences {
  showGuide: boolean
  category: string
}

/** Shown by default, on the commonest category (B1.1). */
const DEFAULT_PREFERENCES: TitleGuidePreferences = {
  showGuide: true,
  category: DEFAULT_CATEGORY_ID
}

function loadPreferences(): TitleGuidePreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (!stored) return DEFAULT_PREFERENCES

    const parsed = JSON.parse(stored) as Partial<TitleGuidePreferences>
    return {
      // Shown unless it was explicitly turned off. A future/legacy shape that
      // omits the field, or stores something odd, leaves the guide on.
      showGuide: parsed.showGuide !== false,
      // A stored category is honoured only if it still names a real category,
      // so a removed or misspelt id cannot leave the picker pointing at nothing.
      category:
        typeof parsed.category === 'string' && isKnownCategory(parsed.category)
          ? parsed.category
          : DEFAULT_CATEGORY_ID
    }
  } catch (error) {
    logger.warn('Failed to load title naming-guide preferences:', error)
    return DEFAULT_PREFERENCES
  }
}

function savePreferences(preferences: TitleGuidePreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
  } catch (error) {
    logger.warn('Failed to save title naming-guide preferences:', error)
  }
}

export interface UseTitleNamingGuideResult {
  /** Whether the guide is shown. Remembered across reloads (B1.2/B1.3). */
  showGuide: boolean
  setShowGuide: (show: boolean) => void
  /** The selected category id. Remembered across reloads (B2.4). */
  category: string
  setCategory: (category: string) => void
}

export function useTitleNamingGuide(): UseTitleNamingGuideResult {
  const [prefs, setPrefs] = React.useState<TitleGuidePreferences>(loadPreferences)

  const setShowGuide = React.useCallback((show: boolean) => {
    setPrefs((current) => {
      const next = { ...current, showGuide: show }
      savePreferences(next)
      return next
    })
  }, [])

  const setCategory = React.useCallback((category: string) => {
    setPrefs((current) => {
      const next = { ...current, category }
      savePreferences(next)
      return next
    })
  }, [])

  return {
    showGuide: prefs.showGuide,
    setShowGuide,
    category: prefs.category,
    setCategory
  }
}
