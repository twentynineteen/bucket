/**
 * WBS video-title naming conventions (issue #270)
 *
 * The behaviour under test is the pure logic behind the Sprout title guide: the
 * colon rule that keeps a title embeddable, the "remove colons" repair, and the
 * deliberately-loose per-category shape check. The matcher cannot tell one
 * three-part category from another - that limit is asserted here so nobody later
 * mistakes a green tick for proof the category is right.
 *
 * Every example is an illustrative placeholder - fabricated codes, presenters and
 * titles that only demonstrate the shape, never a real module or person.
 */

import { describe, expect, it } from 'vitest'

import {
  NAMING_CATEGORIES,
  OTHER_CATEGORY_ID,
  hasColon,
  matchTitle,
  stripColons
} from './namingConventions'

describe('hasColon', () => {
  it('B3.1 finds a colon anywhere in the title', () => {
    expect(hasColon('Session 1: Intro')).toBe(true)
    expect(hasColon('A:B')).toBe(true)
  })

  it('B3.3 reports no colon for a clean title', () => {
    expect(hasColon('AB123X - D Okafor - Core principles explained')).toBe(false)
    expect(hasColon('')).toBe(false)
  })
})

describe('stripColons', () => {
  it('B3.2 removes colons and collapses the doubled space they leave', () => {
    expect(stripColons('Session 1: Intro')).toBe('Session 1 Intro')
    expect(stripColons('A:B')).toBe('AB')
  })

  it('B3.2 preserves the " - " separator the matcher depends on', () => {
    // A colon adjacent to a separator must not damage the separator when the
    // resulting double space is collapsed.
    expect(stripColons('A - : B')).toBe('A - B')
  })

  it('B3.2 leaves a title of only colons empty (falls back to use-filename)', () => {
    expect(stripColons('::')).toBe('')
  })

  it('leaves a clean title untouched', () => {
    const clean = 'AB123X - D Okafor - Core principles explained'
    expect(stripColons(clean)).toBe(clean)
  })
})

describe('NAMING_CATEGORIES', () => {
  it('B2.3 lists exactly the 12 agreed WBS categories', () => {
    // The specific set, not a bare count: a changed id is a spec change, and
    // that is what should force this test to be revisited.
    expect(NAMING_CATEGORIES.map((c) => c.id).sort()).toEqual(
      [
        'elective-promotional-module-overview',
        'events-conferences',
        'file-used-on-multiple-modules',
        'group-presentations',
        'interview-with-guest-speaker',
        'lesson-introductions',
        'module-content',
        'module-overview',
        'programme-information',
        'ptes',
        'two-presenters',
        'wbslive-recording'
      ].sort()
    )
  })

  it('every category carries a template and an example', () => {
    for (const category of NAMING_CATEGORIES) {
      expect(category.id).toBeTruthy()
      expect(category.label).toBeTruthy()
      expect(category.sproutTemplate).toBeTruthy()
      expect(category.example).toBeTruthy()
    }
  })

  it('B2.2 carries a Trello reference for the five categories that have one', () => {
    const withReference = NAMING_CATEGORIES.filter((c) => c.trelloReference)
    expect(withReference.map((c) => c.id).sort()).toEqual(
      [
        'events-conferences',
        'module-content',
        'module-overview',
        'programme-information',
        'ptes'
      ].sort()
    )
  })
})

describe('matchTitle', () => {
  it('B4.4/B4.1 every supplied example matches its own category', () => {
    for (const category of NAMING_CATEGORIES) {
      expect(matchTitle(category.example, category.id)).toBe('match')
    }
  })

  it('B4.6 a title of the wrong arity for the category is a mismatch', () => {
    // Module content expects three " - " parts; one part cannot be it.
    expect(matchTitle('Just a bare title', 'module-content')).toBe('mismatch')
    // Lesson introductions expect four parts; three is a mismatch.
    expect(matchTitle('AB123X - C Patel - Decisions', 'lesson-introductions')).toBe(
      'mismatch'
    )
  })

  it('B4.5 a blank title never matches, so the component can suppress the hint', () => {
    expect(matchTitle('', 'module-content')).toBe('mismatch')
  })

  it('B4.3 the "other" category never judges the title', () => {
    expect(matchTitle('anything at all', OTHER_CATEGORY_ID)).toBe('none')
    expect(matchTitle('AB123X - D Okafor - Core principles explained', 'other')).toBe(
      'none'
    )
  })

  it('an unknown category id does not throw and returns none', () => {
    expect(matchTitle('AB123X - D Okafor - Core', 'no-such-category')).toBe('none')
  })

  it('honours the fixed literal where a category has one', () => {
    // Module overview requires the last part to be "Module overview".
    expect(matchTitle('AB123X - A Smith - Module overview', 'module-overview')).toBe(
      'match'
    )
    expect(matchTitle('AB123X - A Smith - Something else', 'module-overview')).toBe(
      'mismatch'
    )
    // PTES requires the last part to be "PTES".
    expect(matchTitle('PROG1 - A Smith - PTES', 'ptes')).toBe('match')
    expect(matchTitle('PROG1 - A Smith - Not it', 'ptes')).toBe('mismatch')
  })

  it('two presenters needs an " and " in the presenter part', () => {
    expect(
      matchTitle(
        'AB321W - F Nguyen and G Adeyemi - Working across teams',
        'two-presenters'
      )
    ).toBe('match')
    expect(matchTitle('AB321W - F Nguyen - Working across teams', 'two-presenters')).toBe(
      'mismatch'
    )
  })

  it('cannot disambiguate same-arity categories - a documented limit, not a bug', () => {
    // An Events-shaped title (event - presenter - title) also "matches" Module
    // content and wbsLive, because all three are simply three parts. The tick
    // means "plausible shape for the category you picked", nothing more.
    const eventsTitle = 'Annual Conference - B Jones - My story'
    expect(matchTitle(eventsTitle, 'events-conferences')).toBe('match')
    expect(matchTitle(eventsTitle, 'module-content')).toBe('match')
    expect(matchTitle(eventsTitle, 'wbslive-recording')).toBe('match')
  })
})
