# Phase 12: Residual Cleanup & Navigation Fixes - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve 5 remaining tech debt items from the v1.0 milestone audit: migrate useWindowState, add UploadOtter sidebar navigation, fix broken re-exports, remove stale test mocks, and remove ThemeImport placeholder. No new features — purely cleanup.

</domain>

<decisions>
## Implementation Decisions

### useWindowState migration
- Move from `src/hooks/useWindowState.ts` to `src/shared/hooks/useWindowState.ts`
- Exclude from barrel — follows Phase 9 pattern for Tauri-dependent hooks (useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck)
- App.tsx imports via direct path: `@shared/hooks/useWindowState` (not barrel)
- Delete `src/hooks/useWindowState.ts` after migration
- Delete `src/hooks/index.ts` (broken re-export of useAppendVideoInfo)
- Delete entire `src/hooks/` directory — empty after both files removed
- Leave test at `tests/unit/hooks/useWindowState.test.ts` (don't move)

### UploadOtter sidebar navigation
- Add sidebar entry under the "Upload content" group, after Trello (last item)
- Label: "Transcription" (describes function rather than product name)
- Change route from `/otter` to `/upload/otter` — matches `/upload/sprout`, `/upload/posterframe`, `/upload/trello` pattern
- Update AppRouter route path accordingly

### Broken re-export cleanup
- Delete `src/hooks/index.ts` entirely — it exports `useAppendVideoInfo` from a file that doesn't exist
- `useAppendVideoInfo` lives in `src/features/Trello/hooks/` and is accessed via Trello barrel
- Handled as part of useWindowState migration (entire src/hooks/ directory deleted)

### AppRouter test mock cleanup
- Update all 9 stale `@pages/*` mocks to their current `@features/*` barrel paths
- Update dashboard mock (`../../src/app/dashboard/page`) if path has changed
- Remove IngestHistory mock if the route was removed in Phase 11
- Remove ConnectedApps mock if that route no longer exists

### ThemeImport removal
- Delete `src/shared/ui/theme/ThemeImport.tsx` entirely
- It's a stub with TODO, not imported anywhere, and custom theme import can be built fresh when needed
- Remove any references to ThemeImport in other files (if any exist)

### Claude's Discretion
- Exact sidebar icon choice for Transcription/Otter entry
- Which specific `@features/*` barrel path maps to each stale `@pages/*` mock
- Whether any dashboard page mock path needs updating (check current file location)
- Add barrel exclusion comment for useWindowState in shared hooks index.ts (matching existing pattern)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@shared/hooks/` barrel with 7 exports and established pattern for Tauri-excluded hooks (comment explains direct import path)
- `AppSidebar` component at `@shared/ui/layout/app-sidebar.tsx` handles sidebar navigation
- `UploadOtter` component exists at `src/features/Upload/components/UploadOtter.tsx` and is barrel-exported

### Established Patterns
- Tauri-dependent hooks excluded from barrel with comment explaining direct import path (Phase 9 decision)
- Sidebar navigation entries defined in `app-sidebar.tsx` with icon, title, url, items structure
- Lazy-loaded routes use `React.lazy()` with barrel re-export pattern in AppRouter
- Upload routes follow `/upload/{feature}` URL pattern (sprout, posterframe, trello)

### Integration Points
- `App.tsx` line 14: `import { useWindowState } from './hooks/useWindowState'` — must update to `@shared/hooks/useWindowState`
- `src/hooks/index.ts` — entire file to delete (only export is broken)
- `src/hooks/useWindowState.ts` — move to `src/shared/hooks/useWindowState.ts`
- `tests/unit/AppRouter.test.tsx` — 9 stale mocks referencing `@pages/*` paths (lines 20-67)
- `src/shared/ui/theme/ThemeImport.tsx` — delete entire file
- `src/shared/ui/layout/app-sidebar.tsx` — add Transcription entry after Trello in Upload content group
- `src/AppRouter.tsx` — change `/otter` route to `/upload/otter`

</code_context>

<specifics>
## Specific Ideas

- Otter sidebar label should be "Transcription" (function-descriptive, not product name)
- Route URL must change to `/upload/otter` to be consistent with other Upload routes
- useWindowState barrel exclusion should follow exact same comment pattern as existing Tauri hooks

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-residual-cleanup*
*Context gathered: 2026-03-10*
