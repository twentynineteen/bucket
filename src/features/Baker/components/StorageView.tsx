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
import { fitTileName } from '../internal/tileLabel'
import { computeTreemapLayout } from '../internal/treemapLayout'
import type { ProjectFolder } from '../types'

// Beyond this many tiles the treemap becomes unreadable; the remainder is
// aggregated into a single "Other projects" tile.
const MAX_TREEMAP_TILES = 24

// Tile area is folder size; tile colour is the project's breadcrumbs state, so
// the map answers "where is the space, and is it accounted for" at once.
const LEGEND_ORDER: BreadcrumbsStatus[] = ['current', 'stale', 'missing', 'unparseable']

// A healthy project below this share of the total is too small to label as
// its own tile; two or more of them are drawn as one "smaller projects" tile.
// Projects that need attention always keep a tile of their own.
const SMALL_SHARE = 0.025

// A project that needs attention is drawn at no less than this share of the
// map, so its tile has room for its name. The boost stops just short of the
// next-larger project, so the map never shows a smaller project as the bigger
// one: size order always holds, and the size printed on the tile, its tooltip
// and the list below give the real figure.
const MIN_ATTENTION_SHARE = 0.045

/** Area a tile is given in the layout: its size, with the capped floor above. */
function tileWeight(
  entry: TreemapEntry,
  totalBytes: number,
  entries: TreemapEntry[]
): number {
  const needsAttention = entry.status !== null && entry.status !== 'current'
  if (!needsAttention) return entry.sizeBytes

  const larger = entries
    .filter(other => other.sizeBytes > entry.sizeBytes)
    .map(other => other.sizeBytes)
  const ceiling = larger.length > 0 ? Math.min(...larger) * 0.98 : Infinity
  const boosted = Math.min(totalBytes * MIN_ATTENTION_SHARE, ceiling)
  return Math.max(entry.sizeBytes, boosted)
}

let labelContext: CanvasRenderingContext2D | null | undefined

/**
 * Width of tile text as the browser will draw it (12px, in the page's font).
 * Where there is no canvas (tests) it falls back to an average glyph width.
 */
function measureText(text: string, weight: 400 | 500): number {
  if (labelContext === undefined) {
    labelContext =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d')
  }
  if (!labelContext) return text.length * 6.8
  labelContext.font = `${weight} 12px ${getComputedStyle(document.body).fontFamily}`
  return labelContext.measureText(text).width
}

const measureLabel = (text: string) => measureText(text, 500)
// Sizes are set in tabular figures, which run a little wider than measured.
const measureSize = (text: string) => measureText(text, 400) * 1.1

/**
 * Text inside a treemap tile, anchored top-left.
 *
 * The name sits over the size and is fitted by `fitTileName`: whole words,
 * an ellipsis after a complete word when it runs out of room, and a cut
 * inside a word only as the last resort for naming a narrow tile.
 */
const TileLabel: React.FC<{
  name: string
  size: string
  width: number
  height: number
  /** For a grouped tile: the projects it stands for, listed under the size. */
  members?: string[]
}> = ({ name, size, width, height, members }) => {
  // Room inside the tile after its border and padding: the text width, and
  // how many 17px name lines fit above the 16px size line.
  const textWidth = width - 16
  // The size is dropped before the name is: a tile too narrow for "71.5 GB"
  // can still say which project it is, and the list below gives the size.
  const showSize = measureSize(size) <= textWidth
  const sizeHeight = showSize ? 16 : 0
  const maxLines = Math.min(Math.floor((height - 12 - sizeHeight) / 17), 6)
  const lines = fitTileName(name, textWidth, maxLines, measureLabel)

  if (!showSize && lines.length === 0) return null

  // Whatever height is left under the size names the grouped projects.
  const spareLines = Math.floor((height - 12 - sizeHeight - lines.length * 17) / 17)
  const memberLines =
    members && spareLines > 0
      ? fitTileName(members.join(', '), textWidth, Math.min(spareLines, 3), measureSize)
      : []

  return (
    <span className="block min-w-0 text-xs">
      {lines.map((line, index) => (
        <span key={index} className="block leading-snug font-medium whitespace-nowrap">
          {line}
        </span>
      ))}
      {showSize && (
        <span className="text-muted-foreground block whitespace-nowrap tabular-nums">
          {size}
        </span>
      )}
      {memberLines.map((line, index) => (
        <span
          key={`member-${index}`}
          className="text-muted-foreground block leading-snug whitespace-nowrap"
        >
          {line}
        </span>
      ))}
    </span>
  )
}

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
  /** Names of the projects an aggregate tile stands for, for its tooltip. */
  members?: string[]
  /** Null for the aggregate tile, which mixes projects in different states. */
  status: BreadcrumbsStatus | null
}

/** Full name, size and state; for a grouped tile, the projects it stands for. */
function tileTooltip(entry: TreemapEntry): string {
  const size = formatFileSize(entry.sizeBytes)
  if (entry.members) return `${entry.label}, ${size}: ${entry.members.join(', ')}`
  const state = entry.status ? `, ${STATUS_PRESENTATION[entry.status].label}` : ''
  return `${entry.label}: ${size}${state}`
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
    // Grouped into one tile: everything past the tile limit, and healthy
    // projects too small to label. A project that needs attention is never
    // grouped while it is within the tile limit.
    const isSmallAndHealthy = (p: ProjectFolder) =>
      breadcrumbsStatus(p) === 'current' &&
      totalSizedBytes > 0 &&
      (p.folderSizeBytes ?? 0) / totalSizedBytes < SMALL_SHARE

    const withinLimit = sizedProjects.slice(0, MAX_TREEMAP_TILES)
    const small = withinLimit.filter(isSmallAndHealthy)
    // One small project gains nothing from being renamed "1 smaller project".
    const grouped =
      small.length >= 2
        ? [...small, ...sizedProjects.slice(MAX_TREEMAP_TILES)]
        : sizedProjects.slice(MAX_TREEMAP_TILES)
    const own = withinLimit.filter(p => !grouped.includes(p))

    const entries: TreemapEntry[] = own.map(p => ({
      key: p.path,
      label: p.name,
      sizeBytes: p.folderSizeBytes ?? 0,
      isAggregate: false,
      status: breadcrumbsStatus(p)
    }))

    if (grouped.length > 0) {
      entries.push({
        key: '__other__',
        label: `${grouped.length} smaller project${grouped.length !== 1 ? 's' : ''}`,
        sizeBytes: grouped.reduce((acc, p) => acc + (p.folderSizeBytes ?? 0), 0),
        isAggregate: true,
        status: null,
        members: grouped.map(p => p.name)
      })
    }
    return entries
  }, [sizedProjects, totalSizedBytes])

  const treemapRects = useMemo(
    () =>
      computeTreemapLayout(
        treemapEntries.map(e => ({
          key: e.key,
          weight: tileWeight(e, totalSizedBytes, treemapEntries)
        })),
        containerSize.width,
        containerSize.height
      ),
    [treemapEntries, containerSize, totalSizedBytes]
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
      <div className="border-border flex flex-shrink-0 items-center justify-between border-b px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Size by project</span>
          {unsizedProjects.length > 0 && (
            <span className="bg-warning/20 text-warning-text rounded-full px-2 py-0.5 text-xs font-medium">
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
      <div className="min-h-0 flex-1 px-6 py-4">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-lg"
        >
          {treemapEntries.map(entry => {
            const rect = treemapRects.find(r => r.key === entry.key)
            if (!rect || rect.width < 1 || rect.height < 1) return null

            // Only a sliver too small for any text goes unlabelled; the
            // tooltip and the list below still identify it.
            const showLabel = rect.width >= 48 && rect.height >= 22
            return (
              <button
                key={entry.key}
                type="button"
                title={tileTooltip(entry)}
                onClick={() => {
                  if (!entry.isAggregate) onProjectClick(entry.key)
                }}
                className={`absolute flex items-start overflow-hidden rounded-md border-2 px-1.5 py-1.5 text-left transition-colors ${
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
                  <TileLabel
                    name={entry.label}
                    size={formatFileSize(entry.sizeBytes)}
                    width={rect.width}
                    height={rect.height}
                    members={entry.members}
                  />
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
              className="border-border hover:bg-accent/50 grid w-full grid-cols-[minmax(0,24rem)_minmax(4rem,1fr)_4.5rem_3rem] items-center gap-4 border-b px-6 py-1.5 text-left transition-colors"
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
                  className={`block h-full rounded-full ${
                    STATUS_PRESENTATION[breadcrumbsStatus(project)].bar
                  }`}
                  style={{
                    width: `${Math.max(((project.folderSizeBytes ?? 0) / largestBytes) * 100, 1)}%`
                  }}
                />
              </span>
              <span className="text-foreground text-right text-xs font-medium tabular-nums">
                {formatFileSize(project.folderSizeBytes ?? 0)}
              </span>
              <span
                className="text-muted-foreground text-right text-xs tabular-nums"
                title="Share of the scanned total"
              >
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
            className="border-border hover:bg-accent/50 block w-full border-b px-6 py-2 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{project.name}</span>
              <span className="bg-warning/20 text-warning-text flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
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
