/**
 * Project List Panel Component
 *
 * Fixed-width left panel showing the scanned projects with a text filter and
 * status filter chips. Part of the full-height master-detail layout.
 *
 * Animations:
 * - Staggered entrance animation when projects load
 * - Smooth hover effects on project rows
 * - Pulse animation for stale breadcrumb badges
 */

import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import React, { useMemo, useState } from 'react'

import { BAKER_ANIMATIONS } from '@shared/constants'
import { useReducedMotion } from '@shared/hooks'
import { Input } from '@shared/ui/input'
import type { ProjectFolder } from '../types'

// Threshold for enabling virtual scrolling (performance optimization for large lists)
const VIRTUAL_SCROLLING_THRESHOLD = 50

// Utility function for conditional class names
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
}

type StatusFilter = 'all' | 'stale' | 'nobc' | 'invalid'

const isStale = (project: ProjectFolder) =>
  project.hasBreadcrumbs && !project.invalidBreadcrumbs && project.staleBreadcrumbs
const isMissingBreadcrumbs = (project: ProjectFolder) =>
  !project.hasBreadcrumbs && !project.invalidBreadcrumbs
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

interface StatusPillProps {
  tone: 'success' | 'warning' | 'destructive' | 'muted'
  dot?: boolean
  children: React.ReactNode
}

const PILL_TONES: Record<StatusPillProps['tone'], string> = {
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  destructive: 'bg-destructive/20 text-destructive',
  muted: 'bg-muted text-muted-foreground'
}

const StatusPill: React.FC<StatusPillProps> = ({ tone, dot = true, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      PILL_TONES[tone]
    )}
  >
    {dot && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />}
    {children}
  </span>
)

interface ProjectStatusPillsProps {
  project: ProjectFolder
  shouldReduceMotion: boolean
}

const ProjectStatusPills: React.FC<ProjectStatusPillsProps> = ({
  project,
  shouldReduceMotion
}) => {
  const pulseStale = !shouldReduceMotion && project.staleBreadcrumbs

  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusPill tone={project.isValid ? 'success' : 'destructive'}>
        {project.isValid ? 'Valid' : 'Invalid'}
      </StatusPill>

      {project.invalidBreadcrumbs && (
        <StatusPill tone="destructive">Invalid BC</StatusPill>
      )}

      {project.hasBreadcrumbs && !project.invalidBreadcrumbs && (
        <motion.span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            project.staleBreadcrumbs
              ? 'bg-warning/20 text-warning'
              : 'bg-success/20 text-success'
          )}
          animate={
            pulseStale ? { scale: BAKER_ANIMATIONS.statusBadge.pulse.scale } : undefined
          }
          transition={
            pulseStale ? BAKER_ANIMATIONS.statusBadge.pulse.transition : undefined
          }
        >
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />
          {project.staleBreadcrumbs ? 'Stale' : 'Current'}
        </motion.span>
      )}

      {isMissingBreadcrumbs(project) && (
        <StatusPill tone="muted" dot={false}>
          No BC
        </StatusPill>
      )}

      <StatusPill tone="muted" dot={false}>
        {project.cameraCount} cam{project.cameraCount !== 1 ? 's' : ''}
      </StatusPill>
    </div>
  )
}

interface ProjectListPanelProps {
  projects: ProjectFolder[]
  selectedProjects: string[]
  selectedProject: string | null
  onProjectSelection: (projectPath: string, isSelected: boolean) => void
  onProjectClick: (projectPath: string) => void
}

const ProjectListPanelComponent: React.FC<ProjectListPanelProps> = ({
  projects,
  selectedProjects,
  selectedProject,
  onProjectSelection,
  onProjectClick
}) => {
  const shouldReduceMotion = useReducedMotion()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const filterChips = useMemo(
    () =>
      [
        { key: 'all' as const, label: 'All', count: projects.length },
        { key: 'stale' as const, label: 'Stale', count: projects.filter(isStale).length },
        {
          key: 'nobc' as const,
          label: 'No BC',
          count: projects.filter(isMissingBreadcrumbs).length
        },
        {
          key: 'invalid' as const,
          label: 'Invalid',
          count: projects.filter(isInvalid).length
        }
      ].filter((chip) => chip.key === 'all' || chip.count > 0),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return projects.filter(
      (project) =>
        matchesStatus(project, statusFilter) &&
        (normalized === '' ||
          project.name.toLowerCase().includes(normalized) ||
          project.path.toLowerCase().includes(normalized))
    )
  }, [projects, statusFilter, query])

  // Determine if we should use virtual scrolling based on list size
  const useVirtualScroll = filteredProjects.length >= VIRTUAL_SCROLLING_THRESHOLD

  // Disable staggered entrance animations when using virtual scrolling for performance
  const shouldAnimate = !shouldReduceMotion && !useVirtualScroll

  // Initialize virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: filteredProjects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 98, // Estimated height of each project item
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
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation()
            onProjectSelection(project.path, e.target.checked)
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 flex-shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm leading-snug font-medium [overflow-wrap:anywhere]">
            {project.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">{project.path}</p>

          <ProjectStatusPills project={project} shouldReduceMotion={shouldReduceMotion} />
        </div>
      </div>
    )

    // For virtual scrolling, use regular divs with CSS hover; otherwise use motion.div with entrance animations
    if (useVirtualScroll) {
      return (
        <div
          key={project.path}
          style={virtualStyle}
          className={cn(
            'border-border cursor-pointer border-b p-3',
            'transition-[background-color] duration-150 ease-out',
            'hover:bg-accent/50',
            'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
            isSelected && 'bg-accent'
          )}
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
        className={cn(
          'border-border cursor-pointer border-b p-3',
          'transition-[background-color] duration-150 ease-out',
          'hover:bg-accent/50',
          'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
          isSelected && 'bg-accent'
        )}
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
        <div className="flex items-center gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Projects
          </h2>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
            {projects.length}
          </span>
        </div>

        <Input
          placeholder="Filter projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-xs"
        />

        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStatusFilter(chip.key)}
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
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-sm">
          No projects match the current filter
        </div>
      ) : useVirtualScroll ? (
        <div ref={parentRef} className="flex-1 overflow-y-auto" data-virtual-container>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
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
          className="flex-1 overflow-y-auto"
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
