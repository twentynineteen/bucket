/**
 * Project List Panel Component
 *
 * Fixed-width left panel showing the scanned projects with a text filter and
 * status filter chips. Part of the full-height master-detail layout.
 *
 * Rows are two lines: the project name with its size, then its breadcrumbs
 * state and camera count. The scan root is not repeated on every row; a
 * project nested below the root shows only its location relative to it.
 *
 * Animations:
 * - Staggered entrance animation when projects load
 * - Smooth hover effects on project rows
 */

import { BAKER_ANIMATIONS } from '@shared/constants'
import { useReducedMotion } from '@shared/hooks'
import { Input } from '@shared/ui/input'
import { formatFileSize } from '@shared/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { ArrowDownWideNarrow } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { breadcrumbsStatus, STATUS_PRESENTATION } from '../internal/projectStatus'
import type { ProjectFolder } from '../types'

// Threshold for enabling virtual scrolling (performance optimization for large lists)
const VIRTUAL_SCROLLING_THRESHOLD = 50

// Height of one row, for the virtualizer's first estimate.
const ROW_HEIGHT_ESTIMATE = 54

// Utility function for conditional class names
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

type StatusFilter = 'all' | 'stale' | 'nobc' | 'invalid'
type SortOrder = 'scan' | 'size'

const isStale = (project: ProjectFolder) => breadcrumbsStatus(project) === 'stale'
const isMissingBreadcrumbs = (project: ProjectFolder) =>
  breadcrumbsStatus(project) === 'missing'
const isInvalid = (project: ProjectFolder) =>
  project.invalidBreadcrumbs || !project.isValid

const matchesStatus = (project: ProjectFolder, filter: StatusFilter): boolean => {
  switch (filter) {
    case 'stale':
      return isStale(project)
    case 'nobc':
      return isMissingBreadcrumbs(project)
    case 'invalid':
      return isInvalid(project)
    default:
      return true
  }
}

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
        <span className={cn('h-1.5 w-1.5 rounded-full', status.fill)} />
        <span className="font-medium">{status.label}</span>
      </span>

      {!project.isValid && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-destructive flex-shrink-0 font-medium">
            Invalid structure
          </span>
        </>
      )}

      <span aria-hidden="true">·</span>
      <span className="flex-shrink-0">{cameraLabel(project.cameraCount)}</span>

      {location && (
        <>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate" title={location}>
            {location}
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
          className="border-destructive/30 text-destructive hover:bg-destructive/10 ml-auto flex-shrink-0 rounded-full border px-2 text-xs font-medium transition-colors"
        >
          Repair
        </button>
      )}
    </div>
  )
}

/** One button that flips the list between scan order and largest first. */
const SortToggle: React.FC<{
  sortOrder: SortOrder
  onChange: (order: SortOrder) => void
}> = ({ sortOrder, onChange }) => {
  const bySize = sortOrder === 'size'
  return (
    <button
      type="button"
      onClick={() => onChange(bySize ? 'scan' : 'size')}
      aria-pressed={bySize}
      title={
        bySize
          ? 'Sorted largest first. Click for scan order.'
          : 'Sorted in scan order. Click for largest first.'
      }
      className={cn(
        'ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors',
        bySize
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      <ArrowDownWideNarrow className="h-3.5 w-3.5" />
      {bySize ? 'Largest first' : 'Scan order'}
    </button>
  )
}

interface ProjectListPanelProps {
  projects: ProjectFolder[]
  selectedProjects: string[]
  selectedProject: string | null
  /** Folder the scan started from; rows show locations relative to it. */
  rootPath?: string
  onProjectSelection: (projectPath: string, isSelected: boolean) => void
  /** Tick or untick several projects at once (the header's select-all). */
  onSelectMany?: (projectPaths: string[], isSelected: boolean) => void
  onProjectClick: (projectPath: string) => void
  onRepairProject?: (projectPath: string) => void
}

const ProjectListPanelComponent: React.FC<ProjectListPanelProps> = ({
  projects,
  selectedProjects,
  selectedProject,
  rootPath,
  onProjectSelection,
  onSelectMany,
  onProjectClick,
  onRepairProject
}) => {
  const shouldReduceMotion = useReducedMotion()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('scan')
  const [query, setQuery] = useState('')

  const filterChips = useMemo(
    () =>
      [
        { key: 'all' as const, label: 'All', count: projects.length },
        { key: 'stale' as const, label: 'Stale', count: projects.filter(isStale).length },
        {
          key: 'nobc' as const,
          label: 'Missing',
          count: projects.filter(isMissingBreadcrumbs).length
        },
        {
          key: 'invalid' as const,
          label: 'Invalid',
          count: projects.filter(isInvalid).length
        }
      ].filter(chip => chip.key === 'all' || chip.count > 0),
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
  const allShownSelected =
    shownPaths.length > 0 && shownSelectedCount === shownPaths.length
  const someShownSelected = shownSelectedCount > 0 && !allShownSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someShownSelected
  }, [someShownSelected])

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
        <input
          type="checkbox"
          checked={isChecked}
          aria-label={`Select ${project.name}`}
          onChange={e => {
            e.stopPropagation()
            onProjectSelection(project.path, e.target.checked)
          }}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 flex-shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-baseline gap-2">
            <p
              className="min-w-0 flex-1 truncate text-sm leading-snug font-medium"
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
      'hover:bg-accent/50',
      'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2',
      isSelected && 'bg-accent shadow-[inset_2px_0_0_var(--color-primary)]'
    )

    // For virtual scrolling, use regular divs with CSS hover; otherwise use motion.div with entrance animations
    if (useVirtualScroll) {
      return (
        <div
          key={project.path}
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
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allShownSelected}
              disabled={shownPaths.length === 0}
              aria-label="Select all shown projects"
              title="Select all shown projects"
              onChange={e => onSelectMany(shownPaths, e.target.checked)}
              className="flex-shrink-0"
            />
          )}
          <h2 className="text-foreground text-sm font-semibold">Projects</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filteredProjects.length === projects.length
              ? projects.length
              : `${filteredProjects.length} of ${projects.length}`}
          </span>

          <SortToggle sortOrder={sortOrder} onChange={setSortOrder} />
        </div>

        <Input
          placeholder="Filter projects…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-8 text-xs"
        />

        {filterChips.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                aria-pressed={statusFilter === chip.key}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  statusFilter === chip.key
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {chip.label}{' '}
                <span
                  className={
                    statusFilter === chip.key ? 'text-primary' : 'text-muted-foreground'
                  }
                >
                  {chip.count}
                </span>
              </button>
            ))}
          </div>
        )}
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
    </div>
  )
}

// Wrap with React.memo for performance optimization (Phase 1.1)
// Prevents unnecessary re-renders when props haven't changed
export const ProjectListPanel = React.memo(ProjectListPanelComponent)
