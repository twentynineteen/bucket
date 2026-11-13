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
 * `bg-accent`, and each row's status word is queried inside its own row with `within`,
 * because the same words double as filter-chip labels.
 *
 * A row is the project name and size, then one meta line: a status word (Current, Stale,
 * Missing, Unparseable), the camera count, and where the project sits below the scan
 * root. The full path is only in the name's `title`.
 *
 * B2.1 - 0-camera projects read "No cameras" instead of "0 cams".
 * B3.1 - projects with unparseable breadcrumbs expose a Repair action.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockReducedMotion } from '@tests/utils/animation-testing'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

// Size-varied fixtures for sort-by-size tests
const small = project({ name: 'Small', path: '/v/small', folderSizeBytes: 1024 })
const medium = project({ name: 'Medium', path: '/v/medium', folderSizeBytes: 1_048_576 })
const big = project({ name: 'Big', path: '/v/big', folderSizeBytes: 1_073_741_824 })
const noSize = project({ name: 'NoSize', path: '/v/nosize', folderSizeBytes: undefined })

// Status-varied fixtures for chip-filter tests
const staleProj = project({
  name: 'Outdated',
  path: '/v/outdated',
  staleBreadcrumbs: true
})
const noBcProj = project({
  name: 'Homeless',
  path: '/v/homeless',
  hasBreadcrumbs: false
})
const invalidProj = project({
  name: 'Broken',
  path: '/v/broken',
  invalidBreadcrumbs: true
})

/**
 * Returns project names in rendered order. A row is the only kind of button that holds a
 * `<p>` (the sort switch and the filter chips are also `aria-pressed` buttons, but have
 * none); its name is that first `<p>`.
 */
const projectRows = () =>
  screen.getAllByRole('button').filter(btn => btn.querySelector('p') !== null)

const visibleProjectNames = () =>
  projectRows().map(row => row.querySelector('p')!.textContent ?? '')

/** The checkbox that belongs to a project row, not the header's select-all. */
const rowCheckbox = (name: string) =>
  within(rowFor(name)).getByRole('checkbox', { name: `Select ${name}` })

const selectAllBox = () =>
  screen.getByRole('checkbox', { name: 'Select all shown projects' })

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

  it('shows "shown of total" in the header while a filter hides some projects', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta, gamma] })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'alp')

    const header = screen.getByRole('heading', { name: 'Projects' }).parentElement!
    expect(within(header).getByText('1 of 3')).toBeInTheDocument()
  })

  it('names each project in the row and keeps the full path only in the name title', () => {
    renderPanel({
      projects: [project({ name: 'Show A', path: '/Volumes/Media/Show A' })]
    })

    expect(screen.getByText('Show A')).toHaveAttribute('title', '/Volumes/Media/Show A')
    expect(screen.queryByText('/Volumes/Media/Show A')).not.toBeInTheDocument()
  })

  it('shows the folder size on the row, or "size n/a" when it is unknown, never 0 B', () => {
    renderPanel({
      projects: [
        project({ name: 'Sized', path: '/v/sized', folderSizeBytes: 1_048_576 }),
        project({ name: 'Unsized', path: '/v/unsized', folderSizeBytes: undefined })
      ]
    })

    expect(within(rowFor('Sized')).getAllByText('1 MB').length).toBeGreaterThan(0)
    expect(within(rowFor('Unsized')).getAllByText('size n/a').length).toBeGreaterThan(0)
    expect(within(rowFor('Unsized')).queryByText('0 B')).not.toBeInTheDocument()
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

    const pressedRows = () =>
      projectRows().filter(row => row.getAttribute('aria-pressed') === 'true')

    expect(pressedRows()).toHaveLength(0)

    update({ selectedProject: '/v/beta' })

    expect(pressedRows()).toHaveLength(1)
    expect(pressedRows()[0]).toHaveTextContent('Beta')
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

  it('unticks a project from its checkbox with isSelected false', async () => {
    const user = userEvent.setup()
    const onProjectSelection = vi.fn()
    renderPanel({
      projects: [alpha, beta],
      selectedProjects: ['/v/alpha'],
      onProjectSelection
    })

    await user.click(rowCheckbox('Alpha'))

    expect(onProjectSelection).toHaveBeenCalledWith('/v/alpha', false)
  })
})

describe('ProjectListPanel select all', () => {
  it('has no header checkbox unless onSelectMany is passed', () => {
    renderPanel({ projects: [alpha, beta] })

    expect(
      screen.queryByRole('checkbox', { name: 'Select all shown projects' })
    ).not.toBeInTheDocument()
  })

  it('ticks every shown project through onSelectMany', async () => {
    const user = userEvent.setup()
    const onSelectMany = vi.fn()
    renderPanel({ projects: [alpha, beta, gamma], onSelectMany })

    await user.click(selectAllBox())

    expect(onSelectMany).toHaveBeenCalledWith(['/v/alpha', '/v/beta', '/v/gamma'], true)
  })

  it('acts on the shown rows only: with the Stale chip active it ticks just the stale projects', async () => {
    const user = userEvent.setup()
    const onSelectMany = vi.fn()
    renderPanel({ projects: [alpha, staleProj, noBcProj], onSelectMany })

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))
    await user.click(selectAllBox())

    expect(onSelectMany).toHaveBeenCalledTimes(1)
    expect(onSelectMany).toHaveBeenCalledWith(['/v/outdated'], true)
  })

  it('acts on the shown rows only: a text filter narrows what it ticks', async () => {
    const user = userEvent.setup()
    const onSelectMany = vi.fn()
    renderPanel({ projects: [alpha, beta, gamma], onSelectMany })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'amm')
    await user.click(selectAllBox())

    expect(onSelectMany).toHaveBeenCalledWith(['/v/gamma'], true)
  })

  it('is unchecked when no shown project is ticked', () => {
    renderPanel({ projects: [alpha, beta], onSelectMany: vi.fn() })

    expect(selectAllBox()).not.toBeChecked()
    expect(selectAllBox()).not.toBePartiallyChecked()
  })

  it('shows a dash when only some shown projects are ticked', () => {
    renderPanel({
      projects: [alpha, beta],
      selectedProjects: ['/v/alpha'],
      onSelectMany: vi.fn()
    })

    expect(selectAllBox()).toBePartiallyChecked()
  })

  it('is checked when every shown project is ticked, and unticks them on click', async () => {
    const user = userEvent.setup()
    const onSelectMany = vi.fn()
    renderPanel({
      projects: [alpha, beta],
      selectedProjects: ['/v/alpha', '/v/beta'],
      onSelectMany
    })

    expect(selectAllBox()).toBeChecked()

    await user.click(selectAllBox())

    expect(onSelectMany).toHaveBeenCalledWith(['/v/alpha', '/v/beta'], false)
  })

  it('ignores ticked projects the filter hides when deciding its own state', async () => {
    const user = userEvent.setup()
    renderPanel({
      projects: [alpha, staleProj],
      selectedProjects: ['/v/alpha', '/v/outdated'],
      onSelectMany: vi.fn()
    })

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))

    // Alpha is ticked but hidden; the one shown project is ticked, so all shown are.
    expect(selectAllBox()).toBeChecked()
  })

  it('is disabled when the filter leaves no rows', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta], onSelectMany: vi.fn() })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'xyz')

    expect(selectAllBox()).toBeDisabled()
  })
})

describe('ProjectListPanel footer', () => {
  const footer = (hidden: number) => <p data-testid="footer">hidden: {hidden}</p>

  it('renders nothing extra when no footer is given', () => {
    renderPanel({ projects: [alpha] })

    expect(screen.queryByTestId('footer')).not.toBeInTheDocument()
  })

  it('renders the footer under the rows', () => {
    renderPanel({ projects: [alpha, beta], footer })

    const footerNode = screen.getByTestId('footer')
    const lastRow = rowFor('Beta')
    expect(lastRow.compareDocumentPosition(footerNode)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('tells the footer no ticked project is hidden when the filter shows them all', () => {
    renderPanel({
      projects: [alpha, beta],
      selectedProjects: ['/v/alpha', '/v/beta'],
      footer
    })

    expect(screen.getByTestId('footer')).toHaveTextContent('hidden: 0')
  })

  it('tells the footer how many ticked projects the status filter is hiding', async () => {
    const user = userEvent.setup()
    renderPanel({
      projects: [alpha, beta, staleProj],
      selectedProjects: ['/v/alpha', '/v/beta', '/v/outdated'],
      footer
    })

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))

    expect(screen.getByTestId('footer')).toHaveTextContent('hidden: 2')
  })

  it('counts ticked projects hidden by the text filter too', async () => {
    const user = userEvent.setup()
    renderPanel({
      projects: [alpha, beta, gamma],
      selectedProjects: ['/v/alpha', '/v/beta'],
      footer
    })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'alp')

    expect(screen.getByTestId('footer')).toHaveTextContent('hidden: 1')
  })
})

describe('ProjectListPanel status word', () => {
  it('gives each project exactly one breadcrumbs status word for its own state', () => {
    renderPanel({
      projects: [
        alpha,
        project({ name: 'Beta', path: '/v/beta', staleBreadcrumbs: true }),
        project({ name: 'Gamma', path: '/v/gamma', hasBreadcrumbs: false }),
        project({ name: 'Delta', path: '/v/delta', invalidBreadcrumbs: true })
      ]
    })

    const words = ['Current', 'Stale', 'Missing', 'Unparseable']
    const expected = {
      Alpha: 'Current',
      Beta: 'Stale',
      Gamma: 'Missing',
      Delta: 'Unparseable'
    }

    for (const [name, word] of Object.entries(expected)) {
      const row = within(rowFor(name))
      expect(row.getByText(word)).toBeInTheDocument()
      for (const other of words.filter(w => w !== word)) {
        expect(row.queryByText(other)).not.toBeInTheDocument()
      }
    }
  })

  it('adds "Invalid structure" beside the status word when the folder structure is broken', () => {
    renderPanel({
      projects: [
        project({ name: 'Healthy', path: '/v/healthy' }),
        project({ name: 'Broken Tree', path: '/v/broken-tree', isValid: false })
      ]
    })

    expect(within(rowFor('Broken Tree')).getByText('Current')).toBeInTheDocument()
    expect(
      within(rowFor('Broken Tree')).getByText('Invalid structure')
    ).toBeInTheDocument()
    expect(
      within(rowFor('Healthy')).queryByText('Invalid structure')
    ).not.toBeInTheDocument()
  })

  it('reports unparseable breadcrumbs ahead of stale ones', () => {
    renderPanel({
      projects: [
        project({
          name: 'Both',
          path: '/v/both',
          invalidBreadcrumbs: true,
          staleBreadcrumbs: true
        })
      ]
    })

    expect(within(rowFor('Both')).getByText('Unparseable')).toBeInTheDocument()
    expect(within(rowFor('Both')).queryByText('Stale')).not.toBeInTheDocument()
  })
})

describe('ProjectListPanel location', () => {
  const nested = (path: string, name = 'Show') => project({ name, path })

  it('shows nothing extra for a project directly inside the scan root', () => {
    renderPanel({
      rootPath: '/Volumes/Media',
      projects: [nested('/Volumes/Media/Show')]
    })

    expect(within(rowFor('Show')).queryByText(/^in /)).not.toBeInTheDocument()
  })

  it('shows where a nested project sits relative to the scan root, not the full path', () => {
    renderPanel({
      rootPath: '/Volumes/Media',
      projects: [nested('/Volumes/Media/Client/Season 1/Show')]
    })

    expect(within(rowFor('Show')).getByText('in Client/Season 1')).toBeInTheDocument()
    expect(screen.queryByText(/\/Volumes\/Media/)).not.toBeInTheDocument()
  })

  it('treats a trailing slash on the scan root the same as none', () => {
    renderPanel({
      rootPath: '/Volumes/Media/',
      projects: [
        nested('/Volumes/Media/Show', 'Direct'),
        nested('/Volumes/Media/Client/Show', 'Nested')
      ]
    })

    expect(within(rowFor('Direct')).queryByText(/^in /)).not.toBeInTheDocument()
    expect(within(rowFor('Nested')).getByText('in Client')).toBeInTheDocument()
  })

  it('shows the full parent folder when the scan root is not known', () => {
    renderPanel({ projects: [nested('/Volumes/Media/Client/Show')] })

    expect(
      within(rowFor('Show')).getByText('in /Volumes/Media/Client')
    ).toBeInTheDocument()
  })

  it('does not treat a sibling folder that shares the root prefix as nested below it', () => {
    renderPanel({
      rootPath: '/Volumes/Media',
      projects: [nested('/Volumes/Media2/Show')]
    })

    expect(within(rowFor('Show')).getByText('in /Volumes/Media2')).toBeInTheDocument()
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

describe('ProjectListPanel text filter', () => {
  it('narrows the list to projects whose name matches the query', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta, gamma] })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'alp')

    expect(visibleProjectNames()).toEqual(['Alpha'])
  })

  it('shows the empty state when no projects match the filter', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta, gamma] })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'xyz')

    expect(screen.getByText('No projects match the current filter')).toBeInTheDocument()
    expect(visibleProjectNames()).toEqual([])
  })

  it('matches against the project path as well as the name', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta, gamma] })

    await user.type(screen.getByPlaceholderText('Filter projects…'), '/v/beta')

    expect(visibleProjectNames()).toEqual(['Beta'])
  })
})

describe('ProjectListPanel sort order', () => {
  it('defaults to scan order (array position)', () => {
    renderPanel({ projects: [small, big, medium] })

    expect(visibleProjectNames()).toEqual(['Small', 'Big', 'Medium'])
  })

  it('reorders by folder size, largest first, when the Size button is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [small, big, medium] })

    await user.click(screen.getByRole('button', { name: 'Size' }))

    expect(visibleProjectNames()).toEqual(['Big', 'Medium', 'Small'])
  })

  it('sinks projects with unknown size to the bottom when sorting by size', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [noSize, small, big] })

    await user.click(screen.getByRole('button', { name: 'Size' }))

    expect(visibleProjectNames()).toEqual(['Big', 'Small', 'NoSize'])
  })

  it('returns to scan order when Scan order is clicked after sorting by size', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [small, big, medium] })

    await user.click(screen.getByRole('button', { name: 'Size' }))
    expect(visibleProjectNames()).toEqual(['Big', 'Medium', 'Small'])

    await user.click(screen.getByRole('button', { name: 'Scan order' }))
    expect(visibleProjectNames()).toEqual(['Small', 'Big', 'Medium'])
  })

  it('offers Scan order, Status and Size as a switch with the active one pressed', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [alpha, beta] })

    const sort = within(screen.getByRole('group', { name: 'Sort projects' }))
    expect(sort.getAllByRole('button').map(b => b.textContent)).toEqual([
      'Scan order',
      'Status',
      'Size'
    ])
    expect(sort.getByRole('button', { name: 'Scan order' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(sort.getByRole('button', { name: 'Status' }))

    expect(sort.getByRole('button', { name: 'Status' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(sort.getByRole('button', { name: 'Scan order' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('puts projects that need work first when sorting by Status: unparseable, missing, stale, current', async () => {
    const user = userEvent.setup()
    renderPanel({
      projects: [
        alpha,
        staleProj,
        noBcProj,
        invalidProj,
        project({ name: 'Zed', path: '/v/zed' })
      ]
    })

    await user.click(screen.getByRole('button', { name: 'Status' }))

    expect(visibleProjectNames()).toEqual([
      'Broken',
      'Homeless',
      'Outdated',
      'Alpha',
      'Zed'
    ])
  })

  it('keeps scan order within one status when sorting by Status', async () => {
    const user = userEvent.setup()
    const staleB = project({
      name: 'Stale B',
      path: '/v/stale-b',
      staleBreadcrumbs: true
    })
    const staleA = project({
      name: 'Stale A',
      path: '/v/stale-a',
      staleBreadcrumbs: true
    })
    renderPanel({ projects: [staleB, alpha, staleA] })

    await user.click(screen.getByRole('button', { name: 'Status' }))

    expect(visibleProjectNames()).toEqual(['Stale B', 'Stale A', 'Alpha'])
  })

  it('sorts only the projects the filter still shows', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [big, small, medium] })

    await user.type(screen.getByPlaceholderText('Filter projects…'), 'm')
    await user.click(screen.getByRole('button', { name: 'Size' }))

    expect(visibleProjectNames()).toEqual(['Medium', 'Small'])
  })
})

describe('ProjectListPanel status chips', () => {
  const statusMix = [alpha, staleProj, noBcProj, invalidProj]
  const brokenTree = project({ name: 'Bent', path: '/v/bent', isValid: false })

  const chipNames = () =>
    within(screen.getByRole('group', { name: 'Filter by state' }))
      .getAllByRole('button')
      .map(chip => chip.getAttribute('aria-label') ?? chip.textContent)

  it('offers a chip with a count for each state present, plus All', () => {
    renderPanel({ projects: [...statusMix, brokenTree] })

    expect(chipNames()).toEqual([
      'All 5',
      'Needs attention 4',
      'Stale 1',
      'Missing 1',
      'Unparseable 1',
      'Invalid structure 1'
    ])
  })

  it('leaves out the chips for states no project is in', () => {
    renderPanel({ projects: [alpha, staleProj] })

    expect(chipNames()).toEqual(['All 2', 'Needs attention 1', 'Stale 1'])
  })

  it('shows no chips at all when every project is current', () => {
    renderPanel({ projects: [alpha, beta] })

    expect(
      screen.queryByRole('group', { name: 'Filter by state' })
    ).not.toBeInTheDocument()
  })

  it('restricts to stale projects when the Stale chip is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: statusMix })

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))

    expect(visibleProjectNames()).toEqual(['Outdated'])
  })

  it('restricts to projects with no breadcrumbs file when the Missing chip is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: statusMix })

    await user.click(screen.getByRole('button', { name: /^Missing \d+$/ }))

    expect(visibleProjectNames()).toEqual(['Homeless'])
  })

  it('restricts to unreadable breadcrumbs when the Unparseable chip is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: statusMix })

    await user.click(screen.getByRole('button', { name: /^Unparseable \d+$/ }))

    expect(visibleProjectNames()).toEqual(['Broken'])
  })

  it('restricts to broken folder structures when the Invalid structure chip is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [...statusMix, brokenTree] })

    await user.click(screen.getByRole('button', { name: /^Invalid structure \d+$/ }))

    expect(visibleProjectNames()).toEqual(['Bent'])
  })

  it('shows every project that is not current when the Needs attention chip is clicked', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: [...statusMix, brokenTree] })

    await user.click(screen.getByRole('button', { name: /^Needs attention \d+$/ }))

    expect(visibleProjectNames()).toEqual(['Outdated', 'Homeless', 'Broken', 'Bent'])
  })

  it('marks only the active chip as pressed', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: statusMix })

    expect(screen.getByRole('button', { name: /^All \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))

    expect(screen.getByRole('button', { name: /^Stale \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /^All \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('returns to the full list when the All chip is clicked after filtering', async () => {
    const user = userEvent.setup()
    renderPanel({ projects: statusMix })

    await user.click(screen.getByRole('button', { name: /^Stale \d+$/ }))
    expect(visibleProjectNames()).toEqual(['Outdated'])

    await user.click(screen.getByRole('button', { name: /^All \d+$/ }))
    expect(visibleProjectNames()).toEqual(['Alpha', 'Outdated', 'Homeless', 'Broken'])
  })

  describe('when controlled from outside', () => {
    it('shows the projects of the filter it is given', () => {
      renderPanel({
        projects: statusMix,
        statusFilter: 'stale',
        onStatusFilterChange: vi.fn()
      })

      expect(visibleProjectNames()).toEqual(['Outdated'])
      expect(screen.getByRole('button', { name: /^Stale \d+$/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    it('reports a chip click through onStatusFilterChange and leaves the list to its owner', async () => {
      const user = userEvent.setup()
      const onStatusFilterChange = vi.fn()
      const { update } = renderPanel({
        projects: statusMix,
        statusFilter: 'stale',
        onStatusFilterChange
      })

      await user.click(screen.getByRole('button', { name: /^Missing \d+$/ }))

      expect(onStatusFilterChange).toHaveBeenCalledWith('missing')
      expect(visibleProjectNames()).toEqual(['Outdated'])

      update({ statusFilter: 'missing' })

      expect(visibleProjectNames()).toEqual(['Homeless'])
    })

    it('shows the Needs attention filter set by the scan summary link', () => {
      renderPanel({
        projects: statusMix,
        statusFilter: 'attention',
        onStatusFilterChange: vi.fn()
      })

      expect(visibleProjectNames()).toEqual(['Outdated', 'Homeless', 'Broken'])
    })
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
