/**
 * Batch Update Confirmation Dialog Tests
 *
 * Validates the diff-row dialog behaviour: per-file rows, adaptive accordion,
 * skipped-projects line, maintenance row, and the no-changes empty state.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { BreadcrumbsFile, BreadcrumbsPreview, FileInfo } from '../types'
import { BatchUpdateConfirmationDialog } from './BatchUpdateConfirmationDialog'

const file = (camera: number, name: string): FileInfo => ({
  camera,
  name,
  path: `Footage/Camera ${camera}/${name}`
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

function makePreview(
  name: string,
  currentFiles: FileInfo[] | null,
  updatedFiles: FileInfo[]
): BreadcrumbsPreview {
  const current = currentFiles === null ? null : breadcrumbs({ files: currentFiles })
  const updated = breadcrumbs({ projectTitle: name, files: updatedFiles })
  const filesChanged =
    currentFiles === null || JSON.stringify(currentFiles) !== JSON.stringify(updatedFiles)
  const changeType: 'added' | 'modified' = currentFiles === null ? 'added' : 'modified'
  const changes = filesChanged
    ? [
        {
          type: changeType,
          field: 'files',
          oldValue: currentFiles ?? undefined,
          newValue: updatedFiles
        }
      ]
    : []
  const maintenance = [
    { type: 'modified' as const, field: 'lastModified', oldValue: 'a', newValue: 'b' }
  ]

  return {
    current,
    updated,
    diff: {
      hasChanges: true,
      changes: [...changes, ...maintenance],
      summary: { added: 0, modified: changes.length + 1, removed: 0, unchanged: 0 }
    },
    meaningfulDiff: {
      hasChanges: filesChanged,
      changes,
      summary: { added: 0, modified: changes.length, removed: 0, unchanged: 0 }
    },
    detailedChanges: {
      projectPath: `/Volumes/Test/${name}`,
      projectName: name,
      hasChanges: filesChanged,
      changeCategories: { content: [], metadata: [], maintenance: [] },
      summary: {
        contentChanges: 0,
        metadataChanges: 0,
        maintenanceChanges: 0,
        totalChanges: 0
      }
    }
  }
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn()
}

describe('BatchUpdateConfirmationDialog', () => {
  it('auto-expands per-file rows for small batches', () => {
    const preview = makePreview(
      'Interview',
      [file(1, 'a.mp4')],
      [file(1, 'a.mp4'), file(2, 'b.wav')]
    )

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={['/Volumes/Test/Interview']}
        previews={[preview]}
      />
    )

    expect(screen.getByText('Footage/Camera 2/b.wav')).toBeInTheDocument()
    expect(screen.getByText('new file')).toBeInTheDocument()
    expect(screen.getByText('routine update')).toBeInTheDocument()
  })

  it('collapses to headers with counts for large batches', () => {
    const previews = Array.from({ length: 6 }, (_, i) =>
      makePreview(`Project ${i}`, [], [file(1, `clip${i}.mp4`)])
    )

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={previews.map((_, i) => `/Volumes/Test/Project ${i}`)}
        previews={previews}
      />
    )

    expect(screen.queryByText('Footage/Camera 1/clip0.mp4')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Project 0'))
    expect(screen.getByText('Footage/Camera 1/clip0.mp4')).toBeInTheDocument()
  })

  it('reports skipped projects that have no meaningful changes', () => {
    const changed = makePreview('Changed', [], [file(1, 'a.mp4')])
    const unchanged = makePreview('Unchanged', [file(1, 'a.mp4')], [file(1, 'a.mp4')])

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={['/Volumes/Test/Changed', '/Volumes/Test/Unchanged']}
        previews={[changed, unchanged]}
      />
    )

    expect(
      screen.getByText('1 selected project has no changes and will be skipped.')
    ).toBeInTheDocument()
    expect(screen.getByText('Update 1 Project')).toBeInTheDocument()
  })

  it('notes when a new breadcrumbs file will be created', () => {
    const preview = makePreview('Fresh', null, [file(1, 'a.mp4')])

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={['/Volumes/Test/Fresh']}
        previews={[preview]}
      />
    )

    expect(
      screen.getByText('No breadcrumbs file — a new one will be created.')
    ).toBeInTheDocument()
  })

  it('notes a rebuild for unparseable breadcrumbs', () => {
    const preview = makePreview('Broken', null, [file(1, 'a.mp4')])

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={['/Volumes/Test/Broken']}
        previews={[preview]}
        invalidBreadcrumbsPaths={['/Volumes/Test/Broken']}
      />
    )

    expect(
      screen.getByText(
        'Existing breadcrumbs file is unparseable — it will be rebuilt (a backup will be saved).'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('high impact')).toBeInTheDocument()
  })

  it('shows the empty state when nothing meaningful changes', () => {
    const unchanged = makePreview('Unchanged', [file(1, 'a.mp4')], [file(1, 'a.mp4')])

    render(
      <BatchUpdateConfirmationDialog
        {...baseProps}
        selectedProjects={['/Volumes/Test/Unchanged']}
        previews={[unchanged]}
      />
    )

    expect(screen.getByText('No Changes Required')).toBeInTheDocument()
    expect(screen.getByText('Nothing to Update')).toBeInTheDocument()
  })
})
