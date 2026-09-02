/**
 * WBS video-title naming conventions (issue #270)
 *
 * The Sprout title convention, as the twelve categories WBS records videos in,
 * plus the pure logic the guide runs against a typed title. Two rules matter and
 * they are different in kind:
 *
 * - the **colon rule** is hard - a colon breaks the Sprout embed code, so a
 *   title carrying one cannot be uploaded (attested WBS convention);
 * - the **shape check** is advisory - it can only tell how many " - " parts a
 *   title has and whether a fixed word like "PTES" is where it should be. It
 *   cannot tell Module content from Events from wbsLive, because all three are
 *   simply three parts. A positive result means "plausible shape for the
 *   category you picked", never "provably the right category".
 *
 * Every `example` is an illustrative placeholder: fabricated codes, presenters
 * and titles that show the shape and name no real module or person. The Trello
 * card convention (richer, and carrying a `(mm:ss mins)` duration the app adds
 * itself after upload) is shown read-only where WBS supplied one.
 */

/** The category whose "shape" cannot be judged - free-form or opted out. */
export const OTHER_CATEGORY_ID = 'other'

/** The category selected until someone picks another. */
export const DEFAULT_CATEGORY_ID = 'module-content'

export interface NamingCategory {
  /** Stable id, also the persisted value and the Select item value. */
  id: string
  /** Human label for the picker. */
  label: string
  /** The Sprout title shape, in words. */
  sproutTemplate: string
  /** An illustrative title in that shape - a placeholder, never real. */
  example: string
  /** The richer Trello card shape, where WBS supplied one. */
  trelloReference?: string
  /**
   * Whether a title plausibly fits this category. `parts` is the title split on
   * " - " (hyphen or en-dash), `allFilled` is true when no part is empty.
   */
  matches: (parts: string[], allFilled: boolean) => boolean
}

/** Three non-empty parts, the commonest shape. */
const threeParts = (parts: string[], allFilled: boolean): boolean =>
  parts.length === 3 && allFilled

export const NAMING_CATEGORIES: NamingCategory[] = [
  {
    id: 'module-overview',
    label: 'Module overview',
    sproutTemplate: 'Module code - Presenter - Module overview',
    example: 'AB123X - A Smith - Module overview',
    trelloReference:
      'Programme - Module code and name - Presenter - Video title (mm:ss mins)',
    matches: (parts, allFilled) =>
      threeParts(parts, allFilled) && parts[2].toLowerCase() === 'module overview'
  },
  {
    id: 'elective-promotional-module-overview',
    label: 'Elective promotional module overview',
    sproutTemplate: 'Module code - Presenter - Module overview',
    example: 'AB456Y - B Jones - Module overview',
    matches: (parts, allFilled) =>
      threeParts(parts, allFilled) && parts[2].toLowerCase() === 'module overview'
  },
  {
    id: 'lesson-introductions',
    label: 'Lesson introductions',
    sproutTemplate: 'Module code - Presenter - Introduction - Introduction title',
    example: 'AB123X - C Patel - Introduction - Understanding the fundamentals',
    matches: (parts, allFilled) =>
      parts.length === 4 && allFilled && parts[2].toLowerCase() === 'introduction'
  },
  {
    id: 'module-content',
    label: 'Module content',
    sproutTemplate: 'Module code - Presenter - Video title',
    example: 'AB123X - D Okafor - Core principles explained',
    trelloReference:
      'Programme - Module code and name - Lx - Presenter - Video title (mm:ss mins)',
    matches: threeParts
  },
  {
    id: 'interview-with-guest-speaker',
    label: 'Interview with guest speaker',
    sproutTemplate: 'Module code - Presenter - Interview with (full name)',
    example: 'AB789Z - E Rossi - Interview with Alex Taylor',
    matches: (parts, allFilled) =>
      threeParts(parts, allFilled) && parts[2].toLowerCase().startsWith('interview with')
  },
  {
    id: 'two-presenters',
    label: 'Two presenters',
    sproutTemplate: 'Module code - Presenter and Presenter - Video title',
    example: 'AB321W - F Nguyen and G Adeyemi - Working across teams',
    matches: (parts, allFilled) =>
      threeParts(parts, allFilled) && /\sand\s/i.test(parts[1])
  },
  {
    id: 'file-used-on-multiple-modules',
    label: 'File used on more than 1 module',
    sproutTemplate: 'Module code Module code - Presenter - Video title',
    example: 'AB123X AB456Y - H Larsson - An overview of the field',
    matches: (parts, allFilled) => threeParts(parts, allFilled) && /\s/.test(parts[0])
  },
  {
    id: 'programme-information',
    label: 'Programme information',
    sproutTemplate: 'Title of video',
    example: 'Working with online groups',
    trelloReference: 'Programme - Presenter - Video title (mm:ss mins)',
    matches: (parts, allFilled) => parts.length === 1 && allFilled
  },
  {
    id: 'ptes',
    label: 'PTES',
    sproutTemplate: 'Programme - Presenter - PTES',
    example: 'PROG1 - A Smith - PTES',
    trelloReference: 'Programme - Presenter - PTES (mm:ss mins)',
    matches: (parts, allFilled) =>
      threeParts(parts, allFilled) && parts[2].toLowerCase() === 'ptes'
  },
  {
    id: 'events-conferences',
    label: 'Events/conferences',
    sproutTemplate: 'Event name - Presenter - Video title',
    example: 'Annual Conference - B Jones - My story',
    trelloReference: 'Title of event - Presenter - Video title (mm:ss mins)',
    matches: threeParts
  },
  {
    id: 'wbslive-recording',
    label: 'wbsLive recording',
    sproutTemplate: 'Module name - Presenter - Video title',
    example: 'AB654V - C Patel - An introduction to the method',
    matches: threeParts
  },
  {
    id: 'group-presentations',
    label: 'Group presentations',
    sproutTemplate: 'Module name - Academic year - Group X',
    example: 'AB123X - 2025-2026 - #1 - Group 1',
    matches: (parts, allFilled) =>
      parts.length >= 3 &&
      allFilled &&
      /\d{4}-\d{4}/.test(parts.join(' - ')) &&
      /group|#/i.test(parts.join(' - '))
  }
]

/** A colon breaks the Sprout embed code, so any title carrying one is blocked. */
export function hasColon(title: string): boolean {
  return title.includes(':')
}

/**
 * Removes every colon and tidies the gap it leaves: runs of two or more spaces
 * collapse to one (so a colon next to a " - " separator does not damage it), and
 * the ends are trimmed. A title of only colons collapses to empty, which the
 * upload flow reads as "use the filename".
 */
export function stripColons(title: string): string {
  return title.replace(/:/g, '').replace(/ {2,}/g, ' ').trim()
}

export type MatchResult = 'match' | 'mismatch' | 'none'

/**
 * Whether a typed title plausibly fits the selected category. `'none'` for the
 * "other" category and any unknown id, where no judgement is offered.
 */
export function matchTitle(title: string, categoryId: string): MatchResult {
  if (categoryId === OTHER_CATEGORY_ID) return 'none'
  const category = NAMING_CATEGORIES.find((c) => c.id === categoryId)
  if (!category) return 'none'

  const parts = title.split(/\s+[–-]\s+/).map((part) => part.trim())
  const allFilled = parts.every((part) => part.length > 0)
  return category.matches(parts, allFilled) ? 'match' : 'mismatch'
}

/** Whether an id names a real category the guide can judge against. */
export function isKnownCategory(categoryId: string): boolean {
  return (
    categoryId === OTHER_CATEGORY_ID || NAMING_CATEGORIES.some((c) => c.id === categoryId)
  )
}
