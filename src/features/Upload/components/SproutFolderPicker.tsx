/**
 * SproutFolderPicker (issue #155)
 *
 * Chooses the Sprout folder an upload lands in.
 *
 * **One panel, drilled into — not flyout submenus.** Nested Radix submenus need
 * horizontal room for every level, and each level here is as wide as the trigger
 * so long folder names stay readable. In a laptop-width window that runs out of
 * space by the second or third level: Radix flips the submenu to the left, and
 * when that does not fit either it overflows the window and the names are
 * unreadable. Drilling into one panel is depth-independent — the width never
 * changes, so it cannot collide however deep the hierarchy goes.
 *
 * Two details are load-bearing and look cosmetic if you skim them:
 *
 * 1. `modal={false}` — the menu renders inside AddVideoDialog, and a modal
 *    dropdown nested in a modal dialog leaves `pointer-events: none` on the body.
 * 2. The filter input stops its own keydown from bubbling. Radix fires typeahead
 *    for any single character typed anywhere inside menu content and moves DOM
 *    focus onto the matching item, so without this the box takes exactly one
 *    character and then goes dead.
 */
import { queryKeys } from '@shared/lib'
import type { GetFoldersResponse, SproutFolder } from '@shared/types'
import { Button, buttonVariants } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Skeleton } from '@shared/ui/skeleton'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  Search
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { useSproutFolders } from '../hooks/useSproutFolders'
import type { SelectedSproutFolder } from '../types'

/**
 * The menu matches its trigger's width. Search results carry a full breadcrumb
 * (`2026 Projects / MSc / Module X`), which a narrow menu truncates to
 * uselessness. Safe to be this wide precisely because there are no submenus.
 */
const MENU_WIDTH =
  'w-[var(--radix-dropdown-menu-trigger-width)] min-w-[20rem] max-w-[min(92vw,44rem)]'

/** Radix menus do not scroll, and the base class is `overflow-hidden`. */
const MENU_SCROLL = 'max-h-[320px] overflow-x-hidden overflow-y-auto'

export interface SproutFolderPickerProps {
  /** Sprout API key. Without one the picker is disabled with an explanation. */
  apiKey: string | null
  /** Currently chosen folder, or null for the account root. */
  value: SelectedSproutFolder | null
  /** Called when the user picks a folder, or Root (null). */
  onChange: (folder: SelectedSproutFolder | null) => void
  /** Recently used folders, most recent first. Pinned above the tree. */
  recentFolders?: SelectedSproutFolder[]
  /** Disables the control (e.g. while an upload is running). */
  disabled?: boolean
}

/** Flattens every folder level currently in the query cache, with its path. */
function useLoadedFolderIndex(apiKey: string | null, filterKey: string) {
  const queryClient = useQueryClient()

  return useMemo(() => {
    if (!apiKey || !filterKey) return []

    // Only levels the user has already opened are in cache, so this searches
    // exactly what is visible and issues no requests. See issue #155 R1.
    const entries = queryClient.getQueriesData<GetFoldersResponse>({
      queryKey: queryKeys.sprout.all
    })

    const byId = new Map<string, SproutFolder>()
    for (const [, data] of entries) {
      for (const folder of data?.folders ?? []) byId.set(folder.id, folder)
    }

    const pathOf = (folder: SproutFolder): string => {
      const segments: string[] = [folder.name]
      let cursor = folder.parent_id
      // Guard against a cycle in malformed data rather than hanging the UI.
      const seen = new Set<string>([folder.id])
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor)
        const parent = byId.get(cursor)
        if (!parent) break
        segments.unshift(parent.name)
        cursor = parent.parent_id
      }
      return segments.join(' / ')
    }

    return [...byId.values()]
      .map((folder) => ({ id: folder.id, name: folder.name, path: pathOf(folder) }))
      .sort((a, b) => a.path.localeCompare(b.path))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey is the
    // intentional recompute trigger; queryClient is stable and carries no data.
  }, [apiKey, filterKey, queryClient])
}

interface FilterResultsProps {
  matches: SelectedSproutFolder[]
  loadedCount: number
  onSelect: (folder: SelectedSproutFolder) => void
}

/** Filter hits, rendered path-labelled. Searches cache only -- never fetches. */
const FilterResults: React.FC<FilterResultsProps> = ({
  matches,
  loadedCount,
  onSelect
}) => (
  <>
    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
      {matches.length} of {loadedCount} loaded folders
    </DropdownMenuLabel>
    {matches.length === 0 && (
      <p className="text-muted-foreground px-2 py-1.5 text-xs">
        No match among folders opened this session. Filtering never fetches — open a level
        to include it.
      </p>
    )}
    {matches.map((folder) => (
      <DropdownMenuItem key={folder.id} onSelect={() => onSelect(folder)}>
        <Folder className="text-muted-foreground shrink-0" />
        <span className="truncate" title={folder.path}>
          {folder.path}
        </span>
      </DropdownMenuItem>
    ))}
  </>
)

export const SproutFolderPicker: React.FC<SproutFolderPickerProps> = ({
  apiKey,
  value,
  onChange,
  recentFolders = [],
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  /** Folders drilled into, outermost first. Empty means the account root. */
  const [trail, setTrail] = useState<SelectedSproutFolder[]>([])

  const current = trail.length > 0 ? trail[trail.length - 1] : null

  // Fetched on an explicit click (opening the menu, or drilling in), so no dwell
  // gate is needed -- nothing here fetches on hover at all.
  const level = useSproutFolders({
    apiKey,
    parentId: current?.id ?? null,
    isOpen,
    immediate: true
  })

  const loadedFolders = useLoadedFolderIndex(apiKey, filter.trim())

  const matches = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return []
    return loadedFolders.filter((folder) => folder.path.toLowerCase().includes(query))
  }, [filter, loadedFolders])

  const close = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Start from the root next time rather than mid-hierarchy.
      setTrail([])
      setFilter('')
    }
  }

  const select = (folder: SelectedSproutFolder | null) => {
    onChange(folder)
    close(false)
  }

  const drillInto = (folder: SproutFolder) => {
    const path = current ? `${current.path} / ${folder.name}` : folder.name
    setTrail([...trail, { id: folder.id, name: folder.name, path }])
  }

  const goBack = () => setTrail(trail.slice(0, -1))

  const label = value ? `Folder: ${value.path}` : 'Folder: Root (no folder)'
  const children = level.data?.folders ?? []

  if (!apiKey) {
    return (
      <button
        type="button"
        disabled
        className={`${buttonVariants({ variant: 'outline' })} w-full justify-start`}
        title="Add your Sprout Video API key in Settings to choose a folder"
      >
        <Folder className="mr-2 h-4 w-4" />
        Folder: Root — add an API key in Settings to change this
      </button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={close} modal={false}>
      {/*
        Styled directly rather than `asChild` + <Button>. `@shared/ui/button` is
        a Framer Motion component, and composing a motion element through Radix's
        Slot makes the popper's ref callback fire on every render -- an infinite
        update loop. buttonVariants() gives the identical appearance with none of
        that. Do not "simplify" this back to asChild.
      */}
      <DropdownMenuTrigger
        disabled={disabled}
        className={`${buttonVariants({ variant: 'outline' })} w-full justify-start`}
      >
        <Folder className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className={`${MENU_WIDTH} ${MENU_SCROLL}`}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            aria-label="Filter loaded folders"
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-hidden"
            placeholder="Filter loaded folders…"
            value={filter}
            autoFocus
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              // Let Radix keep navigation and dismissal; swallow the rest so
              // typeahead cannot steal focus mid-word. See note 2 in the header.
              const navigational =
                event.key === 'Escape' ||
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Enter' ||
                event.key === 'Tab'
              if (!navigational) event.stopPropagation()
            }}
          />
        </div>
        <DropdownMenuSeparator />

        {filter.trim() ? (
          <FilterResults
            matches={matches}
            loadedCount={loadedFolders.length}
            onSelect={select}
          />
        ) : (
          <>
            {current ? (
              <>
                {/* Drilling keeps the menu open, so these must not auto-close. */}
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    goBack()
                  }}
                >
                  <ChevronLeft className="text-muted-foreground shrink-0" />
                  Back
                </DropdownMenuItem>
                <DropdownMenuLabel
                  className="text-muted-foreground text-xs font-normal"
                  title={current.path}
                >
                  <span className="block truncate">{current.path}</span>
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => select(current)}>
                  <FolderOpen className="text-muted-foreground shrink-0" />
                  Use this folder
                  {value?.id === current.id && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : (
              <>
                {recentFolders.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                      Recent
                    </DropdownMenuLabel>
                    {recentFolders.map((folder) => (
                      <DropdownMenuItem
                        key={`recent-${folder.id}`}
                        onSelect={() => select(folder)}
                      >
                        <Folder className="text-muted-foreground shrink-0" />
                        <span className="truncate" title={folder.path}>
                          {folder.path}
                        </span>
                        {value?.id === folder.id && (
                          <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onSelect={() => select(null)}>
                  <FolderOpen className="text-muted-foreground shrink-0" />
                  Root (no folder)
                  {value === null && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                </DropdownMenuItem>
              </>
            )}

            {level.isLoading && (
              <div className="space-y-1 p-1" data-testid="folder-level-loading">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-40" />
              </div>
            )}

            {level.isError && (
              <div className="px-2 py-1.5">
                <p className="text-destructive flex items-start gap-1.5 text-xs">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{String(level.error)}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={(event) => {
                    event.preventDefault()
                    void level.refetch()
                  }}
                >
                  Retry
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  You can still upload to the root folder.
                </p>
              </div>
            )}

            {!level.isLoading && !level.isError && children.length === 0 && (
              <p className="text-muted-foreground px-2 py-1.5 text-xs">No subfolders</p>
            )}

            {children.map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onSelect={(event) => {
                  event.preventDefault()
                  drillInto(folder)
                }}
              >
                <Folder className="text-muted-foreground shrink-0" />
                <span className="truncate" title={folder.name}>
                  {folder.name}
                </span>
                {value?.id === folder.id && (
                  <Check className="ml-2 h-3.5 w-3.5 shrink-0" />
                )}
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-60" />
              </DropdownMenuItem>
            ))}

            {level.data?.truncated && (
              <p className="text-muted-foreground border-t px-2 py-1.5 text-xs">
                Showing the first {children.length}
                {level.data.total ? ` of ${level.data.total}` : ''} folders
              </p>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SproutFolderPicker
