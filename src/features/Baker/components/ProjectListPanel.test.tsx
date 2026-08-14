/**
 * Project List Panel Tests
 *
 * The single test file for this component. `tests/unit/components/Baker/
 * ProjectListPanel.test.tsx` and `ProjectListPanel.animations.test.tsx` were merged in
 * here under issue #220, which is #205's job done for this component's neighbours.
 *
 * What did not survive the move was an assertion on the contents of `BAKER_ANIMATIONS`,
 * an assertion on a Tailwind class literal, an assertion that held whatever the
 * component did, or a second copy of one of the assertions below. This component does
 * read `BAKER_ANIMATIONS.projectList` and `.statusBadge`, unlike `ProjectDetailPanel`,
 * so those constants assertions were not aimed at a component that ignores them - but a
 * user observes nothing when `staggerChildren` changes, and jsdom applies no styling, so
 * they checked neither the constant's effect nor the rendered result.
 *
 * Selection is read through `aria-pressed` rather than through `className` containing
 * `bg-accent`, and status pills are queried inside their own row with `within`, which is
 * why the legacy tests reached for class literals like `bg-warning/20`: the status words
 * double as filter-chip labels.
 *
 * B2.1 - 0-camera projects show a "No cameras" pill instead of "0 cams".
 * B3.1 - projects with unparseable breadcrumbs expose a Repair action.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockReducedMotion } from '@tests/utils/animation-testing'
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

type PanelProps = React.ComponentProps<typeof ProjectListPanel>

/**
 * Every render goes through here, and every prop change goes through `update`.
 * `rerender` on a bare `render` drops whatever the helper set up, which is how the
 * legacy files ended up re-querying stale elements after a selection change.
 */
const renderPanel = (overrides: Partial<PanelProps> = {}) => {
  const props: PanelProps = {
    projects: [project()],
    selectedProjects: [],
    selectedProject: null,
    onProjectSelection: vi.fn(),
    onProjectClick: vi.fn(),
    onRepairProject: vi.fn(),
    ...overrides
  }

  const view = render(<ProjectListPanel {...props} />)

  return {
    ...view,
    update: (next: Partial<PanelProps>) =>
      view.rerender(<ProjectListPanel {...props} {...next} />)
  }
}

/** A project row, which the component exposes as a button carrying its own state. */
const rowFor = (name: string) => screen.getByRole('button', { name: new RegExp(name) })

const alpha = project({ name: 'Alpha', path: '/v/alpha' })
const beta = project({ name: 'Beta', path: '/v/beta' })
const gamma = project({ name: 'Gamma', path: '/v/gamma' })

describe('ProjectListPanel list rendering', () => {
  it('renders a row and a checkbox for every scanned project', () => {
    renderPanel({ projects: [alpha, beta, gamma] })

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('shows how many projects were scanned in the panel header', () => {
    renderPanel({ projects: [alpha, beta, gamma] })

    const header = screen.getByRole('heading', { name: 'Projects' }).parentElement!

    expect(within(header).getByText('3')).toBeInTheDocument()
  })

  it('falls back to the empty state when the scan returned nothing', () => {
    const { update } = renderPanel({ projects: [alpha] })

    expect(screen.queryByText('No projects found')).not.toBeInTheDocument()

    update({ projects: [] })

    expect(screen.getByText('No projects found')).toBeInTheDocument()
  })

  it('picks up a project added to the projects array', () => {
    const { update } = renderPanel({ projects: [alpha] })

    expect(screen.queryByText('Beta')).not.toBeInTheDocument()

    update({ projects: [alpha, beta] })

    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})

describe('ProjectListPanel selection', () => {
  it('marks only the selected row as pressed', () => {
    const { update } = renderPanel({ projects: [alpha, beta] })

    expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument()

    update({ selectedProject: '/v/beta' })

    const pressed = screen.getAllByRole('button', { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('Beta')
  })

  it('checks the checkbox of every path in selectedProjects', () => {
    const { update } = renderPanel({ projects: [alpha, beta] })

    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked()

    update({ selectedProjects: ['/v/beta'] })

    const [first, second] = screen.getAllByRole('checkbox')
    expect(first).not.toBeChecked()
    expect(second).toBeChecked()
  })

  it('calls onProjectClick with the path of the clicked row', async () => {
    const user = userEvent.setup()
    const onProjectClick = vi.fn()
    renderPanel({ projects: [alpha, beta], onProjectClick })

    await user.click(rowFor('Beta'))

    expect(onProjectClick).toHaveBeenCalledWith('/v/beta')
  })

  it('selects a project from its checkbox without opening the row', async () => {
    const user = userEvent.setup()
    const onProjectClick = vi.fn()
    const onProjectSelection = vi.fn()
    renderPanel({ projects: [alpha, beta], onProjectClick, onProjectSelection })

    await user.click(within(rowFor('Alpha')).getByRole('checkbox'))

    expect(onProjectSelection).toHaveBeenCalledWith('/v/alpha', true)
    expect(onProjectClick).not.toHaveBeenCalled()
  })
})

describe('ProjectListPanel status pills', () => {
  it('describes each project with the pills for its own state', () => {
    renderPanel({
      projects: [
        alpha,
        project({ name: 'Beta', path: '/v/beta', staleBreadcrumbs: true }),
        project({ name: 'Gamma', path: '/v/gamma', hasBreadcrumbs: false }),
        project({
          name: 'Delta',
          path: '/v/delta',
          isValid: false,
          invalidBreadcrumbs: true
        })
      ]
    })

    expect(within(rowFor('Alpha')).getByText('Valid')).toBeInTheDocument()
    expect(within(rowFor('Alpha')).getByText('Current')).toBeInTheDocument()
    expect(within(rowFor('Alpha')).queryByText('Stale')).not.toBeInTheDocument()

    expect(within(rowFor('Beta')).getByText('Stale')).toBeInTheDocument()
    expect(within(rowFor('Beta')).queryByText('Current')).not.toBeInTheDocument()

    expect(within(rowFor('Gamma')).getByText('No BC')).toBeInTheDocument()

    expect(within(rowFor('Delta')).getByText('Invalid')).toBeInTheDocument()
    expect(within(rowFor('Delta')).getByText('Invalid BC')).toBeInTheDocument()
  })
})

describe('ProjectListPanel camera pill (B2.1)', () => {
  it('shows a "No cameras" pill for 0-camera projects', () => {
    renderPanel({ projects: [project({ cameraCount: 0 })] })

    expect(screen.getByText('No cameras')).toBeInTheDocument()
    expect(screen.queryByText(/0 cams/)).not.toBeInTheDocument()
  })

  it('keeps the camera count pill for projects with cameras', () => {
    renderPanel({ projects: [project({ cameraCount: 2 })] })

    expect(screen.getByText('2 cams')).toBeInTheDocument()
    expect(screen.queryByText('No cameras')).not.toBeInTheDocument()
  })

  it('reads "1 cam" rather than "1 cams" for a single camera', () => {
    renderPanel({ projects: [project({ cameraCount: 1 })] })

    expect(screen.getByText('1 cam')).toBeInTheDocument()
  })
})

describe('ProjectListPanel repair action (B3.1)', () => {
  it('shows a Repair button only for projects with unparseable breadcrumbs', () => {
    renderPanel({
      projects: [
        project({ invalidBreadcrumbs: true, path: '/v/Broken', name: 'Broken' }),
        project({ path: '/v/Fine', name: 'Fine' })
      ]
    })

    expect(screen.getAllByRole('button', { name: 'Repair' })).toHaveLength(1)
  })

  it('invokes onRepairProject with the project path without selecting the row', () => {
    const onRepairProject = vi.fn()
    const onProjectClick = vi.fn()
    renderPanel({
      projects: [project({ invalidBreadcrumbs: true, path: '/v/Broken' })],
      onRepairProject,
      onProjectClick
    })

    fireEvent.click(screen.getByRole('button', { name: 'Repair' }))

    expect(onRepairProject).toHaveBeenCalledWith('/v/Broken')
    expect(onProjectClick).not.toHaveBeenCalled()
  })
})

describe('ProjectListPanel with reduced motion', () => {
  afterEach(() => mockReducedMotion(false))

  it('still lists the projects and still opens one on click', async () => {
    mockReducedMotion(true)
    const user = userEvent.setup()
    const onProjectClick = vi.fn()
    renderPanel({ projects: [alpha, beta], onProjectClick })

    expect(screen.getByText('Alpha')).toBeInTheDocument()

    await user.click(rowFor('Beta'))

    expect(onProjectClick).toHaveBeenCalledWith('/v/beta')
  })
})
