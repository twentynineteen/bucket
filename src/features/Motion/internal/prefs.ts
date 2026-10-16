/**
 * Motion prefs - parse, defaults, toggles, pruning (issue #333)
 *
 * Prefs live in `motion_prefs.json` in the app data dir. Nothing goes into
 * `api_keys.json`. The file is read and written only through Motion api.ts.
 */
import { logger } from '@shared/utils'
import type { MotionCategory, MotionFormat, MotionTarget } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MotionPrefs {
  libraryFolder: string | null
  defaultFormat: MotionFormat
  favourites: string[]
  /** One default per category. Key is the category, value is the template id. */
  defaults: Partial<Record<MotionCategory, string>>
  lastProjectFolder: string | null
  rememberedTargets: MotionTarget[] | null
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_FORMAT: MotionFormat = {
  width: 3840,
  height: 2160,
  fps: 50
}

function defaultPrefs(): MotionPrefs {
  return {
    libraryFolder: null,
    defaultFormat: { ...DEFAULT_FORMAT },
    favourites: [],
    defaults: {},
    lastProjectFolder: null,
    rememberedTargets: null
  }
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/** Whether an unknown value looks like a MotionFormat. */
function isFormat(v: unknown): v is MotionFormat {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    (o.width === 3840 || o.width === 1920) &&
    (o.height === 2160 || o.height === 1080) &&
    typeof o.fps === 'number' &&
    [24, 25, 30, 50, 60].includes(o.fps as number)
  )
}

/**
 * Parse a motion_prefs.json text into MotionPrefs. Returns defaults when the
 * input is null, invalid JSON, or an unknown shape. Logs a warning for the
 * latter two cases but does not rewrite the file.
 */
export function parsePrefs(text: string | null): MotionPrefs {
  if (text === null) return defaultPrefs()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    logger.warn('motion_prefs.json contains invalid JSON - using defaults')
    return defaultPrefs()
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    logger.warn('motion_prefs.json has an unknown shape - using defaults')
    return defaultPrefs()
  }

  const obj = parsed as Record<string, unknown>

  return {
    libraryFolder: typeof obj.libraryFolder === 'string' ? obj.libraryFolder : null,
    defaultFormat: isFormat(obj.defaultFormat)
      ? obj.defaultFormat
      : { ...DEFAULT_FORMAT },
    favourites: Array.isArray(obj.favourites)
      ? obj.favourites.filter((f): f is string => typeof f === 'string')
      : [],
    defaults:
      typeof obj.defaults === 'object' && obj.defaults !== null
        ? Object.fromEntries(
            Object.entries(obj.defaults as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'string'
            )
          )
        : {},
    lastProjectFolder:
      typeof obj.lastProjectFolder === 'string' ? obj.lastProjectFolder : null,
    rememberedTargets: Array.isArray(obj.rememberedTargets)
      ? obj.rememberedTargets.filter((t): t is MotionTarget => typeof t === 'string')
      : null
  }
}

// ---------------------------------------------------------------------------
// Serialise
// ---------------------------------------------------------------------------

/** Serialise prefs to JSON for writing. */
export function serialisePrefs(prefs: MotionPrefs): string {
  return JSON.stringify(prefs, null, 2)
}

// ---------------------------------------------------------------------------
// Pruning (marketplace context only)
// ---------------------------------------------------------------------------

/**
 * Remove favourites and defaults that reference templates no longer in the
 * catalogue. When `catalogueIds` is null (Settings context, which never loads
 * the catalogue), no pruning happens.
 */
export function prunePrefs(
  prefs: MotionPrefs,
  catalogueIds: Set<string> | null
): MotionPrefs {
  if (catalogueIds === null) return prefs

  const favourites = prefs.favourites.filter(id => catalogueIds.has(id))
  const defaults: Partial<Record<MotionCategory, string>> = {}
  for (const [cat, id] of Object.entries(prefs.defaults)) {
    if (id && catalogueIds.has(id)) {
      defaults[cat as MotionCategory] = id
    }
  }

  return { ...prefs, favourites, defaults }
}

// ---------------------------------------------------------------------------
// Defaults per category
// ---------------------------------------------------------------------------

/**
 * Set or unset a template as the default for its category.
 * Only one default per category - setting a new one replaces the old.
 */
export function setDefault(
  prefs: MotionPrefs,
  templateId: string,
  category: MotionCategory,
  on: boolean
): MotionPrefs {
  const defaults = { ...prefs.defaults }
  if (on) {
    defaults[category] = templateId
  } else {
    if (defaults[category] === templateId) {
      delete defaults[category]
    }
  }
  return { ...prefs, defaults }
}

// ---------------------------------------------------------------------------
// Favourite toggle
// ---------------------------------------------------------------------------

/** Toggle a template in the favourites list. */
export function toggleFavourite(prefs: MotionPrefs, templateId: string): MotionPrefs {
  const idx = prefs.favourites.indexOf(templateId)
  const favourites =
    idx >= 0
      ? prefs.favourites.filter((_, i) => i !== idx)
      : [...prefs.favourites, templateId]
  return { ...prefs, favourites }
}

// ---------------------------------------------------------------------------
// Target selection (L1.7)
// ---------------------------------------------------------------------------

/**
 * Apply a remembered target selection to a template's supported targets.
 *
 * For a non-particle template, the remembered set is returned as-is (the
 * caller has already validated they are supported).
 *
 * For a particle template, the intersection of remembered and supported is
 * returned. If the intersection is empty (e.g. remembered `[ae, resolve]` but
 * particles only support `[video, prompt]`), every supported target is returned.
 */
export function applyTargetSelection(
  remembered: MotionTarget[],
  supported: MotionTarget[],
  isParticle: boolean
): MotionTarget[] {
  if (!isParticle) return remembered

  const intersection = remembered.filter(t => supported.includes(t))
  return intersection.length > 0 ? intersection : [...supported]
}
