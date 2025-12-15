/**
 * Project List Component
 *
 * Displays list of discovered projects with selection and breadcrumb viewing.
 */

import { BreadcrumbsViewerEnhanced } from '@components/BreadcrumbsViewerEnhanced'
import { Button } from '@components/ui/button'
import { AlertTriangle, Eye, RefreshCw } from 'lucide-react'
import React from 'react'

import type { BreadcrumbsFile, BreadcrumbsPreview, ProjectFolder } from '@/types/baker'

interface ProjectListProps {
  projects: ProjectFolder[]
  selectedProjects: string[]
  onProjectSelection: (projectPath: string, isSelected: boolean) => void
  onViewBreadcrumbs: (projectPath: string) => void
  onTogglePreview: (projectPath: string) => void
  expandedProject: string | null
  previewProject: string | null
  breadcrumbs: BreadcrumbsFile | null
  isLoadingBreadcrumbs: boolean
  breadcrumbsError: string | null
  getPreview: (projectPath: string) => BreadcrumbsPreview | null
  trelloApiKey?: string
  trelloApiToken?: string
}

const ProjectListComponent: React.FC<ProjectListProps> = ({
  projects,
  selectedProjects,
  onProjectSelection,
  onViewBreadcrumbs,
  onTogglePreview,
  expandedProject,
  previewProject,
  breadcrumbs,
  isLoadingBreadcrumbs,
  breadcrumbsError,
  getPreview,
  trelloApiKey,
  trelloApiToken
}) => {
  if (projects.length === 0) {
    return (
      <div className="bg-card border-border text-muted-foreground rounded-xl border p-4 text-center shadow-sm">
        No projects found
      </div>
    )
  }

  return (
    <div className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
          3
        </div>
        <h2 className="text-foreground text-sm font-semibold">
          Found Projects ({projects.length})
        </h2>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {projects.map((project: ProjectFolder) => (
          <div
            key={project.path}
            className="border-border bg-background/50 hover:bg-background rounded-lg border transition-colors"
          >
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedProjects.includes(project.path)}
                  onChange={(e) => onProjectSelection(project.path, e.target.checked)}
                />
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-muted-foreground max-w-md truncate text-sm">
                    {project.path}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-2 text-xs">
                  <span
                    className={`rounded px-2 py-1 ${project.isValid ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}
                  >
                    {project.isValid ? 'Valid' : 'Invalid'}
                  </span>
                  <span
                    className={`rounded px-2 py-1 ${
                      project.invalidBreadcrumbs
                        ? 'bg-destructive/20 text-destructive'
                        : project.hasBreadcrumbs
                          ? 'bg-info/20 text-info'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {project.invalidBreadcrumbs
                      ? 'Invalid breadcrumbs'
                      : project.hasBreadcrumbs
                        ? 'Has breadcrumbs'
                        : 'Missing breadcrumbs'}
                  </span>
                  {project.hasBreadcrumbs && (
                    <span
                      className={`rounded px-2 py-1 ${project.staleBreadcrumbs ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}
                    >
                      {project.staleBreadcrumbs ? 'Stale breadcrumbs' : 'Up to date'}
                    </span>
                  )}
                  <span className="bg-muted text-muted-foreground rounded px-2 py-1">
                    {project.cameraCount} camera{project.cameraCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {(project.hasBreadcrumbs || project.invalidBreadcrumbs) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewBreadcrumbs(project.path)}
                    className="ml-2 gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {expandedProject === project.path
                      ? 'Hide'
                      : project.invalidBreadcrumbs
                        ? 'View (Corrupted)'
                        : 'View'}
                  </Button>
                )}
              </div>
            </div>

            {/* Breadcrumbs Viewer */}
            {expandedProject === project.path && (
              <div className="border-t p-3">
                {isLoadingBreadcrumbs ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">
                      Loading breadcrumbs...
                    </span>
                  </div>
                ) : breadcrumbsError ? (
                  <div className="text-destructive flex items-center justify-center py-4">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    <span className="text-sm">{breadcrumbsError}</span>
                  </div>
                ) : breadcrumbs ? (
                  <BreadcrumbsViewerEnhanced
                    breadcrumbs={breadcrumbs}
                    projectPath={project.path}
                    previewMode={previewProject === project.path}
                    preview={getPreview(project.path)}
                    onTogglePreview={() => onTogglePreview(project.path)}
                    trelloApiKey={trelloApiKey}
                    trelloApiToken={trelloApiToken}
                  />
                ) : (
                  <div className="text-muted-foreground flex items-center justify-center py-4">
                    <span className="text-sm">No breadcrumbs data found</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Wrap with React.memo for performance optimization (Phase 1.2)
// Prevents unnecessary re-renders when props haven't changed
export const ProjectList = React.memo(ProjectListComponent)
