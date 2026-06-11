# Phase 2 Summary: Baker UI Refresh

**Completed:** 2026-06-11
**Branch:** 02-baker-ui-refresh
**Version:** 0.15.0

## What shipped

### Layout (BakerPage.tsx)
- Removed the fixed `h-[600px]` master-detail container; the workspace now fills all viewport height below the header and scan toolbar
- Folder picker + scan stats merged into one compact toolbar row (FolderSelector single-row variant, ScanResults inline strip with live elapsed timer)
- Project list fixed at `w-80`; detail panel takes the remainder with `min-w-0`
- BatchActions became a floating bar (absolute, bottom-center) visible only while ≥1 project is selected
- Pre-scan empty state added

### Project list (ProjectListPanel.tsx)
- Text filter input + status filter chips (All / Stale / No BC / Invalid) with counts, both panel-local state
- Status badges became dot pills (ProjectStatusPills); names wrap two lines (line-clamp-2); path subline added
- Virtual scrolling retained, driven by the filtered list

### Detail panel (ProjectDetailPanel.tsx)
- Real tabs via `@shared/ui/tabs` (Overview / Files / Videos / Trello) with count pills, replacing anchor-scroll navigation
- DetailHeader: wrapping title, copy-path button, spelled-out status pills
- BreadcrumbsCallout on Overview for stale / missing / unparseable breadcrumbs; "Preview changes" lazily calls `generatePreview` (cached in useBreadcrumbsPreview's Map, reused by Apply); renders ChangeDiffList expanded once a preview exists
- LinkedResources hub: linked Trello cards (live via `useTrelloCardsManager`), video links, and the legacy `trelloCardUrl` demoted (dashed border, Legacy badge) with a Migrate action that stages the URL through the Trello manager hook; the legacy row hides once a linked card with the same cardId exists
- Files tab: filter input, collapsible per-camera groups, type-specific icons (video/audio/peak)

### Diff-row language (new shared pieces)
- `utils/changeRows.ts`: `diffFileLists` (path-matched per-file diff; camera change = modified/high-impact, rename = remove+add), `buildProjectChangeRows` (expands the `files` field, collects maintenance fields separately, derives counts from the per-file expansion), `sumChangeCounts`
- `components/ChangeDiffList.tsx`: +/~/− rows with cap-and-expander (default 10), note row, muted uncounted maintenance row; `ChangeCounts` colour-coded counts — neither exported from the barrel

### Batch confirmation dialog (BatchUpdateConfirmationDialog.tsx)
- Rebuilt around ChangeDiffList: one summary line (`N projects · +a ~m −r · duration`), skipped-projects line, adaptive accordion (≤5 changed projects auto-expand), note rows for create/rebuild, header-only high-impact chip, `max-w-3xl`
- New `invalidBreadcrumbsPaths` prop from BakerPage flags unparseable rebuilds
- Deleted: DetailedChangesSection, ChangesSummary, CommonUpdates, SummaryStats, utils/batchUpdateSummary.ts (all replaced or already dead)

## Tests
- New: `utils/changeRows.test.ts` (14 tests), `components/BatchUpdateConfirmationDialog.test.tsx` (6 tests)
- Updated to the new contract: ScanResults, BatchActions, FolderSelector, ProjectListPanel (+animations), ProjectDetailPanel.animations, BakerPage tests
- Full suite: 2,321 tests / 141 files green; contract tests unchanged and passing

## Decisions / deviations
- Legacy `trelloCardUrl` field is NOT cleared on migrate — the row hides once the linked card exists; field removal stays deferred per 02-CONTEXT.md
- Per-file sizes omitted from the Files tab (breadcrumbs entries carry no size; per CONTEXT discretion)
- `Cargo.lock` Bucket entry was stale at 0.14.4 and was brought to 0.15.0 with the bump

## Validation
- `bun run test` ✅ 2321/2321 · `bun run eslint:fix` ✅ 0 errors · `bun run prettier:fix` ✅ · `bun run build` ✅
