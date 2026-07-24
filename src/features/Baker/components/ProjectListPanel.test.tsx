/**
 * Project List Panel Tests
 *
 * B2.1 — 0-camera projects show a "No cameras" pill instead of "0 cams".
 * B3.1 — projects with unparseable breadcrumbs expose a Repair action.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ProjectFolder } from '../types'
import { ProjectListPanel } from './ProjectListPanel'

const project = (overrides: Partial<ProjectFolder> = {}): ProjectFolder => ({
  path: '/Volumes/Media/Show A',
  name: 'Show A',
  isValid: true,
  hasBreadcrumbs: true,
  staleBreadcrumbs: false,
  invalidBreadcrumbs: false,
  lastScanned: '2026-07-01T00:00:00Z',
  cameraCount: 2,
  validationErrors: [],
  folderSizeBytes: 2048,
  ...overrides
})

const renderPanel = (
  projects: ProjectFolder[],
  onRepairProject: (path: string) => void = vi.fn()
) =>
  render(
    <ProjectListPanel
      projects={projects}
      selectedProjects={[]}
      selectedProject={null}
      onProjectSelection={vi.fn()}
      onProjectClick={vi.fn()}
      onRepairProject={onRepairProject}
    />
  )

describe('ProjectListPanel camera pill (B2.1)', () => {
  it('shows a "No cameras" pill for 0-camera projects', () => {
    renderPanel([project({ cameraCount: 0 })])

    expect(screen.getByText('No cameras')).toBeInTheDocument()
    expect(screen.queryByText(/0 cams/)).not.toBeInTheDocument()
  })

  it('keeps the camera count pill for projects with cameras', () => {
    renderPanel([project({ cameraCount: 2 })])

    expect(screen.getByText('2 cams')).toBeInTheDocument()
    expect(screen.queryByText('No cameras')).not.toBeInTheDocument()
  })
})

describe('ProjectListPanel repair action (B3.1)', () => {
  it('shows a Repair button only for projects with unparseable breadcrumbs', () => {
    renderPanel([
      project({ invalidBreadcrumbs: true, path: '/v/Broken', name: 'Broken' }),
      project({ path: '/v/Fine', name: 'Fine' })
    ])

    expect(screen.getAllByRole('button', { name: 'Repair' })).toHaveLength(1)
  })

  it('invokes onRepairProject with the project path without selecting the row', () => {
    const onRepair = vi.fn()
    const onClick = vi.fn()
    render(
      <ProjectListPanel
        projects={[project({ invalidBreadcrumbs: true, path: '/v/Broken' })]}
        selectedProjects={[]}
        selectedProject={null}
        onProjectSelection={vi.fn()}
        onProjectClick={onClick}
        onRepairProject={onRepair}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Repair' }))

    expect(onRepair).toHaveBeenCalledWith('/v/Broken')
    expect(onClick).not.toHaveBeenCalled()
  })
})
