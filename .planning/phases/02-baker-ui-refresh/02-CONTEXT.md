# Phase 2: Baker UI Refresh - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Baker page so the project detail panel becomes the primary surface instead of a fixed 600px corner, and rebuild the batch update confirmation dialog around a shared per-file diff-row language. The approved visual spec is the interactive mockup at `design-drafts/baker-redesign.html` (open in a browser; all states are clickable — tabs, status chips, stale callout with lazy preview, batch bar, confirmation dialog with cap expanders).

In scope: layout restructure of BakerPage, real tabs in the detail panel, linked-resources hub on Overview, stale-breadcrumbs callout with on-demand diff preview, status filter chips on the project list, richer Files/Videos/Trello tabs, floating batch action bar, rebuilt confirmation dialog, legacy Trello card demotion with a Migrate action, and the shared diff components/utilities backing all of it.

Out of scope: Rust backend changes, removal of the `legacyTrelloCard` field from types/schema (deferred to a later phase after migration adoption), new scan features.

</domain>

<decisions>
## Implementation Decisions

### Layout (root cause fixes)
- Remove the fixed `h-[600px]` master-detail container in `BakerPage.tsx` — the workspace (list + detail) fills all remaining viewport height below the header and scan bar
- Project list becomes a fixed ~320px column (was `w-2/5`); project names wrap to two lines (line-clamp), paths truncate
- Folder picker (step 1) and scan stats (step 2) collapse into a single toolbar row after a scan completes: path chip (left-truncated so the project name stays visible) + Browse + Rescan + inline stats (scanned / projects / breadcrumbs / size / duration)
- Batch actions become a floating pill bar centered at the bottom of the workspace, visible only when ≥1 project is selected; contains count, Select all, Clear, Apply changes
- Every flex parent of text content gets `min-width: 0`; long strings (titles, paths, Trello descriptions) get `overflow-wrap: anywhere` — horizontal scrolling must be impossible at any window width down to ~1080px

### Detail panel
- Real tabs (Overview / Files / Videos / Trello) using the existing `@shared/ui/tabs` primitive via direct import, replacing the anchor-scroll section navigation; tabs show count pills
- Detail header: wrapping project title, path with copy button, status badges spelled out ("Valid structure", "Breadcrumbs stale", "2 cameras")
- Overview gets a "Linked resources" section: linked Trello card(s) first, then video links, then the legacy Trello card visibly demoted (dashed border, amber "Legacy" badge, "deprecated — migrate to a linked card" hint) with Migrate and Open actions
- Migrate action: creates a linked Trello card from the legacy URL via the existing Baker→Trello integration hooks (through the `@features/Trello` barrel), clears the legacy field on the next breadcrumbs write; the write goes through Baker's `api.ts`
- Files tab: filter input, total summary line, collapsible per-camera groups with counts, type-specific icons (video/audio/peak)
- Videos tab: toolbar with Add video button; existing VideoLinkCard hover actions (reorder, remove) retained
- Trello tab: toolbar with "Link a card" action; card shows labels, wrapped description, checklist progress, attachments

### Diff-row language (shared between Overview preview and dialog)
- Per-file rows: files matched by `path`; only in new scan = `+` added (green); only in breadcrumbs = `−` removed (red); same path with different camera = `~` modified ("camera 1 → 2", amber); a rename shows as `−` old `+` new
- Scalar fields (folder size, cameras) render as single rows with old → new detail
- Cap: ~10 rows per project, then a "+ n more files…" inline expander
- Maintenance changes (lastModified, scannedBy) render as ONE muted row per project ("routine update"), excluded from all counts; projects with only maintenance changes count as "no changes" (matches existing `meaningfulDiff` semantics)
- Shared `ChangeDiffList` component in `src/features/Baker/components/` — NOT exported from the barrel (no contract-test surface change); file-array diff is a pure function in `src/features/Baker/utils/` next to `batchUpdateSummary.ts`

### Stale-breadcrumbs callout (Overview)
- Amber callout when breadcrumbs are stale: "Breadcrumbs are out of date" — NO change count before a preview exists (previews are expensive: NAS re-scan + folder-size calc)
- "Preview changes" button triggers `generatePreview` from the existing `useBreadcrumbsPreview` hook with a loading state, then renders the diff rows + count
- Result cached in the hook's `Map`; if a preview is already cached for the selected project, render the diff expanded immediately instead of the button
- Apply Changes reuses cached previews, regenerating only missing ones
- Equivalent callout variants: "No breadcrumbs file — create one" (No BC) and "Breadcrumbs file is unparseable — will be rebuilt, backup saved" (Invalid BC)

### Batch confirmation dialog (rebuild of BatchUpdateConfirmationDialog + DetailedChangesSection)
- Widen `max-w-2xl` → `max-w-3xl`
- Header summary: ONE line in diff language — "N projects with changes · +a ~m −r · duration" with counts in diff colours, computed from the per-file expansion so header arithmetic matches the rows
- Muted skipped line when applicable: "N selected projects have no changes and will be skipped" (surfaces the currently-invisible `projectsWithoutChanges`)
- Drop the "common changes" pills entirely (redundant with rows); keep the >20-projects warning banner and duration estimate; keep the "No Changes Required" empty state
- Adaptive accordion: all projects expanded when ≤5 have changes; above that, collapsed headers showing coloured `+n ~n −n` counts; headers always toggleable
- Note rows for special cases inside a project block: new file creation, unparseable rebuild (with backup mention)
- High-impact chip (red) on the project HEADER only, when any change in that project is high impact; no per-row impact chips
- Confirm button stays warning/amber-styled: "Update N projects"
- "content/metadata" category pills on project headers are replaced by the `+n ~n −n` counts — one vocabulary everywhere

### Project list
- Status filter chips under the search input: All / Stale / No BC / Invalid, with counts
- Status badges become dot-pills; camera count stays a muted chip
- Retain virtual scrolling for 50+ item lists (existing behaviour)

### Claude's Discretion
- Exact Tailwind class composition and spacing to match the mockup within the existing 8-theme token system (semantic classes, no hardcoded hex)
- Per-file sizes in the Files tab: breadcrumbs file entries are `{camera, name, path}` with no size — show sizes only if cheaply available from scan data, otherwise omit (do NOT add a per-file stat call)
- Animation/transition details (batch bar slide-in, chevron rotation)
- Filter input debouncing and empty-state copy

</decisions>

<specifics>
## Specific Ideas

- The mockup `design-drafts/baker-redesign.html` is the agreed visual reference; match its information hierarchy and diff-row appearance (sign column, monospace signs, detail column right-aligned, muted maintenance rows at reduced opacity)
- Design was stress-tested at 1440x900 and 1080x760 — the implementation must remain fully usable without maximising the window
- All colours via theme tokens (`text-success`, `text-warning`, `text-destructive`, `bg-muted` etc.) so all 8 themes work — the mockup's hex values are dark-theme approximations only
- Diff sign vocabulary: `+` / `~` / `−` (U+2212 or hyphen-minus consistently), matching git-style mental model

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BakerPage.tsx` — root layout; fixed `h-[600px]` master-detail container is the primary defect
- `ProjectListPanel.tsx` — list with badges + virtual scrolling; gets chips + new badge styling
- `ProjectDetailPanel.tsx` — anchor-scroll sections to be replaced with `@shared/ui/tabs`
- `BatchActions.tsx` — becomes the floating bar variant
- `BatchUpdateConfirmationDialog.tsx` + `DetailedChangesSection.tsx` — rebuilt around `ChangeDiffList`; `ChangesSummary.tsx`, `CommonUpdates.tsx`, `SummaryStats.tsx` likely absorbed/deleted
- `utils/batchUpdateSummary.ts` — extend to compute per-file aggregate counts; `hasAnyChanges` semantics unchanged
- `hooks/useBreadcrumbsPreview.ts` — already has single + batch generation, concurrency limit (5), and a preview `Map` cache; lazy Overview preview wires into `generatePreview`/`getPreview`
- `internal/PreviewComparison.tsx` — check for overlap with new diff components before writing new code
- Types: `FieldChange`, `BreadcrumbsDiff`, `DetailedFieldChange` (impact, category), `ProjectChangeDetail` in `src/shared/types/breadcrumbs.ts` — sufficient for everything except per-file rows, which are derived by diffing `preview.current.files` vs `preview.updated.files` (both available on `BreadcrumbsPreview`)

### Established Patterns
- All I/O through Baker `api.ts` (no-bypass contract tests grep for direct `@tauri-apps` imports)
- Cross-feature imports via barrels only: `TrelloCardsManager` and Trello hooks from `@features/Trello`
- `shared/ui` has no barrel — direct imports (`@shared/ui/tabs`, `@shared/ui/dialog`, `@shared/ui/button`)
- Internal components stay out of the Baker barrel — `ChangeDiffList` and the file-diff util are not exported, so shape tests (21 exports) stay green
- Radix AlertDialog for destructive confirmations, Sonner toasts for notifications

### Integration Points
- `useBakerScan` / scan results feed the toolbar stats (Phase 1 added elapsed timing)
- `useBakerTrelloIntegration` handles Trello card updates during batch apply — the Migrate action reuses this path
- VideoLinksManager + AddVideoDialog already implement video CRUD — Videos tab relocates, does not rewrite
- Contract tests in `src/features/Baker/__contracts__/` must pass unchanged; only behavioural tests for modified hooks/components may need updates

</code_context>

<deferred>
## Deferred Ideas

- Remove `legacyTrelloCard` from `BreadcrumbsFile` type and breadcrumbs.json schema (deliberate contract change with migration; wait until Migrate action has been used in production)
- Per-file size column in the Files tab if scan data doesn't already carry sizes (would need `bakerScanCurrentFiles` extension in Rust)
- Empty/edge state designs for "no project selected", "scan in progress" in the new layout (use sensible defaults; revisit if rough)

</deferred>

---

*Phase: 02-baker-ui-refresh*
*Context gathered: 2026-06-11*
