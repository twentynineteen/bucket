/**
 * Project List Panel Component
 *
 * Compact left panel showing list of projects for selection.
 * Part of master-detail layout pattern.
 *
 * Animations:
 * - Staggered entrance animation when projects load
 * - Smooth hover effects on project rows
 * - Selection state transitions
 * - Pulse animation for warning badges
 */

import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import React from 'react'

import { BAKER_ANIMATIONS } from '@/constants/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { ProjectFolder } from '@/types/baker'

// Threshold for enabling virtual scrolling (performance optimization for large lists)
const VIRTUAL_SCROLLING_THRESHOLD = 50

// Utility function for conditional class names
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ')
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

  // Determine if we should use virtual scrolling based on list size
  const useVirtualScroll = projects.length >= VIRTUAL_SCROLLING_THRESHOLD

  // Disable staggered entrance animations when using virtual scrolling for performance
  const shouldAnimate = !shouldReduceMotion && !useVirtualScroll

  // Initialize virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: projects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90, // Estimated height of each project item
    overscan: 5,
    enabled: useVirtualScroll,
    initialRect: { width: 400, height: 600 }
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
          <p className="truncate text-sm font-medium">{project.name}</p>

          <div className="flex flex-wrap gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
                project.isValid
                  ? 'bg-success/20 text-success'
                  : 'bg-destructive/20 text-destructive'
              )}
            >
              {project.isValid ? 'Valid' : 'Invalid'}
            </span>

            {project.invalidBreadcrumbs && (
              <span className="bg-destructive/20 text-destructive inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium">
                Invalid BC
              </span>
            )}

            {project.hasBreadcrumbs && !project.invalidBreadcrumbs && (
              <motion.span
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
                  project.staleBreadcrumbs
                    ? 'bg-warning/20 text-warning'
                    : 'bg-success/20 text-success'
                )}
                animate={
                  shouldReduceMotion || !project.staleBreadcrumbs
                    ? undefined
                    : {
                        scale: BAKER_ANIMATIONS.statusBadge.pulse.scale
                      }
                }
                transition={
                  shouldReduceMotion || !project.staleBreadcrumbs
                    ? undefined
                    : BAKER_ANIMATIONS.statusBadge.pulse.transition
                }
              >
                {project.staleBreadcrumbs ? 'Stale' : 'Current'}
              </motion.span>
            )}

            {!project.hasBreadcrumbs && !project.invalidBreadcrumbs && (
              <span className="bg-muted text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium">
                No BC
              </span>
            )}

            <span className="bg-muted text-muted-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium">
              {project.cameraCount} cam{project.cameraCount !== 1 ? 's' : ''}
            </span>
          </div>
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
            // Transition properties (Phase 6: CSS-based animations - transform and colors)
            'transition-[transform,background-color] duration-150 ease-out',
            // Hover effects (Phase 6: CSS transforms instead of Framer Motion)
            'hover:scale-[1.005] hover:bg-accent/50',
            // Performance hint for transforms
            'will-change-transform',
            // Accessibility: Focus styles for keyboard navigation
            'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
            // Selected state
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
          // Phase 6: Replace Framer Motion whileHover with CSS transforms
          'transition-[transform,background-color] duration-150 ease-out',
          'hover:scale-[1.005] hover:bg-accent/50',
          'will-change-transform',
          // Accessibility: Focus styles
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
      <div className="border-border flex items-center gap-2 border-b p-4">
        <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
          3
        </div>
        <h2 className="text-foreground text-sm font-semibold">
          Found Projects ({projects.length})
        </h2>
      </div>

      {useVirtualScroll ? (
        <div ref={parentRef} className="flex-1 overflow-y-auto" data-virtual-container>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const project = projects[virtualItem.index]
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
          {projects.map((project, index) => renderProjectItem(project, index))}
        </motion.div>
      )}
    </div>
  )
}

// Wrap with React.memo for performance optimization (Phase 1.1)
// Prevents unnecessary re-renders when props haven't changed
export const ProjectListPanel = React.memo(ProjectListPanelComponent)
