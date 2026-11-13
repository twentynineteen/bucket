/**
 * Storage View Component
 *
 * Visual "storage map" of the scanned drive: a squarified treemap of project
 * folder sizes plus a sorted breakdown table, with a size-only "Refresh sizes"
 * action that rewrites folderSizeBytes in the selected breadcrumbs files.
 *
 * Projects whose size could not be determined during the scan are shown in a
 * separate "size unavailable" section rather than being rendered as 0 bytes.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import { Button } from '@shared/ui/button'
import { formatFileSize } from '@shared/utils'
import { RefreshCw } from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useRefreshBreadcrumbSizes } from '../hooks/useRefreshBreadcrumbSizes'
import {
  breadcrumbsStatus,
  STATUS_PRESENTATION,
  type BreadcrumbsStatus
} from '../internal/projectStatus'
import { computeTreemapLayout } from '../internal/treemapLayout'
import type { ProjectFolder } from '../types'

// Beyond this many tiles the treemap becomes unreadable; the remainder is
// aggregated into a single "Other projects" tile.
const MAX_TREEMAP_TILES = 24

// Tile area is folder size; tile colour is the project's breadcrumbs state, so
// the map answers "where is the space, and is it accounted for" at once.
const LEGEND_ORDER: BreadcrumbsStatus[] = ['current', 'stale', 'missing', 'unparseable']

interface StorageViewProps {
  projects: ProjectFolder[]
  onProjectClick: (projectPath: string) => void
  onRefreshComplete?: () => void
}

interface TreemapEntry {
  key: string
  label: string
  sizeBytes: number
  isAggregate: boolean
  /** Null for the aggregate tile, which mixes projects in different states. */
  status: BreadcrumbsStatus | null
}

export const StorageView: React.FC<StorageViewProps> = ({
  projects,
  onProjectClick,
  onRefreshComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [showRefreshConfirmation, setShowRefreshConfirmation] = useState(false)
  const { refreshSizes, isRefreshing } = useRefreshBreadcrumbSizes()

  React.useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const sizedProjects = useMemo(
    () =>
      projects
        .filter(p => typeof p.folderSizeBytes === 'number')
        .sort((a, b) => (b.folderSizeBytes ?? 0) - (a.folderSizeBytes ?? 0)),
    [projects]
  )

  const unsizedProjects = useMemo(
    () => projects.filter(p => typeof p.folderSizeBytes !== 'number'),
    [projects]
  )

  const totalSizedBytes = useMemo(
    () => sizedProjects.reduce((acc, p) => acc + (p.folderSizeBytes ?? 0), 0),
    [sizedProjects]
  )

  // sizedProjects is sorted largest first; guard against a zero-byte maximum.
  const largestBytes = Math.max(sizedProjects[0]?.folderSizeBytes ?? 0, 1)

  const refreshablePaths = useMemo(
    () =>
      projects.filter(p => p.hasBreadcrumbs && !p.invalidBreadcrumbs).map(p => p.path),
    [projects]
  )

  const treemapEntries = useMemo<TreemapEntry[]>(() => {
    const top = sizedProjects.slice(0, MAX_TREEMAP_TILES)
    const rest = sizedProjects.slice(MAX_TREEMAP_TILES)
    const entries: TreemapEntry[] = top.map(p => ({
      key: p.path,
      label: p.name,
      sizeBytes: p.folderSizeBytes ?? 0,
      isAggregate: false,
      status: breadcrumbsStatus(p)
    }))

    if (rest.length > 0) {
      entries.push({
        key: '__other__',
        label: `Other projects (${rest.length})`,
        sizeBytes: rest.reduce((acc, p) => acc + (p.folderSizeBytes ?? 0), 0),
        isAggregate: true,
        status: null
      })
    }
    return entries
  }, [sizedProjects])

  const treemapRects = useMemo(
    () =>
      computeTreemapLayout(
        treemapEntries.map(e => ({ key: e.key, weight: e.sizeBytes })),
        containerSize.width,
        containerSize.height
      ),
    [treemapEntries, containerSize]
  )

  const handleConfirmRefresh = async () => {
    setShowRefreshConfirmation(false)
    try {
      const result = await refreshSizes(refreshablePaths)
      if (result.failed.length > 0) {
        toast.error(
          `Sizes refreshed for ${result.successful.length} project(s), ` +
            `${result.failed.length} failed:\n` +
            result.failed.map(f => `• ${f.path}: ${f.error}`).join('\n')
        )
      } else {
        toast.success(`Sizes refreshed for ${result.successful.length} project(s)`)
      }
      onRefreshComplete?.()
    } catch (error) {
      toast.error(`Failed to refresh sizes: ${error}`)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No projects found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar: totals + refresh action */}
      <div className="border-border flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Size by project</span>
          {unsizedProjects.length > 0 && (
            <span className="bg-warning/20 text-warning rounded-full px-2 py-0.5 text-xs font-medium">
              {unsizedProjects.length} size unavailable
            </span>
          )}
          <ul
            className="text-muted-foreground ml-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
            aria-label="Tile colours"
          >
            {LEGEND_ORDER.filter(status =>
              sizedProjects.some(p => breadcrumbsStatus(p) === status)
            ).map(status => (
              <li key={status} className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-sm ${STATUS_PRESENTATION[status].marker}`}
                />
                {STATUS_PRESENTATION[status].label}
              </li>
            ))}
          </ul>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isRefreshing || refreshablePaths.length === 0}
          onClick={() => setShowRefreshConfirmation(true)}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing sizes…' : 'Refresh sizes'}
        </Button>
      </div>

      {/* Treemap */}
      <div className="min-h-0 flex-1 p-4">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-lg"
        >
          {treemapEntries.map(entry => {
            const rect = treemapRects.find(r => r.key === entry.key)
            if (!rect || rect.width < 1 || rect.height < 1) return null

            const showLabel = rect.width >= 60 && rect.height >= 32
            return (
              <button
                key={entry.key}
                type="button"
                title={`${entry.label}: ${formatFileSize(entry.sizeBytes)}${
                  entry.status ? `, ${STATUS_PRESENTATION[entry.status].label}` : ''
                }`}
                onClick={() => {
                  if (!entry.isAggregate) onProjectClick(entry.key)
                }}
                className={`absolute overflow-hidden rounded-md border-2 px-2 py-1.5 text-left transition-colors ${
                  entry.status
                    ? STATUS_PRESENTATION[entry.status].tile
                    : 'border-background bg-muted/50 hover:bg-muted text-foreground'
                }`}
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height
                }}
              >
                {showLabel && (
                  <span className="block text-xs font-medium">
                    {/* Tall tiles give the name a second line before cutting it */}
                    <span
                      className={
                        rect.height >= 64 ? 'line-clamp-2 leading-snug' : 'block truncate'
                      }
                    >
                      {entry.label}
                    </span>
                    <span className="text-muted-foreground block truncate font-normal tabular-nums">
                      {formatFileSize(entry.sizeBytes)}
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sorted breakdown table */}
      <div className="border-border max-h-56 flex-shrink-0 overflow-y-auto border-t">
        {sizedProjects.map(project => {
          const share =
            totalSizedBytes > 0 ? (project.folderSizeBytes ?? 0) / totalSizedBytes : 0
          return (
            <button
              key={project.path}
              type="button"
              onClick={() => onProjectClick(project.path)}
              className="border-border hover:bg-accent/50 grid w-full grid-cols-[minmax(0,20rem)_minmax(3rem,1fr)_9rem] items-center gap-4 border-b px-4 py-1.5 text-left transition-colors"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    STATUS_PRESENTATION[breadcrumbsStatus(project)].marker
                  }`}
                  title={STATUS_PRESENTATION[breadcrumbsStatus(project)].label}
                />
                <span className="truncate" title={project.name}>
                  {project.name}
                </span>
              </span>
              {/* Size as a bar beside the name, scaled to the largest project
                  so the longest bar fills its track. */}
              <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-foreground/50 block h-full rounded-full"
                  style={{
                    width: `${Math.max(((project.folderSizeBytes ?? 0) / largestBytes) * 100, 1)}%`
                  }}
                />
              </span>
              <span className="text-muted-foreground text-right text-xs tabular-nums">
                {formatFileSize(project.folderSizeBytes ?? 0)} ·{' '}
                {(share * 100).toFixed(1)}%
              </span>
            </button>
          )
        })}
        {unsizedProjects.map(project => (
          <button
            key={project.path}
            type="button"
            onClick={() => onProjectClick(project.path)}
            className="border-border hover:bg-accent/50 block w-full border-b px-4 py-2 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{project.name}</span>
              <span className="bg-warning/20 text-warning flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                size unavailable
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Size-only refresh confirmation */}
      <AlertDialog
        open={showRefreshConfirmation}
        onOpenChange={setShowRefreshConfirmation}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh folder sizes?</AlertDialogTitle>
            <AlertDialogDescription>
              This recalculates the on-disk size of {refreshablePaths.length} project
              {refreshablePaths.length !== 1 ? 's' : ''} and updates only the
              folderSizeBytes field in each breadcrumbs.json. All other breadcrumb fields
              are left untouched. On network drives this can take a while.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRefresh}>
              Refresh sizes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
