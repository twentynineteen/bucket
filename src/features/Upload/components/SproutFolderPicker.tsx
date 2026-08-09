/**
 * SproutFolderPicker (issue #155)
 *
 * Chooses the Sprout folder an upload lands in. Built on Radix submenus so the
 * keyboard and a11y behaviour is Radix's rather than hand-rolled.
 *
 * Three details here are load-bearing and look like styling if you skim them:
 *
 * 1. `modal={false}` -- the menu renders inside AddVideoDialog, and a modal
 *    dropdown nested in a modal dialog leaves `pointer-events: none` on the body.
 * 2. `max-h` + explicit per-axis overflow on every menu surface -- the base
 *    class sets `overflow-hidden` and Radix menus do not scroll, so a level with
 *    40 folders would be clipped with its tail unreachable. That would defeat
 *    the backend pagination fix entirely.
 * 3. The filter input stops its own keydown from bubbling -- Radix fires
 *    typeahead for any single character typed anywhere inside menu content, and
 *    typeahead moves DOM focus onto a menu item. Without this the box accepts
 *    exactly one character and then goes dead.
 */
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib'
import type { GetFoldersResponse, SproutFolder } from '@shared/types'
import { Button, buttonVariants } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Skeleton } from '@shared/ui/skeleton'
import { AlertCircle, Check, ChevronDown, Folder, FolderOpen, Search } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { useSproutFolders } from '../hooks/useSproutFolders'
import type { SelectedSproutFolder } from '../types'

/** Shared by every menu surface. See note 2 in the file header. */
const MENU_SCROLL = 'max-h-[300px] overflow-x-hidden overflow-y-auto'

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
function useLoadedFolderIndex(apiKey: string | null) {
  const queryClient = useQueryClient()

  return useMemo(() => {
    if (!apiKey) return []

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
  }, [apiKey, queryClient])
}

interface FolderSubmenuProps {
  apiKey: string
  folder: SproutFolder
  path: string
  selectedId: string | null
  onSelect: (folder: SelectedSproutFolder) => void
}

/** One folder as a submenu: pick it, or open it to reach its children. */
const FolderSubmenu: React.FC<FolderSubmenuProps> = ({
  apiKey,
  folder,
  path,
  selectedId,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useSproutFolders({
    apiKey,
    parentId: folder.id,
    isOpen
  })

  const children = data?.folders ?? []

  return (
    <DropdownMenuSub open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuSubTrigger>
        <Folder className="text-muted-foreground" />
        <span className="truncate">{folder.name}</span>
        {selectedId === folder.id && <Check className="ml-2 h-3.5 w-3.5" />}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className={MENU_SCROLL}>
        {/* Selecting is a distinct action from opening -- the ambiguity in the
            old FolderTreeSprout was that one click did both. */}
        <DropdownMenuItem
          onSelect={() => onSelect({ id: folder.id, name: folder.name, path })}
        >
          <FolderOpen className="text-muted-foreground" />
          Use this folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {isLoading && (
          <div className="space-y-1 p-1" data-testid="folder-level-loading">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-32" />
          </div>
        )}

        {isError && (
          <div className="px-2 py-1.5">
            <p className="text-destructive flex items-start gap-1.5 text-xs">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{String(error)}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full text-xs"
              onClick={(event) => {
                event.preventDefault()
                void refetch()
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && children.length === 0 && (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">No subfolders</p>
        )}

        {children.map((child) => (
          <FolderSubmenu
            key={child.id}
            apiKey={apiKey}
            folder={child}
            path={`${path} / ${child.name}`}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}

        {data?.truncated && (
          <p className="text-muted-foreground border-t px-2 py-1.5 text-xs">
            Showing the first {children.length}
            {data.total ? ` of ${data.total}` : ''} folders
          </p>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
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
        <Folder className="text-muted-foreground" />
        <span className="truncate">{folder.path}</span>
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

  const rootLevel = useSproutFolders({ apiKey, parentId: null, isOpen })
  const loadedFolders = useLoadedFolderIndex(apiKey)

  const matches = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return []
    return loadedFolders.filter((folder) => folder.path.toLowerCase().includes(query))
  }, [filter, loadedFolders])

  const select = (folder: SelectedSproutFolder | null) => {
    onChange(folder)
    setFilter('')
    setIsOpen(false)
  }

  const label = value ? `Folder: ${value.path}` : 'Folder: Root (no folder)'

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
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
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

      <DropdownMenuContent align="start" className={`w-72 ${MENU_SCROLL}`}>
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
              // typeahead cannot steal focus mid-word. See note 3 in the header.
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
                    <Folder className="text-muted-foreground" />
                    <span className="truncate">{folder.path}</span>
                    {value?.id === folder.id && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onSelect={() => select(null)}>
              <FolderOpen className="text-muted-foreground" />
              Root (no folder)
              {value === null && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>

            {rootLevel.isLoading && (
              <div className="space-y-1 p-1" data-testid="folder-root-loading">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-40" />
              </div>
            )}

            {rootLevel.isError && (
              <div className="px-2 py-1.5">
                <p className="text-destructive flex items-start gap-1.5 text-xs">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{String(rootLevel.error)}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={(event) => {
                    event.preventDefault()
                    void rootLevel.refetch()
                  }}
                >
                  Retry
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">
                  You can still upload to the root folder.
                </p>
              </div>
            )}

            {(rootLevel.data?.folders ?? []).map((folder) => (
              <FolderSubmenu
                key={folder.id}
                apiKey={apiKey}
                folder={folder}
                path={folder.name}
                selectedId={value?.id ?? null}
                onSelect={select}
              />
            ))}

            {rootLevel.data?.truncated && (
              <p className="text-muted-foreground border-t px-2 py-1.5 text-xs">
                Showing the first {rootLevel.data.folders.length}
                {rootLevel.data.total ? ` of ${rootLevel.data.total}` : ''} folders
              </p>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SproutFolderPicker
