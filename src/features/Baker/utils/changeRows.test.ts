/**
 * Change Row Utilities Tests
 *
 * Validates the per-file diff semantics agreed for the Baker UI refresh:
 * files matched by path, camera reassignment = modified, rename = remove+add,
 * maintenance fields collected separately and never counted.
 */

import { describe, expect, it } from 'vitest'

import type { BreadcrumbsFile, BreadcrumbsPreview, FileInfo } from '../types'
import { buildProjectChangeRows, diffFileLists, sumChangeCounts } from './changeRows'

const file = (camera: number, name: string, path: string): FileInfo => ({
  camera,
  name,
  path
})

const breadcrumbs = (overrides: Partial<BreadcrumbsFile> = {}): BreadcrumbsFile => ({
  projectTitle: 'Test Project',
  numberOfCameras: 2,
  files: [],
  parentFolder: '/Volumes/Test',
  createdBy: 'admin',
  creationDateTime: '2026-04-29T12:47:21Z',
  ...overrides
})

describe('diffFileLists', () => {
  it('marks files only in the new scan as added', () => {
    const current = [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]
    const updated = [
      file(1, 'a.mp4', 'Footage/Camera 1/a.mp4'),
      file(2, 'b.wav', 'Footage/Camera 2/b.wav')
    ]

    const rows = diffFileLists(current, updated)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      type: 'added',
      label: 'Footage/Camera 2/b.wav',
      detail: 'new file'
    })
  })

  it('marks files only in breadcrumbs as removed', () => {
    const current = [
      file(1, 'a.mp4', 'Footage/Camera 1/a.mp4'),
      file(1, 'temp.mov', 'Footage/Camera 1/temp.mov')
    ]
    const updated = [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]

    const rows = diffFileLists(current, updated)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      type: 'removed',
      label: 'Footage/Camera 1/temp.mov',
      detail: 'missing on disk'
    })
  })

  it('marks a camera reassignment as modified with high impact', () => {
    const current = [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]
    const updated = [file(2, 'a.mp4', 'Footage/Camera 1/a.mp4')]

    const rows = diffFileLists(current, updated)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      type: 'modified',
      detail: 'camera 1 → 2',
      impact: 'high'
    })
  })

  it('shows a rename as one removal plus one addition', () => {
    const current = [file(1, 'old.mp4', 'Footage/Camera 1/old.mp4')]
    const updated = [file(1, 'new.mp4', 'Footage/Camera 1/new.mp4')]

    const rows = diffFileLists(current, updated)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.type).sort()).toEqual(['added', 'removed'])
  })

  it('treats a null current list as all files added', () => {
    const updated = [
      file(1, 'a.mp4', 'Footage/Camera 1/a.mp4'),
      file(2, 'b.mp4', 'Footage/Camera 2/b.mp4')
    ]

    const rows = diffFileLists(null, updated)

    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'added')).toBe(true)
  })

  it('returns no rows when lists match', () => {
    const files = [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]

    expect(diffFileLists(files, files)).toHaveLength(0)
  })
})

describe('buildProjectChangeRows', () => {
  const previewWith = (
    overrides: Partial<BreadcrumbsPreview> = {}
  ): BreadcrumbsPreview => ({
    current: breadcrumbs(),
    updated: breadcrumbs(),
    diff: { hasChanges: false, changes: [], summary: getSummary() },
    ...overrides
  })

  function getSummary(added = 0, modified = 0, removed = 0) {
    return { added, modified, removed, unchanged: 0 }
  }

  it('expands a files field change into per-file rows', () => {
    const current = breadcrumbs({
      files: [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]
    })
    const updated = breadcrumbs({
      files: [
        file(1, 'a.mp4', 'Footage/Camera 1/a.mp4'),
        file(2, 'b.wav', 'Footage/Camera 2/b.wav'),
        file(2, 'c.wav', 'Footage/Camera 2/c.wav')
      ]
    })
    const preview = previewWith({
      current,
      updated,
      diff: {
        hasChanges: true,
        changes: [
          {
            type: 'modified',
            field: 'files',
            oldValue: current.files,
            newValue: updated.files
          }
        ],
        summary: getSummary(0, 1, 0)
      }
    })

    const result = buildProjectChangeRows(preview)

    expect(result.rows).toHaveLength(2)
    expect(result.counts).toEqual({ added: 2, modified: 0, removed: 0 })
    expect(result.hasChanges).toBe(true)
  })

  it('formats scalar field changes with old and new values', () => {
    const preview = previewWith({
      diff: {
        hasChanges: true,
        changes: [
          {
            type: 'modified',
            field: 'folderSizeBytes',
            oldValue: 1024,
            newValue: 2048
          }
        ],
        summary: getSummary(0, 1, 0)
      }
    })

    const result = buildProjectChangeRows(preview)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].label).toBe('Folder Size')
    expect(result.rows[0].detail).toBe('1 KB → 2 KB')
  })

  it('collects maintenance fields separately without counting them', () => {
    const preview = previewWith({
      diff: {
        hasChanges: true,
        changes: [
          { type: 'modified', field: 'lastModified', oldValue: 'a', newValue: 'b' },
          { type: 'added', field: 'scannedBy', newValue: 'Baker' },
          { type: 'modified', field: 'folderSizeBytes', oldValue: 1024, newValue: 2048 }
        ],
        summary: getSummary(1, 2, 0)
      }
    })

    const result = buildProjectChangeRows(preview)

    expect(result.maintenanceFields).toEqual(['Last Modified', 'Scanned By'])
    expect(result.counts).toEqual({ added: 0, modified: 1, removed: 0 })
  })

  it('reports no changes for a maintenance-only preview', () => {
    const preview = previewWith({
      diff: {
        hasChanges: true,
        changes: [
          { type: 'modified', field: 'lastModified', oldValue: 'a', newValue: 'b' }
        ],
        summary: getSummary(0, 1, 0)
      }
    })

    const result = buildProjectChangeRows(preview)

    expect(result.hasChanges).toBe(false)
    expect(result.maintenanceFields).toEqual(['Last Modified'])
  })

  it('prefers meaningfulDiff over the full diff for rows', () => {
    const preview = previewWith({
      diff: {
        hasChanges: true,
        changes: [
          { type: 'modified', field: 'lastModified', oldValue: 'a', newValue: 'b' },
          { type: 'modified', field: 'folderSizeBytes', oldValue: 1024, newValue: 2048 }
        ],
        summary: getSummary(0, 2, 0)
      },
      meaningfulDiff: {
        hasChanges: false,
        changes: [],
        summary: getSummary()
      }
    })

    const result = buildProjectChangeRows(preview)

    expect(result.rows).toHaveLength(0)
    expect(result.hasChanges).toBe(false)
    expect(result.maintenanceFields).toEqual(['Last Modified'])
  })

  it('flags a new breadcrumbs file when current is null', () => {
    const preview = previewWith({ current: null })

    expect(buildProjectChangeRows(preview).isNewBreadcrumbs).toBe(true)
  })

  it('flags high impact only for high-impact modifications', () => {
    const cameraChange = previewWith({
      diff: {
        hasChanges: true,
        changes: [
          { type: 'modified', field: 'numberOfCameras', oldValue: 2, newValue: 3 }
        ],
        summary: getSummary(0, 1, 0)
      }
    })
    const fileAddsOnly = previewWith({
      current: breadcrumbs({ files: [] }),
      updated: breadcrumbs({ files: [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')] }),
      diff: {
        hasChanges: true,
        changes: [
          {
            type: 'modified',
            field: 'files',
            oldValue: [],
            newValue: [file(1, 'a.mp4', 'Footage/Camera 1/a.mp4')]
          }
        ],
        summary: getSummary(0, 1, 0)
      }
    })

    expect(buildProjectChangeRows(cameraChange).hasHighImpact).toBe(true)
    expect(buildProjectChangeRows(fileAddsOnly).hasHighImpact).toBe(false)
  })
})

describe('sumChangeCounts', () => {
  it('aggregates counts across projects', () => {
    const total = sumChangeCounts([
      {
        rows: [],
        counts: { added: 2, modified: 1, removed: 1 },
        maintenanceFields: [],
        isNewBreadcrumbs: false,
        hasChanges: true,
        hasHighImpact: false
      },
      {
        rows: [],
        counts: { added: 38, modified: 0, removed: 0 },
        maintenanceFields: [],
        isNewBreadcrumbs: true,
        hasChanges: true,
        hasHighImpact: false
      }
    ])

    expect(total).toEqual({ added: 40, modified: 1, removed: 1 })
  })
})
