/**
 * projectStatus: the one place that decides what state a scanned project's
 * breadcrumbs are in, and whether the project needs attention. The list, its
 * filter chips and the scan summary all read from here, so they must agree.
 */

import { describe, expect, it } from 'vitest'
import type { ProjectFolder } from '../types'
import {
  breadcrumbsStatus,
  needsAttention,
  STATUS_PRESENTATION,
  type BreadcrumbsStatus
} from './projectStatus'

const project = (overrides: Partial<ProjectFolder> = {}): ProjectFolder => ({
  path: '/v/show',
  name: 'Show',
  isValid: true,
  hasBreadcrumbs: true,
  staleBreadcrumbs: false,
  invalidBreadcrumbs: false,
  lastScanned: '2026-07-01T00:00:00Z',
  cameraCount: 1,
  validationErrors: [],
  ...overrides
})

describe('breadcrumbsStatus', () => {
  it('is current for a project whose breadcrumbs file exists, parses and matches the folder', () => {
    expect(breadcrumbsStatus(project())).toBe('current')
  })

  it('is stale when the breadcrumbs file differs from the folder content', () => {
    expect(breadcrumbsStatus(project({ staleBreadcrumbs: true }))).toBe('stale')
  })

  it('is missing when there is no breadcrumbs file', () => {
    expect(breadcrumbsStatus(project({ hasBreadcrumbs: false }))).toBe('missing')
  })

  it('is unparseable when the breadcrumbs file exists but is corrupted', () => {
    expect(breadcrumbsStatus(project({ invalidBreadcrumbs: true }))).toBe('unparseable')
  })

  it('reports unparseable ahead of stale, because a file that cannot be read cannot be compared', () => {
    expect(
      breadcrumbsStatus(project({ invalidBreadcrumbs: true, staleBreadcrumbs: true }))
    ).toBe('unparseable')
  })

  it('reports unparseable ahead of missing', () => {
    expect(
      breadcrumbsStatus(project({ invalidBreadcrumbs: true, hasBreadcrumbs: false }))
    ).toBe('unparseable')
  })

  it('reports missing ahead of stale, because a file that is not there cannot be out of date', () => {
    expect(
      breadcrumbsStatus(project({ hasBreadcrumbs: false, staleBreadcrumbs: true }))
    ).toBe('missing')
  })

  it('ignores folder structure: a structurally invalid project can still be current', () => {
    expect(breadcrumbsStatus(project({ isValid: false }))).toBe('current')
  })
})

describe('needsAttention', () => {
  it('is false for a healthy project: current breadcrumbs and a valid structure', () => {
    expect(needsAttention(project())).toBe(false)
  })

  it.each([
    ['stale breadcrumbs', { staleBreadcrumbs: true }],
    ['missing breadcrumbs', { hasBreadcrumbs: false }],
    ['unparseable breadcrumbs', { invalidBreadcrumbs: true }],
    ['an invalid structure with current breadcrumbs', { isValid: false }]
  ] satisfies Array<[string, Partial<ProjectFolder>]>)(
    'is true for %s',
    (_label, overrides) => {
      expect(needsAttention(project(overrides))).toBe(true)
    }
  )

  it('agrees with breadcrumbsStatus: any non-current status needs attention', () => {
    const cases: Partial<ProjectFolder>[] = [
      {},
      { staleBreadcrumbs: true },
      { hasBreadcrumbs: false },
      { invalidBreadcrumbs: true }
    ]

    for (const overrides of cases) {
      const p = project(overrides)
      expect(needsAttention(p)).toBe(breadcrumbsStatus(p) !== 'current')
    }
  })
})

describe('STATUS_PRESENTATION', () => {
  const statuses: BreadcrumbsStatus[] = ['current', 'stale', 'missing', 'unparseable']

  it('gives every status its own single-word label', () => {
    const labels = statuses.map(s => STATUS_PRESENTATION[s].label)

    expect(labels).toEqual(['Current', 'Stale', 'Missing', 'Unparseable'])
    expect(new Set(labels).size).toBe(statuses.length)
  })

  it('keeps the current state quiet: muted text, and no warning or error colour', () => {
    expect(STATUS_PRESENTATION.current.text).toBe('text-muted-foreground')
  })

  it('uses the readable text-colour tokens for warning and info states', () => {
    expect(STATUS_PRESENTATION.stale.text).toBe('text-warning-text')
    expect(STATUS_PRESENTATION.missing.text).toBe('text-info-text')
  })
})
