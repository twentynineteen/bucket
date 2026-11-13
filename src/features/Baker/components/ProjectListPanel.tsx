/**
 * Project List Panel Component
 *
 * Fixed-width left panel showing the scanned projects with a text filter and
 * status filter chips. Part of the full-height master-detail layout.
 *
 * Rows are the project name (up to two lines, never cut mid-word) over one
 * meta line: breadcrumbs state, camera count, size, and the folder the project
 * sits in when that is not the scan root itself. Only states that need work
 * are coloured; a current project stays quiet.
 *
 * The row being inspected carries an accent fill and bar. A ticked row is
 * marked by its checkbox alone, so the two are never confused.
 *
 * Animations:
 * - Staggered entrance animation when projects load
 * - Smooth hover effects on project rows
 */

import { BAKER_ANIMATIONS } from '@shared/constants'
import { useReducedMotion } from '@shared/hooks'
import { Checkbox } from '@shared/ui/checkbox'
import { Input } from '@shared/ui/input'
import { formatFileSize } from '@shared/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import React, { useMemo, useState } from 'react'
import {
  breadcrumbsStatus,
  needsAttention,
  STATUS_PRESENTATION
} from '../internal/projectStatus'
import type { ProjectFolder } from '../types'

// Threshold for enabling virtual scrolling (performance optimization for large lists)
const VIRTUAL_SCROLLING_THRESHOLD = 50

// Height of one single-line-name row, for the virtualizer's first estimate.
const ROW_HEIGHT_ESTIMATE = 54

// Utility function for conditional class names
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

export type ProjectStatusFilter =
  'all' | 'attention' | 'stale' | 'missing' | 'unparseable' | 'structure'
type SortOrder = 'scan' | 'size'

const FILTERS: ReadonlyArray<{
  key: ProjectStatusFilter
  label: string
  matches: (project: ProjectFolder) => boolean
}> = [
  { key: 'all', label: 'All', matches: () => true },
  { key: 'attention', label: 'Attention', matches: needsAttention },
  { key: 'stale', label: 'Stale', matches: p => breadcrumbsStatus(p) === 'stale' },
  { key: 'missing', label: 'Missing', matches: p => breadcrumbsStatus(p) === 'missing' },
  {
    key: 'unparseable',
    label: 'Unparseable',
    matches: p => breadcrumbsStatus(p) === 'unparseable'
  },
  { key: 'structure', label: 'Invalid structure', matches: p => !p.isValid }
]

const matchesStatus = (project: ProjectFolder, filter: ProjectStatusFilter): boolean =>
  (FILTERS.find(f => f.key === filter) ?? FILTERS[0]).matches(project)

function cameraLabel(count: number): string {
  if (count === 0) return 'No cameras'
  return `${count} cam${count !== 1 ? 's' : ''}`
}

/**
 * Where a project sits below the scan root, or null when it is directly inside
 * it. Without a known root the full parent folder is returned.
 */
function locationBelowRoot(projectPath: string, rootPath?: string): string | null {
  const cut = Math.max(projectPath.lastIndexOf('/'), projectPath.lastIndexOf('\\'))
  const parent = cut > 0 ? projectPath.slice(0, cut) : ''
  if (!rootPath) return parent || null

  const root = rootPath.replace(/[/\\]+$/, '')
  if (parent === root) return null
  if (parent.startsWith(root) && /[/\\]/.test(parent.charAt(root.length))) {
    return parent.slice(root.length + 1)
  }
  return parent || null
}

/** Ticked when every shown row is ticked, a dash when only some are. */
function selectAllCheckState(shown: number, shownSelected: number) {
  if (shown > 0 && shownSelected === shown) return true
  return shownSelected > 0 ? ('indeterminate' as const) : false
}

const Separator: React.FC = () => <span aria-hidden="true">·</span>

interface ProjectMetaLineProps {
  project: ProjectFolder
  location: string | null
  onRepairProject?: (projectPath: string) => void
}

const ProjectMetaLine: React.FC<ProjectMetaLineProps> = ({
  project,
  location,
  onRepairProject
}) => {
  const status = STATUS_PRESENTATION[breadcrumbsStatus(project)]

  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      <span className={cn('inline-flex flex-shrink-0 items-center gap-1', status.text)}>
        <span className={cn('h-2 w-2 rounded-full', status.marker)} />
        <span className="font-medium">{status.label}</span>
      </span>

      {!project.isValid && (
        <>
          <Separator />
          <span className="text-destructive flex-shrink-0 font-medium">
            Invalid structure
          </span>
        </>
      )}

      <Separator />
      <span className="flex-shrink-0">{cameraLabel(project.cameraCount)}</span>

      {location && (
        <>
          <Separator />
          <span className="min-w-0 truncate" title={location}>
            in {location}
          </span>
        </>
      )}

      {project.invalidBreadcrumbs && onRepairProject && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onRepairProject(project.path)
          }}
          className="text-destructive ml-auto flex-shrink-0 text-xs font-medium underline-offset-2 hover:underline"
        >
          Repair
        </button>
      )}
    </div>
  )
}

const SORT_OPTIONS: ReadonlyArray<{ key: SortOrder; label: string }> = [
  { key: 'scan', label: 'Scan order' },
  { key: 'size', label: 'Size' }
]

/** Both sort orders stay visible; the active one is filled. */
const SortSwitch: React.FC<{
  sortOrder: SortOrder
  onChange: (order: SortOrder) => void
}> = ({ sortOrder, onChange }) => (
  <div
    className="bg-muted/60 ml-auto flex flex-shrink-0 gap-0.5 rounded-md p-0.5"
    role="group"
    aria-label="Sort projects"
  >
    {SORT_OPTIONS.map(option => (
      <button
        key={option.key}
        type="button"
        onClick={() => onChange(option.key)}
        aria-pressed={sortOrder === option.key}
        className={cn(
          'rounded px-2 py-0.5 text-xs font-medium transition-colors',
          sortOrder === option.key
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/** Status filter chips with counts. Hidden when "All" is the only one. */
const FilterChips: React.FC<{
  chips: ReadonlyArray<{ key: ProjectStatusFilter; label: string; count: number }>
  active: ProjectStatusFilter
  onChange: (filter: ProjectStatusFilter) => void
}> = ({ chips, active, onChange }) => {
  if (chips.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by state">
      {chips.map(chip => {
        const isActive = active === chip.key
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {chip.label}{' '}
            <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface ProjectListPanelProps {
  projects: ProjectFolder[]
  selectedProjects: string[]
  selectedProject: string | null
  /** Folder the scan started from; rows show locations relative to it. */
  rootPath?: string
  /**
   * Active status filter. Pass it together with `onStatusFilterChange` to
   * control the filter from outside (the scan summary's "need attention" link
   * does); leave both out and the panel keeps its own.
   */
  statusFilter?: ProjectStatusFilter
  onStatusFilterChange?: (filter: ProjectStatusFilter) => void
  onProjectSelection: (projectPath: string, isSelected: boolean) => void
  /** Tick or untick several projects at once (the header's select-all). */
  onSelectMany?: (projectPaths: string[], isSelected: boolean) => void
  onProjectClick: (projectPath: string) => void
  onRepairProject?: (projectPath: string) => void
  /**
   * Rendered under the rows (the batch bar). It is told how many ticked
   * projects the current filter is hiding, so it can say so.
   */
  footer?: (hiddenSelectedCount: number) => React.ReactNode
}

const ProjectListPanelComponent: React.FC<ProjectListPanelProps> = ({
  projects,
  selectedProjects,
  selectedProject,
  rootPath,
  statusFilter: controlledFilter,
  onStatusFilterChange,
  onProjectSelection,
  onSelectMany,
  onProjectClick,
  onRepairProject,
  footer
}) => {
  const shouldReduceMotion = useReducedMotion()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [ownFilter, setOwnFilter] = useState<ProjectStatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('scan')
  const [query, setQuery] = useState('')

  const statusFilter = controlledFilter ?? ownFilter
  const setStatusFilter = onStatusFilterChange ?? setOwnFilter

  // "All" is always offered; every other chip appears only when it would
  // match something.
  const filterChips = useMemo(
    () =>
      FILTERS.map(filter => ({
        key: filter.key,
        label: filter.label,
        count: projects.filter(filter.matches).length
      })).filter(chip => chip.key === 'all' || chip.count > 0),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = projects.filter(
      project =>
        matchesStatus(project, statusFilter) &&
        (normalized === '' ||
          project.name.toLowerCase().includes(normalized) ||
          project.path.toLowerCase().includes(normalized))
    )

    if (sortOrder === 'size') {
      // Largest first; projects with unknown size sink to the bottom rather
      // than masquerading as 0 bytes.
      return [...filtered].sort((a, b) => {
        const aSize = a.folderSizeBytes
        const bSize = b.folderSizeBytes
        if (aSize === undefined && bSize === undefined) return 0
        if (aSize === undefined) return 1
        if (bSize === undefined) return -1
        return bSize - aSize
      })
    }

    return filtered
  }, [projects, statusFilter, sortOrder, query])

  // The header checkbox speaks for the rows currently shown, so "filter to
  // Stale, then select all" selects exactly the stale projects.
  const shownPaths = useMemo(() => filteredProjects.map(p => p.path), [filteredProjects])
  const shownSelectedCount = useMemo(
    () => shownPaths.filter(path => selectedProjects.includes(path)).length,
    [shownPaths, selectedProjects]
  )
  const selectAllState = selectAllCheckState(shownPaths.length, shownSelectedCount)

  // Determine if we should use virtual scrolling based on list size
  const useVirtualScroll = filteredProjects.length >= VIRTUAL_SCROLLING_THRESHOLD

  // Disable staggered entrance animations when using virtual scrolling for performance
  const shouldAnimate = !shouldReduceMotion && !useVirtualScroll

  // Initialize virtualizer for large lists
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer returns unstable references by design; upstream TanStack Virtual fix required
  const virtualizer = useVirtualizer({
    count: filteredProjects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 5,
    enabled: useVirtualScroll,
    initialRect: { width: 320, height: 600 }
  })

  if (projects.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No projects found
      </div>
    )
  }

  const renderProjectItem = (
    project: ProjectFolder,
    index: number,
    virtualStyle?: React.CSSProperties
  ) => {
    const isSelected = selectedProject === project.path
    const isChecked = selectedProjects.includes(project.path)

    const content = (
      <div className="flex items-start gap-2.5">
        <Checkbox
          checked={isChecked}
          aria-label={`Select ${project.name}`}
          onCheckedChange={checked => onProjectSelection(project.path, checked === true)}
          onClick={e => e.stopPropagation()}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          {/* Name wraps to two lines; size keeps its own right-aligned column
              so sizes can be compared down the list. */}
          <div className="flex items-baseline gap-3">
            <p
              className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium [overflow-wrap:anywhere]"
              title={project.path}
            >
              {project.name}
            </p>
            {typeof project.folderSizeBytes === 'number' ? (
              <span className="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
                {formatFileSize(project.folderSizeBytes)}
              </span>
            ) : (
              <span className="text-warning flex-shrink-0 text-xs">size n/a</span>
            )}
          </div>

          <ProjectMetaLine
            project={project}
            location={locationBelowRoot(project.path, rootPath)}
            onRepairProject={onRepairProject}
          />
        </div>
      </div>
    )

    const rowClassName = cn(
      'border-border cursor-pointer border-b px-3 py-2',
      'transition-[background-color] duration-150 ease-out',
      'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2',
      isSelected
        ? 'bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]'
        : 'hover:bg-accent/50'
    )

    // For virtual scrolling, use regular divs with CSS hover; otherwise use motion.div with entrance animations
    if (useVirtualScroll) {
      return (
        <div
          key={project.path}
          ref={virtualizer.measureElement}
          data-index={index}
          style={virtualStyle}
          className={rowClassName}
          onClick={() => onProjectClick(project.path)}
          tabIndex={0}
          role="button"
          aria-pressed={isSelected}
        >
          {content}
        </div>
      )
    }

    return (
      <motion.div
        key={project.path}
        variants={shouldAnimate ? BAKER_ANIMATIONS.projectList.item : undefined}
        className={rowClassName}
        onClick={() => onProjectClick(project.path)}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border space-y-2 border-b p-3">
        <div className="flex items-center gap-2.5">
          {onSelectMany && (
            <Checkbox
              checked={selectAllState}
              disabled={shownPaths.length === 0}
              aria-label="Select all shown projects"
              title="Select all shown projects"
              onCheckedChange={checked => onSelectMany(shownPaths, checked === true)}
            />
          )}
          <h2 className="text-foreground text-sm font-semibold">Projects</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filteredProjects.length === projects.length
              ? projects.length
              : `${filteredProjects.length} of ${projects.length}`}
          </span>
          <SortSwitch sortOrder={sortOrder} onChange={setSortOrder} />
        </div>

        <Input
          placeholder="Filter projects…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-8 text-xs"
        />

        <FilterChips
          chips={filterChips}
          active={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          No projects match the current filter
        </div>
      ) : useVirtualScroll ? (
        <div
          ref={parentRef}
          className="min-h-0 flex-1 overflow-y-auto"
          data-virtual-container
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map(virtualItem => {
              const project = filteredProjects[virtualItem.index]
              return renderProjectItem(project, virtualItem.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`
              })
            })}
          </div>
        </div>
      ) : (
        <motion.div
          className="min-h-0 flex-1 overflow-y-auto"
          variants={shouldAnimate ? BAKER_ANIMATIONS.projectList.container : undefined}
          initial={shouldAnimate ? 'hidden' : false}
          animate={shouldAnimate ? 'show' : false}
        >
          {filteredProjects.map((project, index) => renderProjectItem(project, index))}
        </motion.div>
      )}

      {footer?.(selectedProjects.length - shownSelectedCount)}
    </div>
  )
}

// Wrap with React.memo for performance optimization (Phase 1.1)
// Prevents unnecessary re-renders when props haven't changed
export const ProjectListPanel = React.memo(ProjectListPanelComponent)
