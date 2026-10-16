/**
 * MotionMarketplacePage - Grid of motion graphics templates (issue #336).
 *
 * Composes: useMotionCatalogue, useMotionPrefs, useMotionFont from #333,
 * useMotionTicker from #335, filterEntries/sortEntries from internal/filters,
 * TemplateCard, FilterBar, CatalogueIssuesBanner, MissingFontBanner,
 * and opens MotionTemplateDialog (#337 placeholder) on card selection.
 */
import { Button } from '@shared/ui/button'
import { PackageSearch, RefreshCw, Star } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useMotionCatalogue } from '../hooks/useMotionCatalogue'
import { useMotionFont } from '../hooks/useMotionFont'
import { useMotionPrefs } from '../hooks/useMotionPrefs'
import { useMotionTicker } from '../hooks/useMotionTicker'
import {
  DEFAULT_FILTERS,
  filterEntries,
  sortEntries,
  type FilterCriteria
} from '../internal/filters'
import { toggleFavourite } from '../internal/prefs'
import { deriveTargets } from '../internal/resolve'
import type { CatalogueEntry, MotionFormat } from '../types'
import CatalogueIssuesBanner from './CatalogueIssuesBanner'
import FilterBar from './FilterBar'
import MissingFontBanner from './MissingFontBanner'
import MotionTemplateDialog from './MotionTemplateDialog'
import TemplateCard from './TemplateCard'

// ---------------------------------------------------------------------------
// Default format for previews
// ---------------------------------------------------------------------------

const PREVIEW_FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }

// ---------------------------------------------------------------------------
// Ticker wrapper for grid cards
// ---------------------------------------------------------------------------

function useGridTicker(entries: CatalogueEntry[]) {
  // Use the first template's timing as the default; all share the same ticker
  const first = entries[0]?.template
  const ticker = useMotionTicker({
    duration: first?.duration ?? 4,
    inEnd: first?.inEnd ?? 1,
    playing: true
  })
  return ticker
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MotionMarketplacePage: React.FC = () => {
  const { prefs, updatePrefs } = useMotionPrefs()
  const { entries, issues, rescan } = useMotionCatalogue(prefs.libraryFolder)
  const fontState = useMotionFont()

  // Filter state
  const [filters, setFilters] = useState<FilterCriteria>(DEFAULT_FILTERS)
  const [issuesDismissed, setIssuesDismissed] = useState(false)

  // Dialog state
  const [selectedEntry, setSelectedEntry] = useState<CatalogueEntry | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastFocusedCard, setLastFocusedCard] = useState<HTMLElement | null>(null)

  // Ticker for all grid cards. Destructure so the containerRef (a ref
  // callback) and the time value (plain state) live in separate bindings,
  // avoiding the react-hooks/refs lint rule that taints an entire object
  // when one member is ref-shaped.
  const { containerRef: gridRef, time: tickerTime } = useGridTicker(entries)

  // Categories present in the catalogue
  const categories = useMemo(
    () => [...new Set(entries.map(e => e.template.category))],
    [entries]
  )

  // Filter and sort
  const filteredEntries = useMemo(
    () =>
      filterEntries(entries, filters, prefs.favourites, e => deriveTargets(e.template)),
    [entries, filters, prefs.favourites]
  )

  const sortedEntries = useMemo(
    () => sortEntries(filteredEntries, prefs.defaults, prefs.favourites),
    [filteredEntries, prefs.defaults, prefs.favourites]
  )

  // Detect empty states
  const isEmptyFilter =
    sortedEntries.length === 0 && entries.length > 0 && !filters.favouritesOnly
  const isEmptyFavourites = sortedEntries.length === 0 && filters.favouritesOnly

  // Handlers
  const handleToggleFavourite = useCallback(
    async (templateId: string) => {
      const updated = toggleFavourite(prefs, templateId)
      await updatePrefs(updated)
    },
    [prefs, updatePrefs]
  )

  const handleSelectCard = useCallback((entry: CatalogueEntry, target: HTMLElement) => {
    setSelectedEntry(entry)
    setLastFocusedCard(target)
    setDialogOpen(true)
  }, [])

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open)
      if (!open && lastFocusedCard) {
        // Return focus to the card that opened the dialog.
        // Use setTimeout(0) so the Radix portal unmounts first.
        setTimeout(() => {
          lastFocusedCard.focus()
        }, 0)
      }
    },
    [lastFocusedCard]
  )

  const handleRescan = useCallback(() => {
    setIssuesDismissed(false)
    rescan()
  }, [rescan])

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border bg-card/50 flex-shrink-0 border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">Motion marketplace</h1>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Browse, preview and export reusable motion graphics templates
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRescan}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Rescan
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-border bg-card/30 flex-shrink-0 border-b px-6 py-2.5">
        <FilterBar criteria={filters} onChange={setFilters} categories={categories} />
      </div>

      {/* Banners */}
      <div className="flex-shrink-0 space-y-2 px-6 py-2">
        {!issuesDismissed && issues.length > 0 && (
          <CatalogueIssuesBanner
            issues={issues}
            onDismiss={() => setIssuesDismissed(true)}
          />
        )}
        <MissingFontBanner visible={fontState.status === 'missing'} />
      </div>

      {/* Grid or empty state */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" ref={gridRef}>
        {isEmptyFavourites ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
            <Star className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No favourites yet</p>
            <p className="mt-1 text-xs">
              Click the star on a template card to add it to your favourites.
            </p>
          </div>
        ) : isEmptyFilter ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
            <PackageSearch className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No templates match these filters</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleClearFilters}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <ul
            aria-label="Templates"
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gridAutoRows: '1fr'
            }}
          >
            {sortedEntries.map(entry => {
              const isDefault =
                prefs.defaults[entry.template.category] === entry.template.id

              return (
                <li key={entry.template.id} className="h-full">
                  <TemplateCard
                    entry={entry}
                    format={PREVIEW_FORMAT}
                    values={{}}
                    isFavourite={prefs.favourites.includes(entry.template.id)}
                    isDefault={isDefault}
                    onToggleFavourite={() => handleToggleFavourite(entry.template.id)}
                    onSelect={() => {
                      const el = document.querySelector(
                        `[data-template-id="${entry.template.id}"] button`
                      ) as HTMLElement
                      handleSelectCard(entry, el)
                    }}
                    time={tickerTime}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Dialog (owned by #337, rendered with frozen props) */}
      {selectedEntry && (
        <MotionTemplateDialog
          template={selectedEntry}
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
        />
      )}
    </div>
  )
}

export default MotionMarketplacePage
