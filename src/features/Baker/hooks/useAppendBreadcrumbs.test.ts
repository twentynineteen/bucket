/**
 * useAppendBreadcrumbs tests - issue #168, area B6
 *
 * This is how a stale path propagates: `**Location:**` stamped a path read out
 * of breadcrumbs.json into a Trello card description as authoritative for the
 * whole team, then two other surfaces read it back.
 *
 * The fix labels rather than verifies. A Trello card is a durable artefact read
 * on other people's machines and by its author weeks later, so a path verified
 * at write time is not current for any of those readers - verifying only
 * decides whether the author may record a fact about their own machine. Worse,
 * gating on local resolution would refuse to record footage sitting on an
 * external drive that happens to be unmounted, destroying real information for
 * the same reason #166 declined to auto-clear a stored folder.
 */

import { describe, expect, it } from 'vitest'

import type { Breadcrumb } from '@shared/types'
import { generateBreadcrumbsBlock } from './useAppendBreadcrumbs'

const RECORDED_LOCATION = '/Volumes/Archive/Shoots/Project A'

const breadcrumbs: Breadcrumb = {
  projectTitle: 'Project A',
  numberOfCameras: 2,
  parentFolder: RECORDED_LOCATION,
  createdBy: 'Someone Else',
  creationDateTime: '2026-01-01T00:00:00Z',
  files: [
    { camera: 1, name: 'A001.mov', path: `${RECORDED_LOCATION}/Footage/A001.mov` }
  ]
}

describe('B6 - writing Location into a Trello card', () => {
  it('B6.1 qualifies the Location line as recorded rather than current', () => {
    const block = generateBreadcrumbsBlock(breadcrumbs)

    expect(block).toContain(`**Location (as recorded):** ${RECORDED_LOCATION}`)
  })

  it('B6.1 never writes an unqualified Location line', () => {
    const block = generateBreadcrumbsBlock(breadcrumbs)
    const summary = block.split('---')[0]

    expect(summary).not.toContain('**Location:**')
  })

  it('B6.2 writes the recorded path unchanged, without probing the filesystem', () => {
    const block = generateBreadcrumbsBlock(breadcrumbs)

    // A path on an unmounted volume is still the truth about where the footage
    // is. Recording it is never gated on whether it resolves here and now.
    expect(block).toContain(RECORDED_LOCATION)
  })

  it('B6.3 stays matchable by the existing replace-detection pattern', () => {
    const block = generateBreadcrumbsBlock(breadcrumbs)
    const newFormatPattern =
      /PROJECT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[\s\S]*?```json\n\/\/ BREADCRUMBS[\s\S]*?```/

    expect(newFormatPattern.test(`Existing description\n\n${block}`)).toBe(true)
  })

  it('B6.4 leaves parentFolder byte-identical in the machine-readable block', () => {
    const block = generateBreadcrumbsBlock(breadcrumbs)
    const json = block.slice(block.indexOf('// BREADCRUMBS') + '// BREADCRUMBS'.length)
    const parsed = JSON.parse(json.slice(0, json.lastIndexOf('```')).trim())

    expect(parsed.parentFolder).toBe(RECORDED_LOCATION)
  })

  it('omits the Location line entirely when no folder was recorded', () => {
    const block = generateBreadcrumbsBlock({ ...breadcrumbs, parentFolder: undefined })

    expect(block).not.toContain('**Location')
  })
})
