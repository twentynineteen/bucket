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
- App.tsx import changes from `./hooks/useWindowState` to `@shared/hooks/useWindowState` (or barrel)
- Delete `src/hooks/useWindowState.ts` after migration
- Delete `src/hooks/index.ts` (only remaining file exports non-existent useAppendVideoInfo)

### UploadOtter sidebar navigation
- Add sidebar entry under the Upload group, alongside Sprout Video
- Label: "Otter" or "Otter.ai" — placed in the upload/integrations section
- Route already exists at `/otter` in AppRouter — just needs sidebar wiring

### Broken re-export cleanup
- Delete `src/hooks/index.ts` entirely — it exports `useAppendVideoInfo` from a file that doesn't exist
- `useAppendVideoInfo` lives in `src/features/Trello/hooks/` and is accessed via Trello barrel

### Stale test mock cleanup
- Remove 9 stale `vi.mock` calls in `tests/unit/AppRouter.test.tsx` that reference deleted `@pages/*` paths
- Update mocks to match current `@features/*` lazy-loaded module structure

### ThemeImport removal
- Delete `src/shared/ui/theme/ThemeImport.tsx` entirely
- It's a stub with TODO, not imported anywhere, and custom theme import can be built fresh when needed
- Remove any references to ThemeImport in other files (if any exist)

### Claude's Discretion
- Whether useWindowState goes in barrel or stays direct-import-only (same Tauri dependency pattern as useMacOSEffects)
- Exact sidebar icon choice for Otter entry
- Which stale mocks to update vs remove in AppRouter test (depends on current route structure)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@shared/hooks/` barrel with 7 exports and established pattern for Tauri-excluded hooks (useMacOSEffects, useUpdateManager, useSystemTheme, useVersionCheck)
- `AppSidebar` component at `@shared/ui/layout/app-sidebar.tsx` handles sidebar navigation
- `UploadOtter` component exists at `src/features/Upload/components/UploadOtter.tsx` and is barrel-exported

### Established Patterns
- Tauri-dependent hooks are excluded from barrel with comment explaining direct import path (Phase 9 decision)
- Sidebar navigation entries are defined in `app-sidebar.tsx`
- Lazy-loaded routes use `React.lazy()` with barrel re-export pattern in AppRouter

### Integration Points
- `App.tsx` line 14: `import { useWindowState } from './hooks/useWindowState'` — must update
- `src/hooks/index.ts` — entire file to delete (only export is broken)
- `tests/unit/AppRouter.test.tsx` — 9 stale mocks referencing `@pages/*` paths
- `src/shared/ui/theme/ThemeImport.tsx` — delete entire file

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all items are mechanical cleanup guided by existing codebase conventions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-residual-cleanup*
*Context gathered: 2026-03-10*
