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
 * 1. The menu is MODAL (Radix's default - no `modal` prop). Inside
 *    AddVideoDialog, the dialog's scroll lock cancels wheel events over
 *    anything portalled outside its subtree; a modal menu mounts its own
 *    scroll lock above the dialog's, which is the only thing that lets the
 *    folder list scroll there (issue #191). An earlier `modal={false}`
 *    workaround - for a Radix bug that left `pointer-events: none` on the
 *    body after nested modals closed - made every folder below the fold
 *    unreachable; that bug no longer reproduces on the current Radix version,
 *    and folder-picker-dialog-scroll.spec.ts guards both behaviours.
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

import { useSproutFolderIndex } from '../hooks/useSproutFolderIndex'
import { useSproutFolders } from '../hooks/useSproutFolders'
import { matchFolders, withPaths } from '../internal/folderPaths'
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

/** Folders in the live query cache — levels the user has opened this session. */
function useLoadedFolderIndex(apiKey: string | null, filterKey: string) {
  const queryClient = useQueryClient()

  return useMemo(() => {
    if (!apiKey || !filterKey) return []

    const entries = queryClient.getQueriesData<GetFoldersResponse>({
      queryKey: queryKeys.sprout.all
    })

    const byId = new Map<string, SproutFolder>()
    for (const [, data] of entries) {
      for (const folder of data?.folders ?? []) byId.set(folder.id, folder)
    }

    // filterKey is the intentional recompute trigger: memoising on queryClient
    // alone computed the index once at mount, when the cache is still empty.
    return withPaths(byId.values())
  }, [apiKey, filterKey, queryClient])
}

interface SearchResultsProps {
  matches: SelectedSproutFolder[]
  /** How many folders the search actually covered. */
  searchedCount: number
  onSelect: (folder: SelectedSproutFolder) => void
  index: ReturnType<typeof useSproutFolderIndex>
}

/**
 * Search hits, path-labelled.
 *
 * Searches the saved index (every folder, including ones never opened) unioned
 * with the live cache (levels opened this session, which may be newer than the
 * index). Reading both costs no requests.
 */
const SearchResults: React.FC<SearchResultsProps> = ({
  matches,
  searchedCount,
  onSelect,
  index
}) => (
  <>
    <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
      {matches.length} of {searchedCount} folders
      {index.index?.partial ? ' (partial index)' : ''}
    </DropdownMenuLabel>

    {matches.map((folder) => (
      <DropdownMenuItem key={folder.id} onSelect={() => onSelect(folder)}>
        <Folder className="text-muted-foreground shrink-0" />
        <span className="truncate" title={folder.path}>
          {folder.path}
        </span>
      </DropdownMenuItem>
    ))}

    {matches.length === 0 && (
      <p className="text-muted-foreground px-2 py-1.5 text-xs">
        {index.index
          ? 'No folder matches. Re-index if you have added folders on Sprout since this index was built.'
          : 'No match among folders opened this session.'}
      </p>
    )}

    {!index.index && !index.isBuilding && (
      <>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-xs">
            Only folders you have opened are searchable. Index the account once to search
            every folder by name or code.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-7 w-full text-xs"
            onClick={(event) => {
              event.preventDefault()
              index.build()
            }}
          >
            Index all folders
          </Button>
        </div>
      </>
    )}
  </>
)

/** Progress and staleness for the saved index, shown under the search box. */
const IndexStatus: React.FC<{ index: ReturnType<typeof useSproutFolderIndex> }> = ({
  index
}) => {
  if (index.isBuilding) {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="text-muted-foreground text-xs">
          Indexing… {index.progress?.folders ?? 0} folders found
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          onClick={(event) => {
            event.preventDefault()
            index.cancel()
          }}
        >
          Cancel
        </Button>
      </div>
    )
  }

  if (!index.index) return null

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="text-muted-foreground text-xs">
        {index.folders.length} folders indexed
        {index.ageInDays === 0
          ? ' today'
          : index.ageInDays !== null
            ? ` ${index.ageInDays}d ago`
            : ''}
        {index.isStale ? ' — may be out of date' : ''}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        onClick={(event) => {
          event.preventDefault()
          index.build()
        }}
      >
        Re-index
      </Button>
    </div>
  )
}

/** Back / breadcrumb / select for the level currently drilled into. */
const LevelHeader: React.FC<{
  current: SelectedSproutFolder
  isSelected: boolean
  onBack: () => void
  onUseThisFolder: () => void
}> = ({ current, isSelected, onBack, onUseThisFolder }) => (
  <>
    {/* Drilling keeps the menu open, so this must not auto-close. */}
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault()
        onBack()
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
    <DropdownMenuItem onSelect={onUseThisFolder}>
      <FolderOpen className="text-muted-foreground shrink-0" />
      Use this folder
      {isSelected && <Check className="ml-auto h-3.5 w-3.5" />}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>
)

/** Recently used folders and the Root option, shown at the top level. */
const RootHeader: React.FC<{
  recentFolders: SelectedSproutFolder[]
  selectedId: string | null
  isRootSelected: boolean
  onSelect: (folder: SelectedSproutFolder | null) => void
}> = ({ recentFolders, selectedId, isRootSelected, onSelect }) => (
  <>
    {recentFolders.length > 0 && (
      <>
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Recent
        </DropdownMenuLabel>
        {recentFolders.map((folder) => (
          <DropdownMenuItem key={`recent-${folder.id}`} onSelect={() => onSelect(folder)}>
            <Folder className="text-muted-foreground shrink-0" />
            <span className="truncate" title={folder.path}>
              {folder.path}
            </span>
            {selectedId === folder.id && (
              <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
      </>
    )}

    <DropdownMenuItem onSelect={() => onSelect(null)}>
      <FolderOpen className="text-muted-foreground shrink-0" />
      Root (no folder)
      {isRootSelected && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
    </DropdownMenuItem>
  </>
)

/** The current level's folders, plus its loading, error and empty states. */
const LevelBody: React.FC<{
  level: ReturnType<typeof useSproutFolders>
  selectedId: string | null
  onDrillInto: (folder: SproutFolder) => void
}> = ({ level, selectedId, onDrillInto }) => {
  const children = level.data?.folders ?? []

  if (level.isLoading) {
    return (
      <div className="space-y-1 p-1" data-testid="folder-level-loading">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-40" />
      </div>
    )
  }

  if (level.isError) {
    return (
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
    )
  }

  if (children.length === 0) {
    return <p className="text-muted-foreground px-2 py-1.5 text-xs">No subfolders</p>
  }

  return (
    <>
      {children.map((folder) => (
        <DropdownMenuItem
          key={folder.id}
          onSelect={(event) => {
            // Navigating is not choosing, so the menu must stay open.
            event.preventDefault()
            onDrillInto(folder)
          }}
        >
          <Folder className="text-muted-foreground shrink-0" />
          <span className="truncate" title={folder.name}>
            {folder.name}
          </span>
          {selectedId === folder.id && <Check className="ml-2 h-3.5 w-3.5 shrink-0" />}
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
  )
}

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
  const index = useSproutFolderIndex(apiKey)

  // Union of the saved index and this session's cache. The index reaches folders
  // never opened; the cache may hold levels newer than the index. Neither costs
  // a request. The cache wins on id collisions since it is fresher.
  const searchable = useMemo(() => {
    const byId = new Map<string, SelectedSproutFolder>()
    for (const folder of index.folders) byId.set(folder.id, folder)
    for (const folder of loadedFolders) byId.set(folder.id, folder)
    return [...byId.values()].sort((a, b) => a.path.localeCompare(b.path))
  }, [index.folders, loadedFolders])

  const matches = useMemo(() => matchFolders(searchable, filter), [searchable, filter])

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
    <DropdownMenu open={isOpen} onOpenChange={close}>
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
            aria-label="Search folders"
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-hidden"
            placeholder="Search folders by name or code…"
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

        <IndexStatus index={index} />

        {filter.trim() ? (
          <SearchResults
            matches={matches}
            searchedCount={searchable.length}
            onSelect={select}
            index={index}
          />
        ) : (
          <>
            {current ? (
              <LevelHeader
                current={current}
                isSelected={value?.id === current.id}
                onBack={goBack}
                onUseThisFolder={() => select(current)}
              />
            ) : (
              <RootHeader
                recentFolders={recentFolders}
                selectedId={value?.id ?? null}
                isRootSelected={value === null}
                onSelect={select}
              />
            )}

            <LevelBody
              level={level}
              selectedId={value?.id ?? null}
              onDrillInto={drillInto}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SproutFolderPicker
